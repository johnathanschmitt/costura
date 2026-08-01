import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CategoryType, Prisma, PaymentMethod, Recurrence, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CloseCashRegisterDto, CreateCashTransactionDto, OpenCashRegisterDto,
} from './dto/cash-register.dto';
import {
  CashFlowQueryDto, CreatePayableDto, CreateReceivableDto, ListCashRegistersDto,
  ListPayablesDto, ListReceivablesDto, PayDto,
} from './dto/accounts.dto';
import {
  CashFlowChartQueryDto, CashTransferDto, CashTransferKind, CreateInstallmentsDto,
} from './dto/phase2.dto';
import {
  CreateCategoryDto, DreQueryDto, ListCategoriesDto, UpdateCategoryDto,
} from './dto/categories.dto';
import { MonthlyResultQueryDto } from './dto/monthly.dto';

/** Toda aritmética de dinheiro usa Decimal — `Number` arredonda centavos. */
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const ZERO = D(0);

const brl = (v: Prisma.Decimal.Value) =>
  `R$ ${D(v).toFixed(2).replace('.', ',')}`;

/** Vencimento é por dia: uma conta só vence a partir do dia seguinte. */
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class FinancialService {
  constructor(private prisma: PrismaService) {}

  // ── Caixa (somente dinheiro em espécie) ───────────────────────────────────
  //
  // O caixa representa a gaveta de dinheiro físico. PIX, cartão e transferência
  // não passam por aqui — vão direto para a conta bancária e são registrados
  // apenas como pagamento (ver `Payment`). O fechamento compara o saldo
  // esperado com o dinheiro contado para revelar divergências.

  async openCashRegister(dto: OpenCashRegisterDto) {
    const open = await this.prisma.cashRegister.findFirst({ where: { status: 'OPEN' } });
    if (open) throw new BadRequestException('Já existe um caixa aberto');
    return this.prisma.cashRegister.create({
      data: { openingBalance: D(dto.openingBalance), notes: dto.notes },
    });
  }

  /** Saldo que deveria haver na gaveta: abertura + entradas - saídas. */
  private expectedBalance(
    openingBalance: Prisma.Decimal.Value,
    transactions: { type: TransactionType; amount: Prisma.Decimal }[],
  ) {
    return transactions.reduce(
      (acc, t) => (t.type === 'INCOME' ? acc.plus(t.amount) : acc.minus(t.amount)),
      D(openingBalance),
    );
  }

  async closeCashRegister(id: string, dto: CloseCashRegisterDto) {
    const register = await this.prisma.cashRegister.findUnique({
      where: { id },
      include: { transactions: { select: { type: true, amount: true } } },
    });
    if (!register) throw new NotFoundException('Caixa não encontrado');
    if (register.status === 'CLOSED') throw new BadRequestException('Caixa já fechado');

    const expected = this.expectedBalance(register.openingBalance, register.transactions);
    const counted = D(dto.countedBalance);
    const difference = counted.minus(expected);

    // Divergência sem justificativa é o caso que o fechamento existe para pegar:
    // exigir a observação força a usuária a registrar o que aconteceu.
    if (!difference.isZero() && !dto.notes?.trim()) {
      throw new BadRequestException(
        `Divergência de ${brl(difference.abs())} (${difference.isNegative() ? 'falta' : 'sobra'}). ` +
          'Informe uma observação explicando a diferença para fechar o caixa.',
      );
    }

    return this.prisma.cashRegister.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closingBalance: expected,
        countedBalance: counted,
        difference,
        notes: dto.notes,
      },
    });
  }

  async getCurrentCashRegister() {
    const register = await this.prisma.cashRegister.findFirst({
      where: { status: 'OPEN' },
      include: { transactions: { select: { type: true, amount: true } } },
    });
    if (!register) return null;

    const { transactions, ...rest } = register;
    const income = transactions
      .filter(t => t.type === 'INCOME')
      .reduce((s, t) => s.plus(t.amount), ZERO);
    const expense = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((s, t) => s.plus(t.amount), ZERO);

    // O saldo vem do servidor para não depender de o cliente ter carregado
    // todas as transações antes de somar.
    return {
      ...rest,
      income,
      expense,
      expectedBalance: D(register.openingBalance).plus(income).minus(expense),
      transactionCount: transactions.length,
    };
  }

  async getCashRegisters(query: ListCashRegistersDto) {
    const { page = 1, limit = 20 } = query;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.cashRegister.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { openedAt: 'desc' },
        include: { _count: { select: { transactions: true } } },
      }),
      this.prisma.cashRegister.count(),
    ]);
    return { data, total, page, limit };
  }

  private async requireOpenRegister(cashRegisterId: string) {
    const register = await this.prisma.cashRegister.findUnique({ where: { id: cashRegisterId } });
    if (!register) throw new NotFoundException('Caixa não encontrado');
    if (register.status === 'CLOSED') {
      throw new BadRequestException('Não é possível lançar em um caixa já fechado');
    }
    return register;
  }

  async addTransaction(cashRegisterId: string, dto: CreateCashTransactionDto) {
    await this.requireOpenRegister(cashRegisterId);
    return this.prisma.cashTransaction.create({
      data: {
        cashRegisterId,
        type: dto.type,
        description: dto.description,
        amount: D(dto.amount),
        category: dto.category ?? null,
        paymentMethod: PaymentMethod.CASH,
        kind: dto.type === 'INCOME' ? 'SALE' : 'EXPENSE',
      },
    });
  }

  /**
   * Sangria e suprimento movem dinheiro entre a gaveta e o banco/cofre. Afetam
   * o saldo do caixa, mas não são receita nem despesa — por isso ficam marcados
   * e são excluídos do resultado no fluxo de caixa.
   */
  async transfer(cashRegisterId: string, dto: CashTransferDto) {
    await this.requireOpenRegister(cashRegisterId);
    const isWithdrawal = dto.kind === CashTransferKind.WITHDRAWAL;
    const amount = D(dto.amount);

    if (isWithdrawal) {
      const balance = await this.currentDrawerBalance(cashRegisterId);
      if (amount.gt(balance)) {
        throw new BadRequestException(
          `A sangria de ${brl(amount)} passa do dinheiro em caixa (${brl(balance)})`,
        );
      }
    }

    return this.prisma.cashTransaction.create({
      data: {
        cashRegisterId,
        type: isWithdrawal ? 'EXPENSE' : 'INCOME',
        kind: isWithdrawal ? 'WITHDRAWAL' : 'SUPPLY',
        description: isWithdrawal ? `Sangria — ${dto.reason}` : `Suprimento — ${dto.reason}`,
        category: isWithdrawal ? 'Sangria' : 'Suprimento',
        amount,
        paymentMethod: PaymentMethod.CASH,
      },
    });
  }

  private async currentDrawerBalance(cashRegisterId: string) {
    const register = await this.prisma.cashRegister.findUniqueOrThrow({
      where: { id: cashRegisterId },
      include: { transactions: { select: { type: true, amount: true } } },
    });
    return this.expectedBalance(register.openingBalance, register.transactions);
  }

  async getTransactions(cashRegisterId: string) {
    const register = await this.prisma.cashRegister.findUnique({ where: { id: cashRegisterId } });
    if (!register) throw new NotFoundException('Caixa não encontrado');
    return this.prisma.cashTransaction.findMany({
      where: { cashRegisterId },
      orderBy: { createdAt: 'desc' },
      include: {
        payment: {
          select: {
            type: true,
            receivable: { select: { id: true, description: true } },
            payable: { select: { id: true, description: true } },
          },
        },
      },
    });
  }

  // ── Vencimentos ───────────────────────────────────────────────────────────

  /**
   * Sincroniza o status OVERDUE com a data atual, nos dois sentidos: marca as
   * vencidas e desmarca as que voltaram a estar em dia (vencimento adiado).
   */
  private async markOverdue() {
    const today = startOfToday();
    const overdueWhere = { dueDate: { lt: today }, deletedAt: null };
    const backInTermWhere = { status: 'OVERDUE' as const, dueDate: { gte: today }, deletedAt: null };

    await this.prisma.$transaction([
      this.prisma.accountReceivable.updateMany({
        where: { status: { in: ['PENDING', 'PARTIAL'] }, ...overdueWhere },
        data: { status: 'OVERDUE' },
      }),
      this.prisma.accountPayable.updateMany({
        where: { status: { in: ['PENDING', 'PARTIAL'] }, ...overdueWhere },
        data: { status: 'OVERDUE' },
      }),
      this.prisma.accountReceivable.updateMany({
        where: { ...backInTermWhere, paidAmount: { gt: 0 } },
        data: { status: 'PARTIAL' },
      }),
      this.prisma.accountReceivable.updateMany({
        where: { ...backInTermWhere, paidAmount: { equals: 0 } },
        data: { status: 'PENDING' },
      }),
      this.prisma.accountPayable.updateMany({
        where: { ...backInTermWhere, paidAmount: { gt: 0 } },
        data: { status: 'PARTIAL' },
      }),
      this.prisma.accountPayable.updateMany({
        where: { ...backInTermWhere, paidAmount: { equals: 0 } },
        data: { status: 'PENDING' },
      }),
    ]);
  }

  private static readonly SETTLED = ['PAID', 'CANCELLED'] as const;

  // ── Contas a Receber ──────────────────────────────────────────────────────

  async getReceivables(query: ListReceivablesDto) {
    await this.markOverdue();
    const { page = 1, limit = 20, status, customerId, startDate, endDate } = query;

    const where: Prisma.AccountReceivableWhereInput = {
      deletedAt: null,
      ...(status && { status }),
      ...(customerId && { customerId }),
      ...((startDate || endDate) && {
        dueDate: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        },
      }),
    };
    const openWhere: Prisma.AccountReceivableWhereInput = {
      ...where,
      status: { notIn: [...FinancialService.SETTLED] },
    };

    const [data, total, totals, openTotals, overdue] = await this.prisma.$transaction([
      this.prisma.accountReceivable.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { dueDate: 'asc' },
        include: { customer: { select: { id: true, name: true } } },
      }),
      this.prisma.accountReceivable.count({ where }),
      this.prisma.accountReceivable.aggregate({ where, _sum: { amount: true, paidAmount: true } }),
      this.prisma.accountReceivable.aggregate({
        where: openWhere,
        _sum: { amount: true, paidAmount: true },
      }),
      this.prisma.accountReceivable.aggregate({
        where: { ...where, status: 'OVERDUE' },
        _count: true,
        _sum: { amount: true, paidAmount: true },
      }),
    ]);

    // Os totais somam o filtro inteiro, não apenas a página exibida.
    return {
      data,
      total,
      page,
      limit,
      summary: {
        totalAmount: totals._sum.amount ?? ZERO,
        totalReceived: totals._sum.paidAmount ?? ZERO,
        totalOpen: D(openTotals._sum.amount ?? 0).minus(openTotals._sum.paidAmount ?? 0),
        overdueCount: overdue._count,
        overdueAmount: D(overdue._sum.amount ?? 0).minus(overdue._sum.paidAmount ?? 0),
      },
    };
  }

  createReceivable(dto: CreateReceivableDto) {
    return this.prisma.accountReceivable.create({
      data: {
        description: dto.description,
        amount: D(dto.amount),
        dueDate: new Date(dto.dueDate),
        customerId: dto.customerId ?? null,
        workOrderId: dto.workOrderId ?? null,
        notes: dto.notes ?? null,
      },
    });
  }

  /**
   * Cria a venda parcelada: opcionalmente um sinal quitado na hora e N parcelas
   * mensais. A divisão joga os centavos da sobra na primeira parcela, para que
   * a soma feche exatamente com o total.
   */
  async createInstallments(dto: CreateInstallmentsDto) {
    const total = D(dto.amount);
    const down = D(dto.downPayment ?? 0);
    if (down.gt(total)) {
      throw new BadRequestException(`O sinal não pode passar do total de ${brl(total)}`);
    }
    if (down.gt(0) && !dto.downPaymentMethod) {
      throw new BadRequestException('Informe a forma de pagamento do sinal');
    }

    const financed = total.minus(down);
    const count = dto.installments;
    if (financed.isZero() && down.gt(0)) {
      throw new BadRequestException('O sinal cobre o total — não há o que parcelar');
    }

    // Arredonda para baixo e devolve a diferença à primeira parcela.
    const base = financed.dividedBy(count).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
    const remainder = financed.minus(base.times(count));

    const groupId = randomUUID();
    const firstDue = new Date(dto.firstDueDate);

    const created = await this.prisma.$transaction(async tx => {
      let downId: string | null = null;

      if (down.gt(0)) {
        const rec = await tx.accountReceivable.create({
          data: {
            description: `${dto.description} — sinal`,
            amount: down,
            dueDate: new Date(),
            customerId: dto.customerId ?? null,
            workOrderId: dto.workOrderId ?? null,
            notes: dto.notes ?? null,
            installmentGroupId: groupId,
            isDownPayment: true,
          },
          select: { id: true },
        });
        downId = rec.id;
      }

      for (let i = 0; i < count; i++) {
        const dueDate = new Date(firstDue);
        dueDate.setMonth(dueDate.getMonth() + i);
        await tx.accountReceivable.create({
          data: {
            description: `${dto.description} — parcela ${i + 1}/${count}`,
            amount: i === 0 ? base.plus(remainder) : base,
            dueDate,
            customerId: dto.customerId ?? null,
            workOrderId: dto.workOrderId ?? null,
            notes: dto.notes ?? null,
            installmentGroupId: groupId,
            installmentNumber: i + 1,
            installmentTotal: count,
          },
        });
      }

      return downId;
    });

    // A baixa do sinal passa pelo fluxo normal, para gerar o pagamento e o
    // lançamento no caixa quando for em dinheiro.
    if (created && dto.downPaymentMethod) {
      await this.payReceivable(created, { amount: down.toNumber(), method: dto.downPaymentMethod });
    }

    return this.prisma.accountReceivable.findMany({
      where: { installmentGroupId: groupId },
      orderBy: [{ isDownPayment: 'desc' }, { installmentNumber: 'asc' }],
    });
  }

  /**
   * Baixa de conta a receber. Grava no livro de pagamentos e, quando a baixa é
   * em espécie, lança a entrada no caixa aberto — tudo numa única transação,
   * para que conta, livro e caixa nunca fiquem fora de sincronia.
   */
  async payReceivable(id: string, dto: PayDto) {
    return this.prisma.$transaction(async tx => {
      const rec = await tx.accountReceivable.findFirst({ where: { id, deletedAt: null } });
      if (!rec) throw new NotFoundException('Conta a receber não encontrada');
      if (rec.status === 'CANCELLED') {
        throw new BadRequestException('Conta cancelada não aceita recebimento');
      }
      if (rec.status === 'PAID') throw new BadRequestException('Conta já está quitada');

      const amount = D(dto.amount);
      const remaining = D(rec.amount).minus(rec.paidAmount);
      if (amount.gt(remaining)) {
        throw new BadRequestException(
          `Valor excede o saldo em aberto de ${brl(remaining)}`,
        );
      }

      const cashTransaction = await this.registerCashMovement(tx, {
        method: dto.method,
        type: 'INCOME',
        amount,
        description: `Recebimento: ${rec.description}`,
        category: 'Contas a receber',
        referenceId: rec.id,
        referenceType: 'ACCOUNT_RECEIVABLE',
      });

      await tx.payment.create({
        data: {
          type: 'RECEIVABLE',
          receivableId: rec.id,
          amount,
          method: dto.method,
          notes: dto.notes ?? null,
          cashTransactionId: cashTransaction?.id ?? null,
          ...this.changeFor(dto, amount),
        },
      });

      const paidAmount = D(rec.paidAmount).plus(amount);
      const settled = paidAmount.gte(rec.amount);
      return tx.accountReceivable.update({
        where: { id },
        data: {
          paidAmount,
          status: settled ? 'PAID' : 'PARTIAL',
          paidAt: settled ? new Date() : null,
          paymentMethod: dto.method,
        },
      });
    });
  }

  async cancelReceivable(id: string) {
    const rec = await this.prisma.accountReceivable.findFirst({ where: { id, deletedAt: null } });
    if (!rec) throw new NotFoundException('Conta a receber não encontrada');
    if (rec.status === 'PAID') {
      throw new BadRequestException('Conta já quitada não pode ser cancelada');
    }
    if (rec.status === 'CANCELLED') throw new BadRequestException('Conta já está cancelada');
    // Cancelar não apaga: a conta continua visível com status CANCELLED, senão
    // o filtro "Cancelado" nunca traria resultado e o histórico sumiria.
    return this.prisma.accountReceivable.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  // ── Contas a Pagar ────────────────────────────────────────────────────────

  async getPayables(query: ListPayablesDto) {
    await this.markOverdue();
    const { page = 1, limit = 20, status, category, startDate, endDate } = query;

    const where: Prisma.AccountPayableWhereInput = {
      deletedAt: null,
      ...(status && { status }),
      ...(category && { category }),
      ...((startDate || endDate) && {
        dueDate: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        },
      }),
    };
    const openWhere: Prisma.AccountPayableWhereInput = {
      ...where,
      status: { notIn: [...FinancialService.SETTLED] },
    };

    const [data, total, totals, openTotals, overdue] = await this.prisma.$transaction([
      this.prisma.accountPayable.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.accountPayable.count({ where }),
      this.prisma.accountPayable.aggregate({ where, _sum: { amount: true, paidAmount: true } }),
      this.prisma.accountPayable.aggregate({
        where: openWhere,
        _sum: { amount: true, paidAmount: true },
      }),
      this.prisma.accountPayable.aggregate({
        where: { ...where, status: 'OVERDUE' },
        _count: true,
        _sum: { amount: true, paidAmount: true },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      summary: {
        totalAmount: totals._sum.amount ?? ZERO,
        totalPaid: totals._sum.paidAmount ?? ZERO,
        totalOpen: D(openTotals._sum.amount ?? 0).minus(openTotals._sum.paidAmount ?? 0),
        overdueCount: overdue._count,
        overdueAmount: D(overdue._sum.amount ?? 0).minus(overdue._sum.paidAmount ?? 0),
      },
    };
  }

  createPayable(dto: CreatePayableDto) {
    return this.prisma.accountPayable.create({
      data: {
        description: dto.description,
        amount: D(dto.amount),
        dueDate: new Date(dto.dueDate),
        supplier: dto.supplier ?? null,
        category: dto.category ?? null,
        recurrence: dto.recurrence ?? 'NONE',
        notes: dto.notes ?? null,
      },
    });
  }

  /**
   * Materializa as próximas ocorrências das despesas recorrentes até o horizonte
   * pedido. Idempotente: só cria a ocorrência de um vencimento que ainda não
   * existe, então pode rodar a cada abertura da tela sem duplicar.
   */
  async generateRecurrences(monthsAhead = 3) {
    const horizon = new Date();
    horizon.setMonth(horizon.getMonth() + monthsAhead);

    const templates = await this.prisma.accountPayable.findMany({
      where: { recurrence: { not: 'NONE' }, parentId: null, deletedAt: null },
      include: { occurrences: { select: { dueDate: true } } },
    });

    const toCreate: Prisma.AccountPayableCreateManyInput[] = [];

    for (const t of templates) {
      const step = t.recurrence === Recurrence.MONTHLY ? 'month' : 'year';
      const existing = new Set(t.occurrences.map(o => o.dueDate.toISOString().slice(0, 10)));
      existing.add(t.dueDate.toISOString().slice(0, 10));

      const cursor = new Date(t.dueDate);
      // Limite de segurança: 120 iterações cobrem 10 anos de mensal.
      for (let i = 0; i < 120; i++) {
        if (step === 'month') cursor.setMonth(cursor.getMonth() + 1);
        else cursor.setFullYear(cursor.getFullYear() + 1);
        if (cursor > horizon) break;

        const key = cursor.toISOString().slice(0, 10);
        if (existing.has(key)) continue;
        existing.add(key);

        toCreate.push({
          description: t.description,
          amount: t.amount,
          dueDate: new Date(cursor),
          supplier: t.supplier,
          category: t.category,
          notes: t.notes,
          parentId: t.id,
          recurrence: 'NONE',
        });
      }
    }

    if (toCreate.length === 0) return { created: 0 };
    const result = await this.prisma.accountPayable.createMany({ data: toCreate });
    return { created: result.count };
  }

  async payPayable(id: string, dto: PayDto) {
    return this.prisma.$transaction(async tx => {
      const pay = await tx.accountPayable.findFirst({ where: { id, deletedAt: null } });
      if (!pay) throw new NotFoundException('Conta a pagar não encontrada');
      if (pay.status === 'CANCELLED') {
        throw new BadRequestException('Conta cancelada não aceita pagamento');
      }
      if (pay.status === 'PAID') throw new BadRequestException('Conta já está quitada');

      const amount = D(dto.amount);
      const remaining = D(pay.amount).minus(pay.paidAmount);
      if (amount.gt(remaining)) {
        throw new BadRequestException(`Valor excede o saldo em aberto de ${brl(remaining)}`);
      }

      const cashTransaction = await this.registerCashMovement(tx, {
        method: dto.method,
        type: 'EXPENSE',
        amount,
        description: `Pagamento: ${pay.description}`,
        category: pay.category ?? 'Contas a pagar',
        referenceId: pay.id,
        referenceType: 'ACCOUNT_PAYABLE',
      });

      await tx.payment.create({
        data: {
          type: 'PAYABLE',
          payableId: pay.id,
          amount,
          method: dto.method,
          notes: dto.notes ?? null,
          cashTransactionId: cashTransaction?.id ?? null,
          ...this.changeFor(dto, amount),
        },
      });

      const paidAmount = D(pay.paidAmount).plus(amount);
      const settled = paidAmount.gte(pay.amount);
      return tx.accountPayable.update({
        where: { id },
        data: {
          paidAmount,
          status: settled ? 'PAID' : 'PARTIAL',
          paidAt: settled ? new Date() : null,
          paymentMethod: dto.method,
        },
      });
    });
  }

  async cancelPayable(id: string) {
    const pay = await this.prisma.accountPayable.findFirst({ where: { id, deletedAt: null } });
    if (!pay) throw new NotFoundException('Conta a pagar não encontrada');
    if (pay.status === 'PAID') {
      throw new BadRequestException('Conta já quitada não pode ser cancelada');
    }
    if (pay.status === 'CANCELLED') throw new BadRequestException('Conta já está cancelada');
    return this.prisma.accountPayable.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  /**
   * Espelha uma baixa em espécie no caixa aberto. Outras formas de pagamento
   * não tocam a gaveta e retornam null.
   */
  /**
   * Troco: só existe em dinheiro. Guardamos o que a cliente entregou e a
   * diferença, para o comprovante e a conferência do caixa.
   */
  private changeFor(dto: PayDto, amount: Prisma.Decimal) {
    if (dto.method !== PaymentMethod.CASH || dto.amountTendered === undefined) return {};
    const given = D(dto.amountTendered);
    if (given.lt(amount)) {
      throw new BadRequestException(
        `O valor entregue (${brl(given)}) é menor que a baixa de ${brl(amount)}`,
      );
    }
    return { amountTendered: given, changeGiven: given.minus(amount) };
  }

  private async registerCashMovement(
    tx: Prisma.TransactionClient,
    move: {
      method: PaymentMethod;
      type: TransactionType;
      amount: Prisma.Decimal;
      description: string;
      category: string;
      referenceId: string;
      referenceType: string;
    },
  ) {
    if (move.method !== PaymentMethod.CASH) return null;

    const register = await tx.cashRegister.findFirst({ where: { status: 'OPEN' } });
    if (!register) {
      throw new BadRequestException(
        'Não há caixa aberto. Abra o caixa para registrar movimentações em dinheiro.',
      );
    }
    return tx.cashTransaction.create({
      data: {
        cashRegisterId: register.id,
        type: move.type,
        description: move.description,
        category: move.category,
        amount: move.amount,
        paymentMethod: PaymentMethod.CASH,
        kind: 'ACCOUNT',
        referenceId: move.referenceId,
        referenceType: move.referenceType,
      },
    });
  }

  // ── Fluxo de Caixa ────────────────────────────────────────────────────────

  /**
   * Realizado no período, a partir do livro de pagamentos (datado por baixa) e
   * dos lançamentos avulsos do caixa. Baixas em espécie geram as duas coisas,
   * então os avulsos são filtrados por `payment: null` para não contar duas vezes.
   */
  async getCashFlow(query: CashFlowQueryDto) {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('A data final deve ser posterior à data inicial');
    }
    const period = { gte: startDate, lte: endDate };

    const [received, paid, byMethod, directCash, payments] = await this.prisma.$transaction([
      this.prisma.payment.aggregate({
        where: { type: 'RECEIVABLE', paidAt: period },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { type: 'PAYABLE', paidAt: period },
        _sum: { amount: true },
      }),
      this.prisma.payment.groupBy({
        by: ['method'],
        where: { type: 'RECEIVABLE', paidAt: period },
        _sum: { amount: true },
        orderBy: { method: 'asc' },
      }),
      // Sangria e suprimento movem dinheiro entre gaveta e banco: mexem no
      // saldo do caixa, mas não são receita nem despesa do ateliê.
      this.prisma.cashTransaction.findMany({
        where: { createdAt: period, payment: null, kind: { notIn: ['WITHDRAWAL', 'SUPPLY'] } },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      this.prisma.payment.findMany({
        where: { paidAt: period },
        orderBy: { paidAt: 'desc' },
        take: 500,
        include: {
          receivable: {
            select: { description: true, customer: { select: { name: true } } },
          },
          payable: { select: { description: true, supplier: true, category: true } },
        },
      }),
    ]);

    const directIncome = directCash
      .filter(t => t.type === 'INCOME')
      .reduce((s, t) => s.plus(t.amount), ZERO);
    const directExpense = directCash
      .filter(t => t.type === 'EXPENSE')
      .reduce((s, t) => s.plus(t.amount), ZERO);

    const totalReceived = D(received._sum.amount ?? 0).plus(directIncome);
    const totalPaid = D(paid._sum.amount ?? 0).plus(directExpense);

    // Extrato unificado: baixas de contas + lançamentos avulsos do caixa.
    const entries = [
      ...payments.map(p => ({
        id: p.id,
        date: p.paidAt,
        type: p.type === 'RECEIVABLE' ? 'INCOME' : 'EXPENSE',
        description:
          p.type === 'RECEIVABLE'
            ? p.receivable?.description ?? 'Recebimento'
            : p.payable?.description ?? 'Pagamento',
        party: p.receivable?.customer?.name ?? p.payable?.supplier ?? null,
        category: p.payable?.category ?? (p.type === 'RECEIVABLE' ? 'Contas a receber' : 'Contas a pagar'),
        method: p.method,
        amount: p.amount,
        source: 'ACCOUNT' as const,
      })),
      ...directCash.map(t => ({
        id: t.id,
        date: t.createdAt,
        type: t.type as string,
        description: t.description,
        party: null,
        category: t.category,
        method: t.paymentMethod,
        amount: t.amount,
        source: 'CASH' as const,
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    return {
      totalReceived,
      totalPaid,
      balance: totalReceived.minus(totalPaid),
      breakdown: {
        fromAccountsReceivable: received._sum.amount ?? ZERO,
        fromDirectCash: directIncome,
        toAccountsPayable: paid._sum.amount ?? ZERO,
        fromDirectCashExpense: directExpense,
      },
      receivedByMethod: byMethod.map(m => ({ method: m.method, amount: m._sum?.amount ?? ZERO })),
      entries,
    };
  }

  /**
   * Série para o gráfico: realizado por período, mais o previsto das contas
   * ainda em aberto, e a linha de saldo acumulado projetado.
   */
  async getCashFlowChart(query: CashFlowChartQueryDto) {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('A data final deve ser posterior à data inicial');
    }
    const groupBy = query.groupBy ?? 'month';
    const period = { gte: startDate, lte: endDate };

    const [payments, directCash, openReceivables, openPayables] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where: { paidAt: period },
        select: { type: true, amount: true, paidAt: true, payable: { select: { category: true } } },
      }),
      this.prisma.cashTransaction.findMany({
        where: { createdAt: period, payment: null, kind: { notIn: ['WITHDRAWAL', 'SUPPLY'] } },
        select: { type: true, amount: true, createdAt: true, category: true },
      }),
      this.prisma.accountReceivable.findMany({
        where: { status: { notIn: ['PAID', 'CANCELLED'] }, deletedAt: null, dueDate: period },
        select: { amount: true, paidAmount: true, dueDate: true },
      }),
      this.prisma.accountPayable.findMany({
        where: { status: { notIn: ['PAID', 'CANCELLED'] }, deletedAt: null, dueDate: period },
        select: { amount: true, paidAmount: true, dueDate: true, category: true },
      }),
    ]);

    const bucketKey = (d: Date) => {
      const date = new Date(d);
      if (groupBy === 'month') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      // Semana identificada pelo domingo que a inicia.
      const sunday = new Date(date);
      sunday.setDate(date.getDate() - date.getDay());
      sunday.setHours(0, 0, 0, 0);
      return sunday.toISOString().slice(0, 10);
    };

    type Bucket = { key: string; income: Prisma.Decimal; expense: Prisma.Decimal; plannedIn: Prisma.Decimal; plannedOut: Prisma.Decimal };
    const buckets = new Map<string, Bucket>();
    const bucket = (k: string) => {
      if (!buckets.has(k)) {
        buckets.set(k, { key: k, income: ZERO, expense: ZERO, plannedIn: ZERO, plannedOut: ZERO });
      }
      return buckets.get(k)!;
    };

    const matchesCategory = (c?: string | null) => !query.category || c === query.category;

    for (const p of payments) {
      if (p.type === 'PAYABLE' && !matchesCategory(p.payable?.category)) continue;
      if (p.type === 'RECEIVABLE' && query.category) continue;
      const b = bucket(bucketKey(p.paidAt));
      if (p.type === 'RECEIVABLE') b.income = b.income.plus(p.amount);
      else b.expense = b.expense.plus(p.amount);
    }
    for (const t of directCash) {
      if (!matchesCategory(t.category)) continue;
      const b = bucket(bucketKey(t.createdAt));
      if (t.type === 'INCOME') b.income = b.income.plus(t.amount);
      else b.expense = b.expense.plus(t.amount);
    }
    if (!query.category) {
      for (const r of openReceivables) {
        const b = bucket(bucketKey(r.dueDate));
        b.plannedIn = b.plannedIn.plus(D(r.amount).minus(r.paidAmount));
      }
    }
    for (const p of openPayables) {
      if (!matchesCategory(p.category)) continue;
      const b = bucket(bucketKey(p.dueDate));
      b.plannedOut = b.plannedOut.plus(D(p.amount).minus(p.paidAmount));
    }

    let running = ZERO;
    const series = [...buckets.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(b => {
        const result = b.income.minus(b.expense);
        // A projeção soma o previsto ao realizado, acumulando período a período.
        running = running.plus(result).plus(b.plannedIn).minus(b.plannedOut);
        return {
          key: b.key,
          income: b.income,
          expense: b.expense,
          result,
          plannedIn: b.plannedIn,
          plannedOut: b.plannedOut,
          projectedBalance: running,
        };
      });

    const realized = series.filter(s => !s.income.isZero() || !s.expense.isZero());
    // Com um único período realizado, "melhor" e "pior" seriam o mesmo mês —
    // um par que não compara nada. Só há extremos a partir de dois.
    const hasExtremes = realized.length >= 2;
    const best = hasExtremes
      ? realized.reduce((acc, s) => (s.result.gt(acc.result) ? s : acc))
      : null;
    const worst = hasExtremes
      ? realized.reduce((acc, s) => (s.result.lt(acc.result) ? s : acc))
      : null;

    const totalIncome = series.reduce((s, b) => s.plus(b.income), ZERO);
    const totalExpense = series.reduce((s, b) => s.plus(b.expense), ZERO);
    const plannedIn = series.reduce((s, b) => s.plus(b.plannedIn), ZERO);
    const plannedOut = series.reduce((s, b) => s.plus(b.plannedOut), ZERO);

    return {
      groupBy,
      series,
      totals: {
        income: totalIncome,
        expense: totalExpense,
        result: totalIncome.minus(totalExpense),
        plannedIn,
        plannedOut,
        projectedResult: totalIncome.minus(totalExpense).plus(plannedIn).minus(plannedOut),
      },
      best: best ? { key: best.key, result: best.result } : null,
      worst: worst ? { key: worst.key, result: worst.result } : null,
    };
  }

  /** Dados do relatório de fechamento do caixa. */
  async getClosingReport(id: string) {
    const register = await this.prisma.cashRegister.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { createdAt: 'asc' },
          include: { payment: { select: { method: true, type: true } } },
        },
      },
    });
    if (!register) throw new NotFoundException('Caixa não encontrado');
    if (register.status !== 'CLOSED') {
      throw new BadRequestException('O relatório de fechamento só existe após o caixa ser fechado');
    }

    const transactions = register.transactions;
    const sum = (filter: (t: (typeof transactions)[number]) => boolean) =>
      transactions.filter(filter).reduce((s, t) => s.plus(t.amount), ZERO);

    const business = await this.prisma.businessInfo.findFirst();
    return {
      register,
      business,
      breakdown: {
        sales: sum(t => t.kind === 'SALE'),
        fromAccounts: sum(t => t.kind === 'ACCOUNT' && t.type === 'INCOME'),
        supplies: sum(t => t.kind === 'SUPPLY'),
        expenses: sum(t => t.kind === 'EXPENSE'),
        paidAccounts: sum(t => t.kind === 'ACCOUNT' && t.type === 'EXPENSE'),
        withdrawals: sum(t => t.kind === 'WITHDRAWAL'),
      },
    };
  }

  /** Comprovante de um pagamento. */
  async getPaymentReceipt(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        receivable: { include: { customer: { select: { id: true, name: true, cpf: true, phone: true } } } },
        payable: true,
      },
    });
    if (!payment) throw new NotFoundException('Pagamento não encontrado');
    const business = await this.prisma.businessInfo.findFirst();
    return { payment, business };
  }

  // ── Categorias e DRE (US-34) ──────────────────────────────────────────────

  /** Categorias que já existem no sistema desde sempre, criadas na primeira consulta. */
  private static readonly DEFAULT_CATEGORIES: { name: string; type: CategoryType }[] = [
    { name: 'Costura', type: 'INCOME' },
    { name: 'Ajuste', type: 'INCOME' },
    { name: 'Bordado', type: 'INCOME' },
    { name: 'Venda de Material', type: 'INCOME' },
    { name: 'Aluguel', type: 'EXPENSE' },
    { name: 'Salários', type: 'EXPENSE' },
    { name: 'Materiais', type: 'EXPENSE' },
    { name: 'Marketing', type: 'EXPENSE' },
    { name: 'Outros', type: 'EXPENSE' },
  ];

  async listCategories(query: ListCategoriesDto = {}) {
    const total = await this.prisma.financialCategory.count();
    if (total === 0) {
      await this.prisma.financialCategory.createMany({
        data: FinancialService.DEFAULT_CATEGORIES.map(c => ({ ...c, isSystem: true })),
        skipDuplicates: true,
      });
    }
    return this.prisma.financialCategory.findMany({
      where: { ...(query.type && { type: query.type }) },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    const exists = await this.prisma.financialCategory.findUnique({
      where: { name_type: { name: dto.name, type: dto.type } },
    });
    if (exists) throw new BadRequestException('Já existe uma categoria com esse nome e tipo');
    return this.prisma.financialCategory.create({ data: dto });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.financialCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Categoria não encontrada');
    if (category.isSystem && dto.name && dto.name !== category.name) {
      throw new BadRequestException('Categoria padrão do sistema não pode ser renomeada');
    }
    return this.prisma.financialCategory.update({ where: { id }, data: dto });
  }

  async removeCategory(id: string) {
    const category = await this.prisma.financialCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Categoria não encontrada');
    if (category.isSystem) {
      throw new BadRequestException('Categoria padrão do sistema não pode ser removida — desative-a');
    }
    // Lançamentos guardam o nome da categoria, então remover não órfã ninguém;
    // ainda assim avisamos quantos usam, para a decisão ser consciente.
    const inUse = await this.prisma.accountPayable.count({
      where: { category: category.name, deletedAt: null },
    });
    await this.prisma.financialCategory.delete({ where: { id } });
    return { removed: true, affectedEntries: inUse };
  }

  /**
   * DRE: receitas e despesas do período agrupadas por categoria. As baixas de
   * contas trazem a categoria da conta; os lançamentos avulsos do caixa, a que
   * foi digitada. Transferências ficam de fora — não são resultado.
   */
  async getDre(query: DreQueryDto) {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('A data final deve ser posterior à data inicial');
    }
    const period = { gte: startDate, lte: endDate };

    const [payments, directCash] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where: { paidAt: period },
        select: {
          type: true,
          amount: true,
          receivable: { select: { category: true } },
          payable: { select: { category: true } },
        },
      }),
      this.prisma.cashTransaction.findMany({
        where: { createdAt: period, payment: null, kind: { notIn: ['WITHDRAWAL', 'SUPPLY'] } },
        select: { type: true, amount: true, category: true },
      }),
    ]);

    const income = new Map<string, Prisma.Decimal>();
    const expense = new Map<string, Prisma.Decimal>();
    const add = (map: Map<string, Prisma.Decimal>, key: string | null, value: Prisma.Decimal.Value) =>
      map.set(key || 'Sem categoria', (map.get(key || 'Sem categoria') ?? ZERO).plus(value));

    for (const p of payments) {
      if (p.type === 'RECEIVABLE') add(income, p.receivable?.category ?? null, p.amount);
      else add(expense, p.payable?.category ?? null, p.amount);
    }
    for (const t of directCash) {
      if (t.type === 'INCOME') add(income, t.category, t.amount);
      else add(expense, t.category, t.amount);
    }

    const toRows = (map: Map<string, Prisma.Decimal>, total: Prisma.Decimal) =>
      [...map.entries()]
        .map(([category, amount]) => ({
          category,
          amount,
          share: total.isZero() ? ZERO : amount.dividedBy(total).times(100).toDecimalPlaces(1),
        }))
        .sort((a, b) => b.amount.comparedTo(a.amount));

    const totalIncome = [...income.values()].reduce((s, v) => s.plus(v), ZERO);
    const totalExpense = [...expense.values()].reduce((s, v) => s.plus(v), ZERO);
    const result = totalIncome.minus(totalExpense);

    return {
      income: toRows(income, totalIncome),
      expense: toRows(expense, totalExpense),
      totals: {
        income: totalIncome,
        expense: totalExpense,
        result,
        margin: totalIncome.isZero() ? ZERO : result.dividedBy(totalIncome).times(100).toDecimalPlaces(1),
      },
    };
  }

  // ── Resultado do mês ──────────────────────────────────────────────────────

  /** Receitas e despesas realizadas num intervalo, agrupadas por categoria. */
  private async realizedIn(start: Date, end: Date) {
    const period = { gte: start, lte: end };
    const [payments, directCash] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where: { paidAt: period },
        select: {
          type: true,
          amount: true,
          receivable: { select: { category: true } },
          payable: { select: { category: true } },
        },
      }),
      // Sangria e suprimento são transferências: não entram no resultado.
      this.prisma.cashTransaction.findMany({
        where: { createdAt: period, payment: null, kind: { notIn: ['WITHDRAWAL', 'SUPPLY'] } },
        select: { type: true, amount: true, category: true },
      }),
    ]);

    const income = new Map<string, Prisma.Decimal>();
    const expense = new Map<string, Prisma.Decimal>();
    const add = (m: Map<string, Prisma.Decimal>, k: string | null, v: Prisma.Decimal.Value) => {
      const key = k || 'Sem categoria';
      m.set(key, (m.get(key) ?? ZERO).plus(v));
    };

    for (const p of payments) {
      if (p.type === 'RECEIVABLE') add(income, p.receivable?.category ?? null, p.amount);
      else add(expense, p.payable?.category ?? null, p.amount);
    }
    for (const t of directCash) {
      if (t.type === 'INCOME') add(income, t.category, t.amount);
      else add(expense, t.category, t.amount);
    }

    const total = (m: Map<string, Prisma.Decimal>) =>
      [...m.values()].reduce((s, v) => s.plus(v), ZERO);

    const totalIncome = total(income);
    const totalExpense = total(expense);
    return {
      income,
      expense,
      totalIncome,
      totalExpense,
      result: totalIncome.minus(totalExpense),
    };
  }

  private monthBounds(month?: string) {
    const base = month ? new Date(`${month}-01T00:00:00`) : new Date();
    const start = new Date(base.getFullYear(), base.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end, key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}` };
  }

  /** Variação percentual entre dois períodos; null quando não há base de comparação. */
  private variation(current: Prisma.Decimal, previous: Prisma.Decimal) {
    if (previous.isZero()) return null;
    return current.minus(previous).dividedBy(previous.abs()).times(100).toDecimalPlaces(1);
  }

  /**
   * Painel do mês: o realizado comparado ao mês anterior, o rateio de cada real
   * recebido, os indicadores do negócio e o histórico para fechamento.
   */
  async getMonthlyResult(query: MonthlyResultQueryDto) {
    const { start, end, key } = this.monthBounds(query.month);
    const prev = this.monthBounds(
      `${new Date(start.getFullYear(), start.getMonth() - 1, 1).getFullYear()}-${String(
        new Date(start.getFullYear(), start.getMonth() - 1, 1).getMonth() + 1,
      ).padStart(2, '0')}`,
    );

    const [current, previous] = await Promise.all([
      this.realizedIn(start, end),
      this.realizedIn(prev.start, prev.end),
    ]);

    // ── Rateio: quanto de cada real recebido foi para cada destino ──
    const share = (v: Prisma.Decimal) =>
      current.totalIncome.isZero() ? ZERO : v.dividedBy(current.totalIncome).times(100).toDecimalPlaces(1);

    type Allocation = {
      category: string;
      amount: Prisma.Decimal;
      share: Prisma.Decimal;
      kind: 'EXPENSE' | 'PROFIT';
    };
    const allocation: Allocation[] = [...current.expense.entries()]
      .map(([category, amount]) => ({ category, amount, share: share(amount), kind: 'EXPENSE' as const }))
      .sort((a, b) => b.amount.comparedTo(a.amount));

    if (current.result.gt(0)) {
      allocation.push({
        category: 'Sobra (lucro)',
        amount: current.result,
        share: share(current.result),
        kind: 'PROFIT',
      });
    }

    // ── Indicadores do mês ──
    const [delivered, quotesCreated, quotesConverted] = await this.prisma.$transaction([
      this.prisma.workOrder.findMany({
        where: { deletedAt: null, status: 'DELIVERED', deliveredAt: { gte: start, lte: end } },
        select: {
          id: true, total: true, discount: true,
          assignedTo: { select: { id: true, name: true } },
        },
      }),
      this.prisma.quote.count({ where: { deletedAt: null, createdAt: { gte: start, lte: end } } }),
      this.prisma.quote.count({
        where: { deletedAt: null, createdAt: { gte: start, lte: end }, workOrder: { isNot: null } },
      }),
    ]);

    const deliveredValue = delivered.reduce((s, w) => s.plus(D(w.total).minus(w.discount)), ZERO);
    const bySeamstress = new Map<string, { name: string; count: number; value: Prisma.Decimal }>();
    for (const w of delivered) {
      const id = w.assignedTo?.id ?? 'none';
      const entry = bySeamstress.get(id) ?? {
        name: w.assignedTo?.name ?? 'Sem costureira',
        count: 0,
        value: ZERO,
      };
      entry.count += 1;
      entry.value = entry.value.plus(D(w.total).minus(w.discount));
      bySeamstress.set(id, entry);
    }

    // ── Histórico dos últimos meses, para o fechamento ──
    const months = query.historyMonths ?? 12;
    const history: {
      key: string; income: Prisma.Decimal; expense: Prisma.Decimal; result: Prisma.Decimal;
    }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const m = new Date(start.getFullYear(), start.getMonth() - i, 1);
      const b = this.monthBounds(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
      const r = await this.realizedIn(b.start, b.end);
      history.push({ key: b.key, income: r.totalIncome, expense: r.totalExpense, result: r.result });
    }

    const toRows = (m: Map<string, Prisma.Decimal>, total: Prisma.Decimal) =>
      [...m.entries()]
        .map(([category, amount]) => ({
          category,
          amount,
          share: total.isZero() ? ZERO : amount.dividedBy(total).times(100).toDecimalPlaces(1),
        }))
        .sort((a, b) => b.amount.comparedTo(a.amount));

    const business = await this.prisma.businessInfo.findFirst();

    return {
      month: key,
      period: { start, end },
      current: {
        income: current.totalIncome,
        expense: current.totalExpense,
        result: current.result,
        margin: current.totalIncome.isZero()
          ? ZERO
          : current.result.dividedBy(current.totalIncome).times(100).toDecimalPlaces(1),
        incomeByCategory: toRows(current.income, current.totalIncome),
        expenseByCategory: toRows(current.expense, current.totalExpense),
      },
      previous: {
        month: prev.key,
        income: previous.totalIncome,
        expense: previous.totalExpense,
        result: previous.result,
      },
      variation: {
        income: this.variation(current.totalIncome, previous.totalIncome),
        expense: this.variation(current.totalExpense, previous.totalExpense),
        result: this.variation(current.result, previous.result),
      },
      allocation,
      indicators: {
        deliveredCount: delivered.length,
        deliveredValue,
        averageTicket: delivered.length
          ? deliveredValue.dividedBy(delivered.length).toDecimalPlaces(2)
          : ZERO,
        quotesCreated,
        quotesConverted,
        conversionRate: quotesCreated
          ? D(quotesConverted).dividedBy(quotesCreated).times(100).toDecimalPlaces(1)
          : ZERO,
        bySeamstress: [...bySeamstress.values()].sort((a, b) => b.value.comparedTo(a.value)),
      },
      history,
      business,
    };
  }

  /** Contadores globais de vencidos — alimentam os alertas do módulo. */
  async getSummary() {
    await this.markOverdue();
    const [receivable, payable, register] = await this.prisma.$transaction([
      this.prisma.accountReceivable.aggregate({
        where: { status: 'OVERDUE', deletedAt: null },
        _count: true,
        _sum: { amount: true, paidAmount: true },
      }),
      this.prisma.accountPayable.aggregate({
        where: { status: 'OVERDUE', deletedAt: null },
        _count: true,
        _sum: { amount: true, paidAmount: true },
      }),
      this.prisma.cashRegister.findFirst({ where: { status: 'OPEN' }, select: { id: true } }),
    ]);

    return {
      receivablesOverdue: {
        count: receivable._count,
        amount: D(receivable._sum.amount ?? 0).minus(receivable._sum.paidAmount ?? 0),
      },
      payablesOverdue: {
        count: payable._count,
        amount: D(payable._sum.amount ?? 0).minus(payable._sum.paidAmount ?? 0),
      },
      cashRegisterOpen: Boolean(register),
    };
  }
}
