import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, WorkOrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssignDto, BoardQueryDto, CreateUpdateDto, CreateWorkOrderDto, DeliverDto,
  ListWorkOrdersDto, SetEstimatedHoursDto, UpdateStatusDto, UpdateWorkOrderDto,
  WorkOrderItemDto,
} from './dto/work-orders.dto';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const ZERO = D(0);

const brl = (v: Prisma.Decimal.Value) => `R$ ${D(v).toFixed(2).replace('.', ',')}`;

/** Colunas do quadro de produção, na ordem do fluxo. Canceladas ficam fora. */
export const BOARD_COLUMNS: WorkOrderStatus[] = [
  'PENDING',
  'IN_PROGRESS',
  'WAITING_MATERIAL',
  'FITTING',
  'DONE',
  'DELIVERED',
];

@Injectable()
export class WorkOrdersService {
  constructor(private prisma: PrismaService) {}

  private async nextNumber() {
    const last = await this.prisma.workOrder.findFirst({ orderBy: { createdAt: 'desc' } });
    const num = last ? parseInt(last.number.replace('OS-', '')) + 1 : 1;
    return `OS-${String(num).padStart(5, '0')}`;
  }

  private itemsCreate(items: WorkOrderItemDto[]) {
    return items.map((i, idx) => ({
      type: i.type,
      description: i.description,
      quantity: D(i.quantity),
      unitPrice: D(i.unitPrice),
      total: D(i.unitPrice).times(i.quantity),
      serviceId: i.serviceId ?? null,
      productId: i.productId ?? null,
      done: i.done ?? false,
      order: idx,
    }));
  }

  private itemsTotal(items: WorkOrderItemDto[]) {
    return items.reduce((s, i) => s.plus(D(i.unitPrice).times(i.quantity)), ZERO);
  }

