import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async search(q: string) {
    if (!q || q.trim().length < 2) return { customers: [], quotes: [], workOrders: [], services: [] };
    const term = q.trim();
    const contains = (field?: string) => ({ contains: term, mode: 'insensitive' as const });

    const [customers, quotes, workOrders, services] = await Promise.all([
      this.prisma.customer.findMany({
        where: {
          deletedAt: null,
          OR: [{ name: contains() }, { email: contains() }, { phone: contains() }],
        },
        select: { id: true, name: true, phone: true },
        take: 5,
      }),
      this.prisma.quote.findMany({
        where: {
          deletedAt: null,
          OR: [{ number: contains() }, { customer: { name: contains() } }],
        },
        select: { id: true, number: true, status: true, customer: { select: { name: true } } },
        take: 5,
      }),
      this.prisma.workOrder.findMany({
        where: {
          deletedAt: null,
          OR: [{ number: contains() }, { customer: { name: contains() } }],
        },
        select: { id: true, number: true, status: true, customer: { select: { name: true } } },
        take: 5,
      }),
      this.prisma.service.findMany({
        where: { deletedAt: null, name: contains() },
        select: { id: true, name: true, basePrice: true },
        take: 5,
      }),
    ]);

    return { customers, quotes, workOrders, services };
  }
}
