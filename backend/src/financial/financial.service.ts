import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FinancialService {
  constructor(private prisma: PrismaService) {}

  // ── Caixa ─────────────────────────────────────────────────────────────────

  async openCashRegister(openingBalance: number, notes?: string) {
    const open = await this.prisma.cashRegister.findFirst({ where: { status: 'OPEN' } });
    if (open) throw new BadRequestException('Já existe um caixa aberto');
    return this.prisma.cashRegister.create({ data: { openingBalance, notes } });
  }

  async closeCashRegister(id: string, notes?: string) {
    const register = await this.prisma.cashRegister.findUnique({
      where: { id },
      include: { transactions: true },
    });
    if (!register) throw new NotFoundException('Caixa não encontrado');
    if (register.status === 'CLOSED') throw new BadRequestException('Caixa já fechado');
    const income = register.transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0);
    const expense = register.transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0);
    const closingBalance = Number(register.openingBalance) + income - expense;
    return this.prisma.cashRegister.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date(), closingBalance, notes },
    });
  }

  getCurrentCashRegister() {
    return this.prisma.cashRegister.findFirst({
      where: { status: 'OPEN' },
      include: { _count: { select: { transactions: true } } },
    });
  }

  getCashRegisters(page: any = 1, limit: any = 20) {
    const p = Math.max(1, parseInt(page) || 1);
    const l = Math.min(100, parseInt(limit) || 20);
    return this.prisma.cashRegister.findMany({
      skip: (p - 1) * l,
      take: l,
      orderBy: { openedAt: 'desc' },
      include: { _count: { select: { transactions: true } } },
    });
  }

  addTransaction(cashRegisterId: string, data: any) {
    return this.prisma.cashTransaction.create({ data: { ...data, cashRegisterId } });
  }

  getTransactions(cashRegisterId: string) {
    return this.prisma.cashTransaction.findMany({
      where: { cashRegisterId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Contas a Receber ───────────────────────────────────────────────────────

  async getReceivables(status?: string, page: any = 1, limit: any = 20) {
    await this.markOverdue();
    const p = Math.max(1, parseInt(page) || 1);
    const l = Math.min(100, parseInt(limit) || 20);
    return this.prisma.accountReceivable.findMany({
      where: { deletedAt: null, ...(status && { status: status as any }) },
      skip: (p - 1) * l,
      take: l,
      orderBy: { dueDate: 'asc' },
      include: { customer: { select: { id: true, name: true } } },
    });
  }

  createReceivable(data: any) {
    return this.prisma.accountReceivable.create({ data });
  }

  async payReceivable(id: string, amount: number, method: string) {
    const rec = await this.prisma.accountReceivable.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException();
    const paidAmount = Number(rec.paidAmount) + amount;
    const status = paidAmount >= Number(rec.amount) ? 'PAID' : 'PARTIAL';
    return this.prisma.accountReceivable.update({
      where: { id },
      data: { paidAmount, status: status as any, paidAt: status === 'PAID' ? new Date() : null, paymentMethod: method as any },
    });
  }

  private async markOverdue() {
    const now = new Date();
    await Promise.all([
      this.prisma.accountReceivable.updateMany({
        where: { status: { in: ['PENDING', 'PARTIAL'] }, dueDate: { lt: now }, deletedAt: null },
        data: { status: 'OVERDUE' },
      }),
      this.prisma.accountPayable.updateMany({
        where: { status: { in: ['PENDING', 'PARTIAL'] }, dueDate: { lt: now }, deletedAt: null },
        data: { status: 'OVERDUE' },
      }),
    ]);
  }

  async cancelReceivable(id: string) {
    const rec = await this.prisma.accountReceivable.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('Conta a receber não encontrada');
    return this.prisma.accountReceivable.update({
      where: { id },
      data: { status: 'CANCELLED', deletedAt: new Date() },
    });
  }

  async cancelPayable(id: string) {
    const pay = await this.prisma.accountPayable.findUnique({ where: { id } });
    if (!pay) throw new NotFoundException('Conta a pagar não encontrada');
    return this.prisma.accountPayable.update({
      where: { id },
      data: { status: 'CANCELLED', deletedAt: new Date() },
    });
  }

  // ── Contas a Pagar ─────────────────────────────────────────────────────────

  async getPayables(status?: string, page: any = 1, limit: any = 20) {
    await this.markOverdue();
    const p = Math.max(1, parseInt(page) || 1);
    const l = Math.min(100, parseInt(limit) || 20);
    return this.prisma.accountPayable.findMany({
      where: { deletedAt: null, ...(status && { status: status as any }) },
      skip: (p - 1) * l,
      take: l,
      orderBy: { dueDate: 'asc' },
    });
  }

  createPayable(data: any) {
    return this.prisma.accountPayable.create({ data });
  }

  async payPayable(id: string, amount: number, method: string) {
    const pay = await this.prisma.accountPayable.findUnique({ where: { id } });
    if (!pay) throw new NotFoundException();
    const paidAmount = Number(pay.paidAmount) + amount;
    const status = paidAmount >= Number(pay.amount) ? 'PAID' : 'PARTIAL';
    return this.prisma.accountPayable.update({
      where: { id },
      data: { paidAmount, status: status as any, paidAt: status === 'PAID' ? new Date() : null, paymentMethod: method as any },
    });
  }

  // ── Fluxo de Caixa ─────────────────────────────────────────────────────────

  async getCashFlow(startDate: Date, endDate: Date) {
    const [receivable, payable, transactions] = await Promise.all([
      this.prisma.accountReceivable.aggregate({
        where: { status: 'PAID', paidAt: { gte: startDate, lte: endDate } },
        _sum: { paidAmount: true },
      }),
      this.prisma.accountPayable.aggregate({
        where: { status: 'PAID', paidAt: { gte: startDate, lte: endDate } },
        _sum: { paidAmount: true },
      }),
      this.prisma.cashTransaction.findMany({
        where: { createdAt: { gte: startDate, lte: endDate } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return {
      totalReceived: receivable._sum.paidAmount ?? 0,
      totalPaid: payable._sum.paidAmount ?? 0,
      transactions,
    };
  }
}