  /**
   * O que a OS já recebeu vem das contas a receber vinculadas — é lá que os
   * pagamentos são registrados. A coluna `paidAmount` da OS nunca é escrita por
   * ninguém, então somá-la daria sempre zero.
   */
  private financials(
    total: Prisma.Decimal.Value,
    discount: Prisma.Decimal.Value,
    receivables: { amount: Prisma.Decimal; paidAmount: Prisma.Decimal; status: string }[],
  ) {
    const active = receivables.filter(r => r.status !== 'CANCELLED');
    const paid = active.reduce((s, r) => s.plus(r.paidAmount), ZERO);
    const net = D(total).minus(discount);
    return {
      total: net,
      paid,
      balance: net.minus(paid),
      hasReceivable: active.length > 0,
    };
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  async findAll(query: ListWorkOrdersDto) {
    const {
      page = 1, limit = 20, search, status, priority, assignedToId, garmentId,
      startDate, endDate, dueStart, dueEnd,
    } = query;

    const where: Prisma.WorkOrderWhereInput = {
      deletedAt: null,
      ...(status && { status }),
      ...(priority && { priority }),
      ...(assignedToId && { assignedToId }),
      ...(garmentId && { garmentId }),
      ...(startDate && endDate && { createdAt: { gte: new Date(startDate), lte: new Date(endDate) } }),
      ...((dueStart || dueEnd) && {
        dueDate: {
          ...(dueStart && { gte: new Date(dueStart) }),
          ...(dueEnd && { lte: new Date(dueEnd) }),
        },
      }),
      ...(search && {
        OR: [
          { number: { contains: search, mode: 'insensitive' as const } },
          { customer: { name: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.workOrder.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          assignedTo: { select: { id: true, name: true } },
          garment: { select: { id: true, name: true } },
        },
      }),
      this.prisma.workOrder.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  /** Quadro de produção agrupado por status, com contadores por coluna. */
  async getBoard(query: BoardQueryDto) {
    const { assignedToId, priority, garmentId, search } = query;
    const where: Prisma.WorkOrderWhereInput = {
      deletedAt: null,
      status: { in: BOARD_COLUMNS },
      ...(assignedToId && { assignedToId }),
      ...(priority && { priority }),
      ...(garmentId && { garmentId }),
      ...(search && {
        OR: [
          { number: { contains: search, mode: 'insensitive' as const } },
          { customer: { name: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
    };

    const orders = await this.prisma.workOrder.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        assignedTo: { select: { id: true, name: true } },
        garment: { select: { id: true, name: true } },
        _count: { select: { items: true } },
        // Última atualização aparece no cartão do quadro (US-20).
        updates: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { note: true, createdAt: true, user: { select: { name: true } } },
        },
      },
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const columns = BOARD_COLUMNS.map(status => {
      const items = orders
        .filter(o => o.status === status)
        .map(o => ({
          ...o,
          // "Atrasada" só faz sentido enquanto a peça não foi entregue.
          overdue:
            Boolean(o.dueDate) &&
            o.dueDate! < startOfToday &&
            o.status !== 'DELIVERED',
        }));
      return {
        status,
        count: items.length,
        overdueCount: items.filter(i => i.overdue).length,
        items,
      };
    });

    return { columns, total: orders.length };
  }

  async findOne(id: string) {
    const wo = await this.prisma.workOrder.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: true,
        quote: { select: { id: true, number: true, status: true } },
        garment: { select: { id: true, name: true, category: true } },
        assignedTo: { select: { id: true, name: true } },
        deliveredBy: { select: { id: true, name: true } },
        items: { include: { service: true, product: true }, orderBy: { order: 'asc' } },
        schedules: { orderBy: { startAt: 'asc' } },
        accountsReceivable: {
          select: { id: true, description: true, amount: true, paidAmount: true, status: true, dueDate: true },
          orderBy: { dueDate: 'asc' },
        },
        inventoryMovements: {
          where: { type: 'OUT' },
          include: { product: { select: { id: true, name: true, unit: true } } },
          orderBy: { occurredAt: 'desc' },
        },
        attachments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!wo) throw new NotFoundException('Ordem de serviço não encontrada');

    return { ...wo, financials: this.financials(wo.total, wo.discount, wo.accountsReceivable) };
  }

  // ── Escrita ───────────────────────────────────────────────────────────────

  async create(dto: CreateWorkOrderDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');

    const { items, measurements, ...data } = dto;
    const number = await this.nextNumber();

    return this.prisma.workOrder.create({
      data: {
        ...data,
        number,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        discount: D(dto.discount ?? 0),
        total: items ? this.itemsTotal(items) : ZERO,
        measurements: (measurements ?? undefined) as Prisma.InputJsonValue | undefined,
        ...(items && { items: { create: this.itemsCreate(items) } }),
      },
      include: { customer: true, items: true, assignedTo: { select: { id: true, name: true } } },
    });
  }

  async update(id: string, dto: UpdateWorkOrderDto) {
    await this.findOne(id);
    const { items, measurements, ...data } = dto;

    if (items) await this.prisma.workOrderItem.deleteMany({ where: { workOrderId: id } });

    return this.prisma.workOrder.update({
      where: { id },
      data: {
        ...data,
        ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
        ...(dto.discount !== undefined && { discount: D(dto.discount) }),
        ...(measurements !== undefined && { measurements: measurements as Prisma.InputJsonValue }),
        ...(items && { total: this.itemsTotal(items), items: { create: this.itemsCreate(items) } }),
      },
      include: { customer: true, items: true, assignedTo: { select: { id: true, name: true } } },
    });
  }

  async updateStatus(id: string, dto: UpdateStatusDto) {
    const wo = await this.prisma.workOrder.findFirst({ where: { id, deletedAt: null } });
    if (!wo) throw new NotFoundException('Ordem de serviço não encontrada');

    // A entrega tem regra própria (confere saldo devedor e registra quem
    // entregou), então não pode ser alcançada por uma troca simples de status.
    if (dto.status === 'DELIVERED') {
      throw new BadRequestException(
        'Use o registro de entrega para marcar a OS como entregue',
      );
    }
    if (wo.status === 'DELIVERED') {
      throw new BadRequestException('OS já entregue não pode mudar de status');
    }

    const timestamps: Prisma.WorkOrderUpdateInput = {};
    if (dto.status === 'IN_PROGRESS' && !wo.startedAt) timestamps.startedAt = new Date();
    if (dto.status === 'DONE') timestamps.completedAt = new Date();

    return this.prisma.workOrder.update({
      where: { id },
      data: { status: dto.status, ...timestamps },
      include: {
        customer: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });
  }

  async assign(id: string, dto: AssignDto) {
    const wo = await this.prisma.workOrder.findFirst({ where: { id, deletedAt: null } });
    if (!wo) throw new NotFoundException('Ordem de serviço não encontrada');

    if (dto.assignedToId) {
      const user = await this.prisma.user.findFirst({
        where: { id: dto.assignedToId, deletedAt: null, active: true },
        select: { id: true },
      });
      if (!user) throw new NotFoundException('Costureira não encontrada ou inativa');
    }

    return this.prisma.workOrder.update({
      where: { id },
      data: {
        assignedToId: dto.assignedToId ?? null,
        ...(dto.reason && {
          internalNotes: [wo.internalNotes, `[Reatribuição] ${dto.reason}`].filter(Boolean).join('\n'),
        }),
      },
      include: { assignedTo: { select: { id: true, name: true } } },
    });
  }

  /**
   * Registro de entrega. Recusa quando há saldo devedor, a menos que a
   * atendente confirme conscientemente — é a decisão que o backlog pede que o
   * sistema force alguém a tomar, em vez de deixar passar silenciosamente.
   */
  async deliver(id: string, dto: DeliverDto, userId?: string) {
    return this.prisma.$transaction(async tx => {
      const wo = await tx.workOrder.findFirst({
        where: { id, deletedAt: null },
        include: {
          accountsReceivable: { select: { id: true, amount: true, paidAmount: true, status: true } },
          customer: { select: { id: true, name: true } },
        },
      });
      if (!wo) throw new NotFoundException('Ordem de serviço não encontrada');
      if (wo.status === 'DELIVERED') throw new BadRequestException('Esta OS já foi entregue');
      if (wo.status === 'CANCELLED') throw new BadRequestException('OS cancelada não pode ser entregue');

      const fin = this.financials(wo.total, wo.discount, wo.accountsReceivable);

      if (fin.balance.gt(0) && !dto.acknowledgeDebt) {
        throw new BadRequestException(
          `A cliente ainda deve ${brl(fin.balance)}. Registre o pagamento ou confirme a ` +
            'entrega com saldo em aberto.',
        );
      }

      // OS criada direto (sem orçamento) não tem cobrança nenhuma; entregar sem
      // gerar a conta faria o valor sumir do financeiro.
      if (!fin.hasReceivable && fin.total.gt(0)) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        await tx.accountReceivable.create({
          data: {
            customerId: wo.customerId,
            workOrderId: wo.id,
            description: `${wo.number} — entrega`,
            amount: fin.total,
            dueDate,
          },
        });
      }

      return tx.workOrder.update({
        where: { id },
        data: {
          status: 'DELIVERED',
          deliveredAt: new Date(),
          deliveredById: userId ?? null,
          receivedBy: dto.receivedBy ?? null,
          ...(dto.notes && {
            internalNotes: [wo.internalNotes, `[Entrega] ${dto.notes}`].filter(Boolean).join('\n'),
          }),
        },
        include: {
          customer: true,
          deliveredBy: { select: { id: true, name: true } },
          items: { orderBy: { order: 'asc' } },
        },
      });
    });
  }

  // ── Andamento (US-20) ─────────────────────────────────────────────────────

  async addUpdate(id: string, dto: CreateUpdateDto, userId?: string) {
    const wo = await this.prisma.workOrder.findFirst({ where: { id, deletedAt: null } });
    if (!wo) throw new NotFoundException('Ordem de serviço não encontrada');
    if (wo.status === 'DELIVERED' || wo.status === 'CANCELLED') {
      throw new BadRequestException('OS encerrada não recebe mais atualizações');
    }

    return this.prisma.$transaction(async tx => {
      const update = await tx.workOrderUpdate.create({
        data: {
          workOrderId: id,
          note: dto.note,
          progressPct: dto.progressPct ?? null,
          userId: userId ?? null,
        },
        include: { user: { select: { id: true, name: true } } },
      });

      // O percentual da OS é o da última atualização que informou um.
      if (dto.progressPct !== undefined) {
        await tx.workOrder.update({ where: { id }, data: { progressPct: dto.progressPct } });
      }
      return update;
    });
  }

  listUpdates(id: string) {
    return this.prisma.workOrderUpdate.findMany({
      where: { workOrderId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true } },
        attachments: { select: { id: true, url: true, originalName: true, caption: true } },
      },
    });
  }

  setEstimatedHours(id: string, dto: SetEstimatedHoursDto) {
    return this.prisma.workOrder.update({
      where: { id },
      data: { estimatedHours: D(dto.estimatedHours) },
      select: { id: true, number: true, estimatedHours: true },
    });
  }

  // ── Fila de produção por costureira (US-19) ───────────────────────────────

  /**
   * Carga de cada costureira: as OS abertas atribuídas a ela, as horas
   * estimadas somadas e quantos dias de trabalho isso representa na capacidade
   * diária dela. Quem não tem estimativa entra com a média das que têm, para o
   * número não mentir por omissão.
   */
  async getQueues() {
    const [users, orders, business] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: { deletedAt: null, active: true },
        select: { id: true, name: true, dailyCapacityHours: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.workOrder.findMany({
        where: { deletedAt: null, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        include: {
          customer: { select: { id: true, name: true } },
          garment: { select: { id: true, name: true } },
        },
      }),
      this.prisma.businessInfo.findFirst({ select: { queueAlertDays: true } }),
    ]);

    const alertDays = business?.queueAlertDays ?? 7;
    const withHours = orders.filter(o => o.estimatedHours !== null);
    const averageHours = withHours.length
      ? withHours.reduce((s, o) => s.plus(o.estimatedHours!), ZERO).dividedBy(withHours.length)
      : D(4);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const buildQueue = (
      id: string | null,
      name: string,
      capacity: Prisma.Decimal,
      items: typeof orders,
    ) => {
      const hours = items.reduce((s, o) => s.plus(o.estimatedHours ?? averageHours), ZERO);
      const days = capacity.gt(0) ? hours.dividedBy(capacity) : ZERO;
      return {
        userId: id,
        name,
        dailyCapacityHours: capacity,
        count: items.length,
        estimatedHours: hours,
        // Quantos dias de trabalho a fila representa.
        queueDays: days.toDecimalPlaces(1),
        overloaded: days.gt(alertDays),
        overdueCount: items.filter(o => o.dueDate && o.dueDate < startOfToday).length,
        items: items.map(o => ({
          ...o,
          overdue: Boolean(o.dueDate && o.dueDate < startOfToday),
          hoursUsed: o.estimatedHours ?? averageHours,
          estimated: o.estimatedHours !== null,
        })),
      };
    };

    const queues = users.map(u =>
      buildQueue(u.id, u.name, D(u.dailyCapacityHours), orders.filter(o => o.assignedToId === u.id)),
    );

    const unassigned = orders.filter(o => !o.assignedToId);
    if (unassigned.length) {
      queues.push(buildQueue(null, 'Sem costureira', ZERO, unassigned));
    }

    return { alertDays, averageHours, queues };
  }

  async remove(id: string) {
    const wo = await this.prisma.workOrder.findFirst({ where: { id, deletedAt: null } });
    if (!wo) throw new NotFoundException('Ordem de serviço não encontrada');
    if (wo.status === 'DELIVERED') {
      throw new BadRequestException('OS já entregue não pode ser removida');
    }
    return this.prisma.workOrder.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /** Dados do recibo de entrega. */
  async getReceipt(id: string) {
    const wo = await this.findOne(id);
    if (wo.status !== 'DELIVERED') {
      throw new BadRequestException('O recibo só existe depois que a peça é entregue');
    }
    const business = await this.prisma.businessInfo.findFirst();
    return { workOrder: wo, business };
  }
}
