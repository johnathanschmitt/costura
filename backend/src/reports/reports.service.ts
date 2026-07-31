import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getDashboard() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

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
        where: { status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
        _sum: { amount: true },
      }),
      this.prisma.accountReceivable.aggregate({
        where: { status: 'PAID', paidAt: { gte: startOfMonth } },
        _sum: { paidAmount: true },
      }),
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
      monthRevenue: monthRevenue._sum.paidAmount ?? 0,
      todaySchedules,
      recentWorkOrders,
      lowStockCount,
      todayDueOrders,
    };
  }

  async getRevenueByMonth(year: number) {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59);

    const records = await this.prisma.accountReceivable.findMany({
      where: { status: 'PAID', paidAt: { gte: start, lte: end } },
      select: { paidAt: true, paidAmount: true },
    });

    const months = MONTH_LABELS.map((label, i) => ({ month: i + 1, label, revenue: 0, count: 0 }));

    for (const r of records) {
      const m = new Date(r.paidAt!).getMonth();
      months[m].revenue += Number(r.paidAmount);
      months[m].count += 1;
    }

    return months;
  }

  async getTopCustomers(limit = 10) {
    const grouped = await this.prisma.accountReceivable.groupBy({
      by: ['customerId'],
      where: { status: 'PAID', customerId: { not: null } },
      _sum: { paidAmount: true },
      _count: { id: true },
      orderBy: { _sum: { paidAmount: 'desc' } },
      take: limit,
    });

    const ids = grouped.map(r => r.customerId!).filter(Boolean);
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });

    return grouped.map(r => {
      const c = customers.find(x => x.id === r.customerId);
      return {
        name: c?.name ?? '—',
        total: Number(r._sum.paidAmount ?? 0),
        orders: r._count.id,
      };
    });
  }

  async getIncomeVsExpenses(year: number) {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59);

    const transactions = await this.prisma.cashTransaction.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { type: true, amount: true, createdAt: true },
    });

    const months = MONTH_LABELS.map((label, i) => ({ month: i + 1, label, income: 0, expense: 0 }));

    for (const t of transactions) {
      const m = new Date(t.createdAt).getMonth();
      if (t.type === 'INCOME') months[m].income += Number(t.amount);
      else months[m].expense += Number(t.amount);
    }

    return months;
  }

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
