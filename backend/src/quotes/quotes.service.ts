import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QuotesService {
  constructor(private prisma: PrismaService) {}

  private async nextNumber() {
    const last = await this.prisma.quote.findFirst({ orderBy: { createdAt: 'desc' } });
    const num = last ? parseInt(last.number.replace('ORC-', '')) + 1 : 1;
    return `ORC-${String(num).padStart(5, '0')}`;
  }

  async findAll(search?: string, status?: string, page: any = 1, limit: any = 20, startDate?: string, endDate?: string) {
    const p = Math.max(1, parseInt(page) || 1);
    const l = Math.min(100, parseInt(limit) || 20);
    const where = {
      deletedAt: null,
      ...(status && { status: status as any }),
      ...(startDate && endDate && { createdAt: { gte: new Date(startDate), lte: new Date(endDate) } }),
      ...(search && {
        OR: [
          { number: { contains: search, mode: 'insensitive' as const } },
          { customer: { name: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.quote.findMany({
        where,
        skip: (p - 1) * l,
        take: l,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          workOrder: { select: { id: true, number: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.quote.count({ where }),
    ]);
    return { data, total, page: p, limit: l };
  }

  async findOne(id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: true,
        items: { include: { service: true, product: true }, orderBy: { order: 'asc' } },
        workOrder: { select: { id: true, number: true, status: true } },
      },
    });
    if (!quote) throw new NotFoundException('Orçamento não encontrado');
    return quote;
  }

  async create(data: any) {
    const { items, ...quoteData } = data;
    const number = await this.nextNumber();
    const total = items?.reduce((s: number, i: any) => s + i.unitPrice * i.quantity, 0) ?? 0;
    return this.prisma.quote.create({
      data: {
        ...quoteData,
        number,
        total,
        items: items ? { create: items.map((i: any, idx: number) => ({ ...i, total: i.unitPrice * i.quantity, order: idx })) } : undefined,
      },
      include: { customer: true, items: true },
    });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    const { items, ...quoteData } = data;
    if (items) {
      await this.prisma.quoteItem.deleteMany({ where: { quoteId: id } });
    }
    const total = items?.reduce((s: number, i: any) => s + i.unitPrice * i.quantity, 0);
    return this.prisma.quote.update({
      where: { id },
      data: {
        ...quoteData,
        ...(total !== undefined && { total }),
        ...(items && { items: { create: items.map((i: any, idx: number) => ({ ...i, total: i.unitPrice * i.quantity, order: idx })) } }),
      },
      include: { customer: true, items: true },
    });
  }

  async approve(id: string) {
    return this.update(id, { status: 'APPROVED' });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.quote.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async convertToWorkOrder(quoteId: string) {
    const quote = await this.findOne(quoteId);

    if (quote.status !== 'APPROVED') {
      throw new BadRequestException('Apenas orçamentos aprovados podem ser convertidos em OS');
    }
    if (quote.workOrder) {
      throw new BadRequestException('Este orçamento já possui uma OS vinculada');
    }

    const last = await this.prisma.workOrder.findFirst({ orderBy: { createdAt: 'desc' } });
    const num = last ? parseInt(last.number.replace('OS-', '')) + 1 : 1;
    const number = `OS-${String(num).padStart(5, '0')}`;

    const wo = await this.prisma.workOrder.create({
      data: {
        number,
        customerId: quote.customerId,
        quoteId: quote.id,
        total: quote.total,
        discount: quote.discount,
        notes: quote.notes,
        items: {
          create: quote.items.map((i, idx) => ({
            type: i.type,
            serviceId: i.serviceId,
            productId: i.productId,
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            total: i.total,
            order: idx,
          })),
        },
      },
      include: { customer: true, items: true },
    });

    // Cria conta a receber automaticamente (vencimento em 30 dias)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const descItems = quote.items.slice(0, 2).map(i => i.description).join(', ');
    await this.prisma.accountReceivable.create({
      data: {
        customerId: quote.customerId,
        workOrderId: wo.id,
        description: `${wo.number} — ${descItems}`,
        amount: quote.total,
        dueDate,
      },
    });

    return wo;
  }
}
