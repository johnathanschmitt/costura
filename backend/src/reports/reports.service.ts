import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { realizedEntries, totals } from '../financial/realized';

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getDashboard() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      totalCustomers,
      openWorkOrders,
      pendingReceivables,
      monthRevenue,
      todaySchedules,
      recentWorkOrders,
      lowStockCount,
      todayDueOrders,
    ] = await Promise.all([
      this.prisma.customer.count({ where: { deletedAt: null } }),
      this.prisma.workOrder.count({ where: { deletedAt: null, status: { notIn: ['DELIVERED', 'CANCELLED'] } } }),
      this.prisma.accountReceivable.aggregate({
        where: {
          status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
          deletedAt: null,
        },
        _sum: { amount: true },
      }),
      // Mesma conta do módulo financeiro: o que entrou de dinheiro no mês.
      realizedEntries(this.prisma, startOfMonth, endOfMonth).then(e => totals(e).income),
      this.prisma.schedule.findMany({
        where: { deletedAt: null, startAt: { gte: startOfDay, lte: endOfDay } },
        include: { customer: { select: { name: true } } },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.workOrder.findMany({
        where: { deletedAt: null, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
        take: 5,
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        include: { customer: { select: { name: true } } },
      }),
      this.prisma.inventory.findMany({ select: { quantity: true, minQuantity: true } })
        .then(rows => rows.filter(r => r.minQuantity !== null && r.quantity <= (r.minQuantity ?? 0)).length),
      this.prisma.workOrder.findMany({
        where: {
          deletedAt: null,
          status: { notIn: ['CANCELLED'] },
          dueDate: { gte: startOfDay, lte: endOfDay },
        },
        include: { customer: { select: { name: true } } },
        orderBy: { priority: 'desc' },
      }),
    ]);

    return {
      totalCustomers,
      openWorkOrders,
      pendingReceivables: pendingReceivables._sum.amount ?? 0,
      monthRevenue,
      todaySchedules,
      recentWorkOrders,
      lowStockCount,
      todayDueOrders,
    };
  }

  /**
   * Receita mês a mês do ano, pela data de cada pagamento — uma venda parcelada
   * aparece em cada mês em que uma parcela foi paga, e não inteira no mês da
   * última. Inclui a venda avulsa lançada direto no caixa.
   */
  async getRevenueByMonth(year: number) {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);

    const entries = await realizedEntries(this.prisma, start, end);
    const months = MONTH_LABELS.map((label, i) => ({ month: i + 1, label, revenue: 0, count: 0 }));

    for (const e of entries) {
      if (e.type !== 'INCOME') continue;
      const m = new Date(e.date).getMonth();
      months[m].revenue += Number(e.amount);
      months[m].count += 1;
    }

    return months;
  }

  /** Ranking pelo que a cliente efetivamente pagou, incluindo pagamento parcial. */
  async getTopCustomers(limit = 10) {
    const payments = await this.prisma.payment.findMany({
      where: { type: 'RECEIVABLE', receivable: { customerId: { not: null } } },
      select: {
        amount: true,
        receivable: {
          select: { customerId: true, customer: { select: { name: true } } },
        },
      },
    });

    const byCustomer = new Map<string, { name: string; total: number; orders: number }>();
    for (const p of payments) {
      const id = p.receivable?.customerId;
      if (!id) continue;
      const entry = byCustomer.get(id) ?? { name: p.receivable?.customer?.name ?? '—', total: 0, orders: 0 };
      entry.total += Number(p.amount);
      entry.orders += 1;
      byCustomer.set(id, entry);
    }

    return [...byCustomer.values()].sort((a, b) => b.total - a.total).slice(0, limit);
  }

  // getIncomeVsExpenses foi removido: somava apenas os lançamentos da gaveta —
  // sem Pix nem cartão — e tratava sangria como despesa e suprimento como
  // receita. Entradas e saídas por período agora só existem em
  // Financeiro → Fluxo de Caixa, que usa o livro de pagamentos.

  async getWorkOrdersByStatus() {
    const statuses = [
      { status: 'PENDING',          label: 'Pendente' },
      { status: 'IN_PROGRESS',      label: 'Em Andamento' },
      { status: 'WAITING_MATERIAL', label: 'Aguard. Material' },
      { status: 'FITTING',          label: 'Prova' },
      { status: 'DONE',             label: 'Concluída' },
      { status: 'DELIVERED',        label: 'Entregue' },
      { status: 'CANCELLED',        label: 'Cancelada' },
    ];

    const counts = await Promise.all(
      statuses.map(s => this.prisma.workOrder.count({ where: { status: s.status as any, deletedAt: null } })),
    );

    return statuses.map((s, i) => ({ ...s, count: counts[i] }));
  }

  async getAvgTicketByMonth(year: number) {
    const monthly = await this.getRevenueByMonth(year);
    return monthly.map(m => ({
      ...m,
      avgTicket: m.count > 0 ? m.revenue / m.count : 0,
    }));
  }

  async getNotifications() {
    const now = new Date();

    const [
      overdueWOs,
      openCashRegister,
      overdueReceivables,
      overduePayables,
      lowStockItems,
    ] = await Promise.all([
      this.prisma.workOrder.findMany({
        where: {
          deletedAt: null,
          status: { notIn: ['DELIVERED', 'CANCELLED'] },
          dueDate: { lt: now },
        },
        select: { id: true, number: true, dueDate: true, customer: { select: { name: true } } },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
      this.prisma.cashRegister.findFirst({
        where: { status: 'OPEN' },
        select: { id: true, openedAt: true },
      }),
      this.prisma.accountReceivable.findMany({
        where: { status: { in: ['PENDING', 'PARTIAL'] }, dueDate: { lt: now } },
        select: { id: true, description: true, amount: true, dueDate: true, customer: { select: { name: true } } },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
      this.prisma.accountPayable.findMany({
        where: { status: { in: ['PENDING', 'PARTIAL'] }, dueDate: { lt: now } },
        select: { id: true, description: true, amount: true, dueDate: true },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
      this.prisma.inventory.findMany({
        select: { quantity: true, minQuantity: true, product: { select: { id: true, name: true } } },
      }).then(rows => rows.filter(r => r.minQuantity !== null && r.quantity <= (r.minQuantity ?? 0))),
    ]);

    const total =
      overdueWOs.length +
      (openCashRegister ? 1 : 0) +
      overdueReceivables.length +
      overduePayables.length +
      lowStockItems.length;

    return {
      total,
      overdueWorkOrders: overdueWOs,
      openCashRegister,
      overdueReceivables,
      overduePayables,
      lowStock: lowStockItems.map(i => ({ ...i.product, quantity: i.quantity, minQuantity: i.minQuantity })),
    };
  }
}
