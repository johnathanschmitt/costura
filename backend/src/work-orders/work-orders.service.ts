import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkOrdersService {
  constructor(private prisma: PrismaService) {}

  private async nextNumber() {
    const last = await this.prisma.workOrder.findFirst({ orderBy: { createdAt: 'desc' } });
    const num = last ? parseInt(last.number.replace('OS-', '')) + 1 : 1;
    return `OS-${String(num).padStart(5, '0')}`;
  }

  async findAll(search?: string, status?: string, page: any = 1, limit: any = 20, startDate?: string, endDate?: string, dueStart?: string, dueEnd?: string) {
    const p = Math.max(1, parseInt(page) || 1);
    const l = Math.min(100, parseInt(limit) || 20);
    const where = {
      deletedAt: null,
      ...(status && { status: status as any }),
      ...(startDate && endDate && { createdAt: { gte: new Date(startDate), lte: new Date(endDate) } }),
      ...(dueStart && dueEnd && { dueDate: { gte: new Date(dueStart), lte: new Date(dueEnd) } }),
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
        skip: (p - 1) * l,
        take: l,
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        include: { customer: { select: { id: true, name: true, phone: true } } },
      }),
      this.prisma.workOrder.count({ where }),
    ]);
    return { data, total, page: p, limit: l };
  }

  async findOne(id: string) {
    const wo = await this.prisma.workOrder.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: true,
        quote: true,
        items: { include: { service: true, product: true }, orderBy: { order: 'asc' } },
        schedules: { orderBy: { startAt: 'asc' } },
      },
    });
    if (!wo) throw new NotFoundException('Ordem de serviço não encontrada');
    return wo;
  }

  async create(data: any) {
    const { items, ...woData } = data;
    const number = await this.nextNumber();
    const total = items?.reduce((s: number, i: any) => s + i.unitPrice * i.quantity, 0) ?? 0;
    return this.prisma.workOrder.create({
      data: {
        ...woData,
        number,
        total,
        items: items ? { create: items.map((i: any, idx: number) => ({ ...i, total: i.unitPrice * i.quantity, order: idx })) } : undefined,
      },
      include: { customer: true, items: true },
    });
  }

  async updateStatus(id: string, status: string) {
    await this.findOne(id);
    const timestamps: any = {};
    if (status === 'IN_PROGRESS') timestamps.startedAt = new Date();
    if (status === 'DONE') timestamps.completedAt = new Date();
    if (status === 'DELIVERED') timestamps.deliveredAt = new Date();
    return this.prisma.workOrder.update({ where: { id }, data: { status: status as any, ...timestamps } });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    const { items, ...woData } = data;
    if (items) await this.prisma.workOrderItem.deleteMany({ where: { workOrderId: id } });
    const total = items?.reduce((s: number, i: any) => s + i.unitPrice * i.quantity, 0);
    return this.prisma.workOrder.update({
      where: { id },
      data: {
        ...woData,
        ...(total !== undefined && { total }),
        ...(items && { items: { create: items.map((i: any, idx: number) => ({ ...i, total: i.unitPrice * i.quantity, order: idx })) } }),
      },
      include: { customer: true, items: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.workOrder.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
