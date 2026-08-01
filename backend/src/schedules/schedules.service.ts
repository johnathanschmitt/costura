import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConflictQueryDto, CreateScheduleDto, ListSchedulesDto, UpdateScheduleDto,
} from './dto/schedules.dto';

/** Compromissos cancelados ou com falta não disputam horário. */
const BLOCKING_STATUSES = ['SCHEDULED', 'CONFIRMED'] as const;

const INCLUDE = {
  customer: { select: { id: true, name: true, phone: true } },
  workOrder: { select: { id: true, number: true, status: true } },
  quote: { select: { id: true, number: true, status: true } },
  user: { select: { id: true, name: true } },
};

@Injectable()
export class SchedulesService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: ListSchedulesDto) {
    const { startDate, endDate, customerId, type, includeDeadlines } = query;

    const schedules = await this.prisma.schedule.findMany({
      where: {
        deletedAt: null,
        ...(startDate && endDate && { startAt: { gte: new Date(startDate), lte: new Date(endDate) } }),
        ...(customerId && { customerId }),
        ...(type && { type }),
      },
      orderBy: { startAt: 'asc' },
      include: INCLUDE,
    });

    if (includeDeadlines !== 'true' || !startDate || !endDate) return schedules;

    // Prazos de OS entram como itens virtuais do calendário: não são
    // agendamentos, mas ocupam o dia e evitam prometer entrega em dia cheio.
    const deadlines = await this.prisma.workOrder.findMany({
      where: {
        deletedAt: null,
        dueDate: { gte: new Date(startDate), lte: new Date(endDate) },
        status: { notIn: ['DELIVERED', 'CANCELLED'] },
      },
      select: {
        id: true, number: true, dueDate: true, priority: true, status: true,
        customer: { select: { id: true, name: true } },
      },
    });

    return [
      ...schedules,
      ...deadlines.map(wo => ({
        id: `deadline-${wo.id}`,
        kind: 'WORK_ORDER_DEADLINE' as const,
        workOrderId: wo.id,
        title: `Prazo ${wo.number}`,
        type: 'DELIVERY',
        status: 'SCHEDULED',
        allDay: true,
        startAt: wo.dueDate,
        endAt: wo.dueDate,
        customer: wo.customer,
        priority: wo.priority,
      })),
    ];
  }

  async findOne(id: string) {
    const s = await this.prisma.schedule.findFirst({
      where: { id, deletedAt: null },
      include: INCLUDE,
    });
    if (!s) throw new NotFoundException('Agendamento não encontrado');
    return s;
  }

  /**
   * Compromissos que se sobrepõem ao intervalo. Dois períodos colidem quando um
   * começa antes de o outro terminar — comparação simétrica, sem casos especiais.
   */
  findConflicts(query: ConflictQueryDto) {
    const startAt = new Date(query.startAt);
    const endAt = new Date(query.endAt);

    return this.prisma.schedule.findMany({
      where: {
        deletedAt: null,
        status: { in: [...BLOCKING_STATUSES] },
        ...(query.excludeId && { id: { not: query.excludeId } }),
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      orderBy: { startAt: 'asc' },
      include: INCLUDE,
    });
  }

  private validatePeriod(startAt?: string, endAt?: string) {
    if (!startAt || !endAt) return;
    if (new Date(endAt) <= new Date(startAt)) {
      throw new BadRequestException('O término deve ser depois do início');
    }
  }

  private async validateLinks(dto: { customerId?: string; workOrderId?: string; quoteId?: string }) {
    if (dto.customerId) {
      const c = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, deletedAt: null }, select: { id: true },
      });
      if (!c) throw new NotFoundException('Cliente não encontrada');
    }
    if (dto.workOrderId) {
      const w = await this.prisma.workOrder.findFirst({
        where: { id: dto.workOrderId, deletedAt: null }, select: { id: true },
      });
      if (!w) throw new NotFoundException('Ordem de serviço não encontrada');
    }
    if (dto.quoteId) {
      const q = await this.prisma.quote.findFirst({
        where: { id: dto.quoteId, deletedAt: null }, select: { id: true },
      });
      if (!q) throw new NotFoundException('Orçamento não encontrado');
    }
  }

  /**
   * Conflito de horário é aviso, não impedimento — o ateliê pode legitimamente
   * atender duas clientes ao mesmo tempo. Os conflitos voltam junto na resposta
   * para a interface avisar.
   */
  async create(dto: CreateScheduleDto) {
    this.validatePeriod(dto.startAt, dto.endAt);
    await this.validateLinks(dto);

    const conflicts = await this.findConflicts({ startAt: dto.startAt, endAt: dto.endAt });

    const schedule = await this.prisma.schedule.create({
      data: {
        ...dto,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
      },
      include: INCLUDE,
    });
    return { ...schedule, conflicts };
  }

  async update(id: string, dto: UpdateScheduleDto) {
    const current = await this.findOne(id);
    const startAt = dto.startAt ?? current.startAt.toISOString();
    const endAt = dto.endAt ?? current.endAt.toISOString();
    this.validatePeriod(startAt, endAt);
    await this.validateLinks(dto);

    const conflicts = await this.findConflicts({ startAt, endAt, excludeId: id });

    const schedule = await this.prisma.schedule.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.startAt && { startAt: new Date(dto.startAt) }),
        ...(dto.endAt && { endAt: new Date(dto.endAt) }),
      },
      include: INCLUDE,
    });
    return { ...schedule, conflicts };
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.schedule.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
