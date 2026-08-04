import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  /**
   * Busca global.
   *
   * Cada seção respeita a permissão de quem procura: a busca não pode virar a
   * porta dos fundos para ver orçamento quem não tem acesso a orçamentos.
   */
  async search(q: string, permissions: string[] = []) {
    if (!q || q.trim().length < 2) return { customers: [], quotes: [], workOrders: [], services: [] };
    const term = q.trim();
    // Sessão antiga, sem a lista de permissões no token, continua vendo tudo —
    // é o comportamento que já existia, e o resto do sistema barra depois.
    const can = (resource: string) =>
      permissions.length === 0 || permissions.includes(`read:${resource}`);
    const contains = (field?: string) => ({ contains: term, mode: 'insensitive' as const });

    const nothing = Promise.resolve([] as any[]);
    const [customers, quotes, workOrders, services] = await Promise.all([
      !can('customers') ? nothing : this.prisma.customer.findMany({
        where: {
          deletedAt: null,
          OR: [{ name: contains() }, { email: contains() }, { phone: contains() }],
        },
        select: { id: true, name: true, phone: true },
        take: 5,
      }),
      !can('quotes') ? nothing : this.prisma.quote.findMany({
        where: {
          deletedAt: null,
          OR: [{ number: contains() }, { customer: { name: contains() } }],
        },
        select: { id: true, number: true, status: true, customer: { select: { name: true } } },
        take: 5,
      }),
      !can('work-orders') ? nothing : this.prisma.workOrder.findMany({
        where: {
          deletedAt: null,
          OR: [{ number: contains() }, { customer: { name: contains() } }],
        },
        select: { id: true, number: true, status: true, customer: { select: { name: true } } },
        take: 5,
      }),
      !can('services') ? nothing : this.prisma.service.findMany({
        where: { deletedAt: null, name: contains() },
        select: { id: true, name: true, basePrice: true },
        take: 5,
      }),
    ]);

    return { customers, quotes, workOrders, services };
  }
}
