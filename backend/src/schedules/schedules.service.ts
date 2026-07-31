import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SchedulesService {
  constructor(private prisma: PrismaService) {}

  findAll(startDate?: Date, endDate?: Date, customerId?: string) {
    return this.prisma.schedule.findMany({
      where: {
        deletedAt: null,
        ...(startDate && endDate && { startAt: { gte: startDate, lte: endDate } }),
        ...(customerId && { customerId }),
      },
      orderBy: { startAt: 'asc' },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        workOrder: { select: { id: true, number: true } },
      },
    });
  }

  async findOne(id: string) {
    const s = await this.prisma.schedule.findFirst({ where: { id, deletedAt: null }, include: { customer: true, workOrder: true } });
    if (!s) throw new NotFoundException('Agendamento não encontrado');
    return s;
  }

  create(data: any) {
    return this.prisma.schedule.create({ data, include: { customer: true } });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.schedule.update({ where: { id }, data, include: { customer: true } });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.schedule.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
