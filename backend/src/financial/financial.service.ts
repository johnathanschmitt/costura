import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CategoryType, Prisma, PaymentMethod, Recurrence, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_INCOME_CATEGORY } from './financial.constants';
import { byCategory, realizedEntries, totals } from './realized';
import { AccountsService } from './accounts.service';
import {
  ageBuckets, brl, cardSettlement, countBreakdownTotal, D, expectedDrawerBalance,
  percentTotal, projectBalance, splitResult, startOfToday, ZERO,
} from './money';
import {
  CloseCashRegisterDto, CreateCashTransactionDto, OpenCashRegisterDto,
} from './dto/cash-register.dto';
import {
  CashFlowQueryDto, CreatePayableDto, CreateReceivableDto, ListCashRegistersDto,
  ListPayablesDto, ListReceivablesDto, PayDto, UpdatePayableDto, UpdateReceivableDto,
} from './dto/accounts.dto';
import {
  CashFlowChartQueryDto, CashTransferDto, CashTransferKind, CreateInstallmentsDto,
} from './dto/phase2.dto';
import {
  CreateCategoryDto, DreQueryDto, ListCategoriesDto, UpdateCategoryDto,
} from './dto/categories.dto';
import { MonthlyResultQueryDto } from './dto/monthly.dto';
import { CloseDistributionDto, DistributionQueryDto } from './dto/distribution.dto';

// A aritmética de dinheiro mora em `money.ts`, separada do banco — é lá que ela
// é testada.

@Injectable()
export class FinancialService {
  constructor(private prisma: PrismaService, private accounts: AccountsService) {}

  // ── Caixa (somente dinheiro em espécie) ───────────────────────────────────
  //
  // O caixa representa a gaveta de dinheiro físico. PIX, cartão e transferência
  // não passam por aqui — vão direto para a conta bancária e são registrados
  // apenas como pagamento (ver `Payment`). O fechamento compara o saldo
  // esperado com o dinheiro contado para revelar divergências.

  async openCashRegister(dto: OpenCashRegisterDto, userId?: string) {
    const open = await this.prisma.cashRegister.findFirst({ where: { status: 'OPEN' } });
    if (open) throw new BadRequestException('Já existe um caixa aberto');
    return this.prisma.cashRegister.create({
      data: { openingBalance: D(dto.openingBalance), notes: dto.notes, openedById: userId ?? null },
    });
  }


  async closeCashRegister(id: string, dto: CloseCashRegisterDto, userId?: string) {
    const register = await this.prisma.cashRegister.findUnique({
      where: { id },
      include: { transactions: { select: { type: true, amount: true } } },
    });
    if (!register) throw new NotFoundException('Caixa não encontrado');
    if (register.status === 'CLOSED') throw new BadRequestException('Caixa já fechado');

    const expected = expectedDrawerBalance(register.openingBalance, register.transactions);
    const counted = D(dto.countedBalance);
    const difference = counted.minus(expected);

    // A contagem por cédula, quando informada, tem que fechar com o valor
    // contado — senão o relatório mostraria duas verdades diferentes.
    if (dto.countBreakdown) {
      const fromNotes = countBreakdownTotal(dto.countBreakdown);
      if (!fromNotes.equals(counted)) {
        throw new BadRequestException(
          `A contagem por cédula soma ${brl(fromNotes)}, diferente do valor informado (${brl(counted)}).`,
        );
      }
    }

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
        countBreakdown: dto.countBreakdown ?? undefined,
        difference,
        notes: dto.notes,
        closedById: userId ?? null,
      },
    });
  }

  async getCurrentCashRegister() {
    const [register, business] = await Promise.all([
      this.prisma.cashRegister.findFirst({
        where: { status: 'OPEN' },
        include: {
          transactions: { select: { type: true, amount: true } },
          openedBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.businessInfo.findFirst({ select: { blindCashCount: true } }),
    ]);
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
      // Com conferência às cegas, a tela de fechamento esconde o esperado até a
      // contagem ser digitada.
      blindCashCount: business?.blindCashCount ?? false,
    };
  }

  async getCashRegisters(query: ListCashRegistersDto) {
    const { page = 1, limit = 20 } = query;
    const [data, total, closed] = await this.prisma.$transaction([
      this.prisma.cashRegister.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { openedAt: 'desc' },
        include: {
          _count: { select: { transactions: true } },
          openedBy: { select: { id: true, name: true } },
          closedBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.cashRegister.count(),
      // Resumo das divergências de todos os caixas fechados: um caixa que fecha
      // sempre faltando R$ 5 só aparece quando se olha o conjunto.
      this.prisma.cashRegister.findMany({
        where: { status: 'CLOSED' },
        select: { difference: true },
      }),
    ]);

    const withDifference = closed.filter(c => c.difference && !D(c.difference).isZero());
    return {
      data,
      total,
      page,
      limit,
      summary: {
        closedCount: closed.length,
        withDifferenceCount: withDifference.length,
        differenceTotal: withDifference.reduce((s, c) => s.plus(c.difference!), ZERO),
      },
    };
  }

  private async requireOpenRegister(cashRegisterId: string) {
    const register = await this.prisma.cashRegister.findUnique({ where: { id: cashRegisterId } });
    if (!register) throw new NotFoundException('Caixa não encontrado');
    if (register.status === 'CLOSED') {
      throw new BadRequestException('Não é possível lançar em um caixa já fechado');
    }
    return register;
  }

  async addTransaction(cashRegisterId: string, dto: CreateCashTransactionDto, userId?: string) {
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
        userId: userId ?? null,
      },
    });
  }

  /**
   * Sangria e suprimento movem dinheiro entre a gaveta e o banco/cofre. Afetam
   * o saldo do caixa, mas não são receita nem despesa — por isso ficam marcados
   * e são excluídos do resultado no fluxo de caixa.
   */
  async transfer(cashRegisterId: string, dto: CashTransferDto, userId?: string) {
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

    return this.prisma.$transaction(async tx => {
      const movement = await tx.cashTransaction.create({
        data: {
          cashRegisterId,
          type: isWithdrawal ? 'EXPENSE' : 'INCOME',
          kind: isWithdrawal ? 'WITHDRAWAL' : 'SUPPLY',
          description: isWithdrawal
            ? `Sangria → ${dto.counterpart} — ${dto.reason}`
            : `Suprimento ← ${dto.counterpart} — ${dto.reason}`,
          category: isWithdrawal ? 'Sangria' : 'Suprimento',
          counterpart: dto.counterpart,
          amount,
          paymentMethod: PaymentMethod.CASH,
          userId: userId ?? null,
        },
      });

      // Com a conta de destino informada, o dinheiro que sai da gaveta chega em
      // algum lugar: a sangria vira "Gaveta → Banco" e o saldo do banco sobe.
      // Sem ela (dinheiro para um fornecedor, por exemplo) fica só a saída.
      const drawer = await this.accounts.getDrawer();
      if (dto.accountId && drawer) {
        await tx.accountTransfer.create({
          data: {
            fromAccountId: isWithdrawal ? drawer.id : dto.accountId,
            toAccountId: isWithdrawal ? dto.accountId : drawer.id,
            amount,
            reason: `${isWithdrawal ? 'Sangria' : 'Suprimento'} — ${dto.reason}`,
            cashTransactionId: movement.id,
            userId: userId ?? null,
          },
        });
      }

      return movement;
    });
  }

  private async currentDrawerBalance(cashRegisterId: string) {
    const register = await this.prisma.cashRegister.findUniqueOrThrow({
      where: { id: cashRegisterId },
      include: { transactions: { select: { type: true, amount: true } } },
    });
    return expectedDrawerBalance(register.openingBalance, register.transactions);
  }

  async getTransactions(cashRegisterId: string) {
    const register = await this.prisma.cashRegister.findUnique({ where: { id: cashRegisterId } });
    if (!register) throw new NotFoundException('Caixa não encontrado');
    return this.prisma.cashTransaction.findMany({
      where: { cashRegisterId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true } },
        payment: {
          select: {
            id: true,
            type: true,
            reversedAt: true,
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

  /**
   * Recorte de período das listas.
   *
   * Conta em aberto pertence ao mês do vencimento — é quando o dinheiro é
   * esperado. Conta já quitada pertence ao mês da baixa, não ao do vencimento:
   * a OS com entrega para setembro que ficou pronta e foi paga em agosto é
   * dinheiro de agosto, e datá-la pelo vencimento fazia o recebimento sumir do
   * mês em que entrou para reaparecer no mês seguinte. É a mesma regra do
   * realizado (`realizedEntries`), que já data tudo pela baixa.
   *
   * Com o período escolhido, o vencido de meses anteriores continua vindo junto:
   * quem abre "agosto" para cobrar não vai atrás de julho e junho um por um, e a
   * conta atrasada é justamente a que não pode sumir da tela.
   */
  private periodWhere(startDate?: string, endDate?: string, includeOverdue = true) {
    if (!startDate && !endDate) return {};

    const period = {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    };
    // `paidAt` só é preenchido na quitação: em aberto e parcial caem no
    // vencimento, quitada cai na data em que o dinheiro entrou.
    const byDate = [
      { paidAt: null, dueDate: period },
      { paidAt: period },
    ];
    if (!includeOverdue || !startDate) return { OR: byDate };

    return {
      OR: [
        ...byDate,
        { status: 'OVERDUE' as const, dueDate: { lt: new Date(startDate) } },
      ],
    };
  }

  async getReceivables(query: ListReceivablesDto) {
    await this.markOverdue();
    const {
      page = 1, limit = 20, status, customerId, startDate, endDate, includeOverdue = true,
    } = query;

    const where: Prisma.AccountReceivableWhereInput = {
      deletedAt: null,
      ...(status && { status }),
      ...(customerId && { customerId }),
      ...this.periodWhere(startDate, endDate, includeOverdue),
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
        include: {
          // O telefone vem junto para a tela montar o link de cobrança.
          customer: { select: { id: true, name: true, phone: true } },
          // As baixas vêm junto para a tela poder mostrar o histórico e oferecer
          // o estorno sem uma segunda consulta por linha.
          payments: {
            orderBy: { paidAt: 'desc' },
            select: {
              id: true, amount: true, method: true, paidAt: true,
              reversedAt: true, reversedReason: true,
              feeAmount: true, netAmount: true, availableAt: true,
            },
          },
        },
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
      aging: await this.receivablesAging(),
    };
  }

  /**
   * Idade da dívida: quanto está a vencer e quanto já venceu, em faixas.
   *
   * Um total de "R$ 4.000 a receber" não diz nada; saber que R$ 600 estão
   * parados há mais de 60 dias diz que é hora de cobrar — ou de parar de
   * atender fiado.
   */
  private async receivablesAging() {
    const open = await this.prisma.accountReceivable.findMany({
      where: { deletedAt: null, status: { notIn: [...FinancialService.SETTLED] } },
      select: { amount: true, paidAmount: true, dueDate: true },
    });
    return ageBuckets(open);
  }

  createReceivable(dto: CreateReceivableDto) {
    return this.prisma.accountReceivable.create({
      data: {
        description: dto.description,
        amount: D(dto.amount),
        dueDate: new Date(dto.dueDate),
        customerId: dto.customerId ?? null,
        workOrderId: dto.workOrderId ?? null,
        // Sem categoria a receita fica invisível no DRE, que passa a mostrar
        // tudo como "Sem categoria". Na dúvida, é serviço prestado.
        category: dto.category ?? DEFAULT_INCOME_CATEGORY,
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
            category: dto.category ?? DEFAULT_INCOME_CATEGORY,
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
            category: dto.category ?? DEFAULT_INCOME_CATEGORY,
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

      // Na maquininha a cliente paga um valor e o ateliê recebe outro, dias
      // depois: a taxa fica com a adquirente e o líquido só cai no prazo.
      const card = cardSettlement(amount, dto.method, await this.cardConfig());

      await tx.payment.create({
        data: {
          type: 'RECEIVABLE',
          receivableId: rec.id,
          amount,
          method: dto.method,
          notes: dto.notes ?? null,
          // Sem conta o dinheiro não aparece em saldo nenhum.
          accountId: await this.accounts.resolveForPayment(dto.method, dto.accountId),
          cashTransactionId: cashTransaction?.id ?? null,
          feeAmount: card.isCard ? card.fee : null,
          netAmount: card.isCard ? card.net : null,
          availableAt: card.availableAt,
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

  /**
   * Edição de conta a receber ainda em aberto. Conta quitada ou cancelada não
   * muda: o histórico do que já foi recebido tem que continuar verdadeiro.
   */
  async updateReceivable(id: string, dto: UpdateReceivableDto) {
    const rec = await this.prisma.accountReceivable.findFirst({ where: { id, deletedAt: null } });
    if (!rec) throw new NotFoundException('Conta a receber não encontrada');
    if (rec.status === 'PAID') throw new BadRequestException('Conta quitada não pode ser editada');
    if (rec.status === 'CANCELLED') {
      throw new BadRequestException('Conta cancelada não pode ser editada');
    }
    if (dto.amount !== undefined && D(dto.amount).lt(rec.paidAmount)) {
      throw new BadRequestException(
        `O valor não pode ficar abaixo do que já foi recebido (${brl(rec.paidAmount)})`,
      );
    }

    const amount = dto.amount !== undefined ? D(dto.amount) : D(rec.amount);
    const paid = D(rec.paidAmount);

    const updated = await this.prisma.accountReceivable.update({
      where: { id },
      data: {
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.amount !== undefined && { amount }),
        ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.customerId !== undefined && { customerId: dto.customerId || null }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        // Baixar o valor até o que já foi pago quita a conta na hora.
        ...(paid.gte(amount) && { status: 'PAID' as const, paidAt: new Date() }),
      },
    });
    await this.markOverdue();
    return updated;
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
    const {
      page = 1, limit = 20, status, category, startDate, endDate, includeOverdue = true,
    } = query;

    const where: Prisma.AccountPayableWhereInput = {
      deletedAt: null,
      ...(status && { status }),
      ...(category && { category }),
      ...this.periodWhere(startDate, endDate, includeOverdue),
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
        include: {
          payments: {
            orderBy: { paidAt: 'desc' },
            select: {
              id: true, amount: true, method: true, paidAt: true,
              reversedAt: true, reversedReason: true,
              feeAmount: true, netAmount: true, availableAt: true,
            },
          },
        },
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

    // Fixo e variável separados: é o custo fixo que define quanto o ateliê
    // precisa faturar para empatar, e ele se comporta diferente do resto.
    const fixedCategories = await this.prisma.financialCategory.findMany({
      where: { type: 'EXPENSE', isFixed: true },
      select: { name: true },
    });
    const fixedNames = new Set(fixedCategories.map(c => c.name));
    const openRows = await this.prisma.accountPayable.findMany({
      where: openWhere,
      select: { amount: true, paidAmount: true, category: true },
    });
    const openSplit = openRows.reduce(
      (acc, r) => {
        const remaining = D(r.amount).minus(r.paidAmount);
        if (fixedNames.has(r.category ?? '')) acc.fixed = acc.fixed.plus(remaining);
        else acc.variable = acc.variable.plus(remaining);
        return acc;
      },
      { fixed: ZERO, variable: ZERO },
    );

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
        openFixed: openSplit.fixed,
        openVariable: openSplit.variable,
        fixedCategories: [...fixedNames],
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
          accountId: await this.accounts.resolveForPayment(dto.method, dto.accountId),
          cashTransactionId: cashTransaction?.id ?? null,
          // Numa despesa paga no cartão quem paga a taxa é o fornecedor: o
          // ateliê desembolsa o valor cheio.
          availableAt: new Date(),
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

  /** Edição de conta a pagar ainda em aberto — mesma regra da conta a receber. */
  async updatePayable(id: string, dto: UpdatePayableDto) {
    const pay = await this.prisma.accountPayable.findFirst({ where: { id, deletedAt: null } });
    if (!pay) throw new NotFoundException('Conta a pagar não encontrada');
    if (pay.status === 'PAID') throw new BadRequestException('Conta quitada não pode ser editada');
    if (pay.status === 'CANCELLED') {
      throw new BadRequestException('Conta cancelada não pode ser editada');
    }
    if (dto.amount !== undefined && D(dto.amount).lt(pay.paidAmount)) {
      throw new BadRequestException(
        `O valor não pode ficar abaixo do que já foi pago (${brl(pay.paidAmount)})`,
      );
    }

    const amount = dto.amount !== undefined ? D(dto.amount) : D(pay.amount);
    const paid = D(pay.paidAmount);

    const updated = await this.prisma.accountPayable.update({
      where: { id },
      data: {
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.amount !== undefined && { amount }),
        ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
        ...(dto.supplier !== undefined && { supplier: dto.supplier }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(paid.gte(amount) && { status: 'PAID' as const, paidAt: new Date() }),
      },
    });
    await this.markOverdue();
    return updated;
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
  async getCashFlow(query: CashFlowQueryDto, paginate = true) {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('A data final deve ser posterior à data inicial');
    }
    const period = { gte: startDate, lte: endDate };

    const [received, paid, byMethod, directCash, payments] = await this.prisma.$transaction([
      this.prisma.payment.aggregate({
        where: { type: 'RECEIVABLE', paidAt: period, reversedAt: null },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { type: 'PAYABLE', paidAt: period, reversedAt: null },
        _sum: { amount: true },
      }),
      this.prisma.payment.groupBy({
        by: ['method'],
        where: { type: 'RECEIVABLE', paidAt: period, reversedAt: null },
        _sum: { amount: true },
        orderBy: { method: 'asc' },
      }),
      // Sangria, suprimento e estorno movem dinheiro sem serem receita ou
      // despesa: mexem no saldo do caixa, não no resultado do ateliê.
      this.prisma.cashTransaction.findMany({
        where: {
          createdAt: period,
          payment: null,
          kind: { notIn: ['WITHDRAWAL', 'SUPPLY', 'REVERSAL'] },
        },
        // Sem `take`: o período já limita o volume, e cortar aqui sumia com
        // lançamentos do extrato sem ninguém perceber.
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.findMany({
        where: { paidAt: period, reversedAt: null },
        orderBy: { paidAt: 'desc' },
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

    // O extrato costumava vir cortado em 500 linhas sem avisar: quem procurava
    // um lançamento antigo simplesmente não achava. Agora é paginado, com busca
    // por descrição, cliente, fornecedor ou categoria.
    const term = query.search?.trim().toLowerCase();
    const filtered = term
      ? entries.filter(e =>
          [e.description, e.party, e.category].some(v => v?.toLowerCase().includes(term)))
      : entries;

    // A exportação leva o extrato inteiro: um CSV com só a primeira página
    // seria pior do que não exportar.
    const page = paginate ? query.page ?? 1 : 1;
    const limit = paginate ? query.limit ?? 20 : filtered.length || 1;

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
      entries: filtered.slice((page - 1) * limit, page * limit),
      entriesTotal: filtered.length,
      page,
      limit,
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
        where: { paidAt: period, reversedAt: null },
        select: { type: true, amount: true, paidAt: true, payable: { select: { category: true } } },
      }),
      this.prisma.cashTransaction.findMany({
        where: {
          createdAt: period,
          payment: null,
          kind: { notIn: ['WITHDRAWAL', 'SUPPLY', 'REVERSAL'] },
        },
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

    // O período em que o saldo projetado vira negativo é a informação que muda
    // decisão: dá para o total fechar no azul e faltar dinheiro no meio.
    const firstNegative = series.find(s => s.projectedBalance.isNegative()) ?? null;

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
      firstNegative: firstNegative
        ? { key: firstNegative.key, balance: firstNegative.projectedBalance }
        : null,
    };
  }

  /** Dados do relatório de fechamento do caixa. */
  async getClosingReport(id: string) {
    const register = await this.prisma.cashRegister.findUnique({
      where: { id },
      include: {
        openedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
        transactions: {
          orderBy: { createdAt: 'asc' },
          include: {
            payment: { select: { method: true, type: true } },
            user: { select: { name: true } },
          },
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
        reversals: sum(t => t.kind === 'REVERSAL'),
      },
      // Para onde o dinheiro saiu da gaveta no turno.
      transfersByCounterpart: [...transactions
        .filter(t => t.kind === 'WITHDRAWAL' || t.kind === 'SUPPLY')
        .reduce((map, t) => {
          const key = `${t.kind === 'WITHDRAWAL' ? 'Sangria' : 'Suprimento'} · ${t.counterpart ?? 'não informado'}`;
          map.set(key, (map.get(key) ?? ZERO).plus(t.amount));
          return map;
        }, new Map<string, Prisma.Decimal>())].map(([label, amount]) => ({ label, amount })),
    };
  }

  /**
   * Estorna uma baixa errada.
   *
   * A linha do livro não é apagada: fica marcada como estornada, com motivo e
   * autor, e sai de todas as somas (`realizedEntries` ignora estornadas). O
   * valor volta para o saldo em aberto da conta e, quando a baixa foi em
   * espécie, um lançamento contrário acerta a gaveta — marcado como REVERSAL
   * para não virar despesa no resultado.
   */
  async reversePayment(id: string, reason: string, userId?: string) {
    return this.prisma.$transaction(async tx => {
      const payment = await tx.payment.findUnique({
        where: { id },
        include: { cashTransaction: { select: { id: true, cashRegisterId: true } } },
      });
      if (!payment) throw new NotFoundException('Pagamento não encontrado');
      if (payment.reversedAt) throw new BadRequestException('Esta baixa já foi estornada');

      const amount = D(payment.amount);

      // Devolve o valor ao saldo em aberto da conta.
      if (payment.type === 'RECEIVABLE' && payment.receivableId) {
        const rec = await tx.accountReceivable.findUniqueOrThrow({
          where: { id: payment.receivableId },
        });
        const paidAmount = D(rec.paidAmount).minus(amount);
        await tx.accountReceivable.update({
          where: { id: rec.id },
          data: {
            paidAmount,
            paidAt: null,
            status: paidAmount.gt(0) ? 'PARTIAL' : 'PENDING',
          },
        });
      } else if (payment.payableId) {
        const pay = await tx.accountPayable.findUniqueOrThrow({ where: { id: payment.payableId } });
        const paidAmount = D(pay.paidAmount).minus(amount);
        await tx.accountPayable.update({
          where: { id: pay.id },
          data: {
            paidAmount,
            paidAt: null,
            status: paidAmount.gt(0) ? 'PARTIAL' : 'PENDING',
          },
        });
      }

      // Baixa em espécie mexeu na gaveta: precisa do lançamento contrário. Se o
      // caixa da época já fechou, o acerto entra no caixa aberto agora — mexer
      // num caixa fechado invalidaria uma conferência já assinada.
      if (payment.cashTransaction) {
        const open = await tx.cashRegister.findFirst({ where: { status: 'OPEN' } });
        if (!open) {
          throw new BadRequestException(
            'A baixa foi em dinheiro: abra o caixa para o estorno acertar a gaveta.',
          );
        }
        await tx.cashTransaction.create({
          data: {
            cashRegisterId: open.id,
            // Entrada vira saída e vice-versa.
            type: payment.type === 'RECEIVABLE' ? 'EXPENSE' : 'INCOME',
            kind: 'REVERSAL',
            description: `Estorno — ${reason}`,
            category: 'Estorno',
            amount,
            paymentMethod: PaymentMethod.CASH,
            referenceId: payment.id,
            referenceType: 'PAYMENT_REVERSAL',
            userId: userId ?? null,
          },
        });
      }

      const reversed = await tx.payment.update({
        where: { id },
        data: { reversedAt: new Date(), reversedReason: reason, reversedById: userId ?? null },
      });

      await this.markOverdue();
      return reversed;
    });
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

  /**
   * Categorias que já existem no sistema desde sempre, criadas na primeira
   * consulta. `isFixed` marca a despesa que se repete todo mês — é a soma delas
   * que vira o custo fixo e o ponto de equilíbrio do painel.
   */
  private static readonly DEFAULT_CATEGORIES: {
    name: string; type: CategoryType; isFixed?: boolean;
  }[] = [
    { name: 'Costura', type: 'INCOME' },
    { name: 'Ajuste', type: 'INCOME' },
    { name: 'Bordado', type: 'INCOME' },
    { name: 'Venda de Material', type: 'INCOME' },
    { name: 'Aluguel', type: 'EXPENSE', isFixed: true },
    { name: 'Luz', type: 'EXPENSE', isFixed: true },
    { name: 'Água', type: 'EXPENSE', isFixed: true },
    { name: 'Internet', type: 'EXPENSE', isFixed: true },
    { name: 'Salários', type: 'EXPENSE', isFixed: true },
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
    if (dto.isFixed && dto.type === 'INCOME') {
      throw new BadRequestException('Só despesa pode ser marcada como custo fixo');
    }
    return this.prisma.financialCategory.create({ data: dto });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.financialCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Categoria não encontrada');
    if (category.isSystem && dto.name && dto.name !== category.name) {
      throw new BadRequestException('Categoria padrão do sistema não pode ser renomeada');
    }
    // Custo fixo é conceito de despesa: uma receita marcada como fixa entraria
    // na conta do ponto de equilíbrio e o inverteria.
    if (dto.isFixed && category.type === 'INCOME') {
      throw new BadRequestException('Só despesa pode ser marcada como custo fixo');
    }
    return this.prisma.financialCategory.update({ where: { id }, data: dto });
  }

  // ── Parâmetros do ateliê (custo fixo e meta por hora) ─────────────────────

  private monthsAgo(n: number) {
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth() - n, 1, 0, 0, 0, 0),
      // Último dia do mês passado: meses fechados, sem o mês corrente pela metade.
      end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
    };
  }

  /**
   * Custo fixo mensal do ateliê — a base do "quanto preciso faturar para
   * empatar". Vem das categorias marcadas como fixas, do jeito escolhido em
   * Configurações: o gasto real do mês, a média dos últimos 3 meses (padrão,
   * para o mês em que a conta de luz não chegou não derrubar a meta) ou um
   * valor informado à mão.
   */
  async getFixedCost(referenceStart?: Date, referenceEnd?: Date) {
    const business = await this.prisma.businessInfo.findFirst();
    const mode = business?.fixedCostMode ?? 'AVERAGE_3M';

    if (mode === 'MANUAL') {
      return { mode, amount: D(business?.fixedCostManual ?? 0), byCategory: [] as { category: string; amount: Prisma.Decimal }[] };
    }

    const fixedCategories = await this.prisma.financialCategory.findMany({
      where: { type: 'EXPENSE', isFixed: true },
      select: { name: true },
    });
    const names = new Set(fixedCategories.map(c => c.name));

    const window = mode === 'REAL'
      ? { start: referenceStart ?? this.monthBounds().start, end: referenceEnd ?? this.monthBounds().end, divisor: 1 }
      : { ...this.monthsAgo(3), divisor: 3 };

    const entries = await realizedEntries(this.prisma, window.start, window.end);
    const expenses = byCategory(entries, 'EXPENSE');

    const rows = [...names].map(category => ({
      category,
      amount: (expenses.get(category) ?? ZERO).dividedBy(window.divisor).toDecimalPlaces(2),
    }));

    return {
      mode,
      amount: rows.reduce((s, r) => s.plus(r.amount), ZERO),
      byCategory: rows.sort((a, b) => b.amount.comparedTo(a.amount)),
    };
  }

  /**
   * Ganho por hora de costura: o que entrou de dinheiro dividido pelas horas
   * estimadas das peças entregues no período. Diz se o preço cobrado paga o
   * tempo gasto.
   */
  async getHourlyRate(start: Date, end: Date) {
    const [entries, delivered] = await Promise.all([
      realizedEntries(this.prisma, start, end),
      this.prisma.workOrder.findMany({
        where: { deletedAt: null, status: 'DELIVERED', deliveredAt: { gte: start, lte: end } },
        select: { estimatedHours: true },
      }),
    ]);

    const hours = delivered.reduce((s, w) => s.plus(w.estimatedHours ?? 0), ZERO);
    const income = totals(entries).income;
    // Sem horas informadas a divisão seria por zero — melhor dizer que não dá
    // para calcular do que mostrar um número inventado.
    const withoutHours = delivered.filter(w => w.estimatedHours === null).length;

    return {
      hours,
      income,
      rate: hours.isZero() ? null : income.dividedBy(hours).toDecimalPlaces(2),
      deliveredCount: delivered.length,
      withoutHours,
    };
  }

  /** Taxa e prazo configurados para a maquininha. */
  private async cardConfig() {
    const b = await this.prisma.businessInfo.findFirst();
    return {
      debitFeePercent: b?.cardDebitFeePercent ?? 0,
      creditFeePercent: b?.cardCreditFeePercent ?? 0,
      debitDays: b?.cardDebitDays ?? 0,
      creditDays: b?.cardCreditDays ?? 0,
    };
  }

  /** Dados da tela de Configurações → Financeiro. */
  async getSettings() {
    const business = await this.prisma.businessInfo.findFirst();
    const { start, end } = this.monthsAgo(3);

    await this.listCategories(); // garante as categorias padrão na primeira vez
    const [categories, entries, fixedCost] = await Promise.all([
      this.prisma.financialCategory.findMany({
        where: { type: 'EXPENSE' },
        orderBy: [{ isFixed: 'desc' }, { name: 'asc' }],
      }),
      realizedEntries(this.prisma, start, end),
      this.getFixedCost(),
    ]);

    const expenses = byCategory(entries, 'EXPENSE');

    // Ganho por hora dos últimos 3 meses fechados, um a um, para a usuária ver
    // a tendência antes de escolher a meta.
    const now = new Date();
    const history: { month: string; rate: Prisma.Decimal | null; deliveredCount: number }[] = [];
    for (let i = 3; i >= 1; i--) {
      const b = this.monthBounds(
        `${new Date(now.getFullYear(), now.getMonth() - i, 1).getFullYear()}-${String(
          new Date(now.getFullYear(), now.getMonth() - i, 1).getMonth() + 1,
        ).padStart(2, '0')}`,
      );
      const r = await this.getHourlyRate(b.start, b.end);
      history.push({ month: b.key, rate: r.rate, deliveredCount: r.deliveredCount });
    }

    const servicesWithoutHours = await this.prisma.service.count({
      where: { deletedAt: null, active: true, estimatedHours: null },
    });

    return {
      fixedCostMode: business?.fixedCostMode ?? 'AVERAGE_3M',
      fixedCostManual: business?.fixedCostManual ?? null,
      targetHourlyRate: business?.targetHourlyRate ?? null,
      blindCashCount: business?.blindCashCount ?? false,
      excludeUndeliveredSignals: business?.excludeUndeliveredSignals ?? true,
      coverLossWithReserve: business?.coverLossWithReserve ?? true,
      carryLossToNextMonth: business?.carryLossToNextMonth ?? true,
      reserveTargetMonths: business?.reserveTargetMonths ?? 3,
      atelierPercent: business?.atelierPercent ?? 20,
      cardDebitFeePercent: business?.cardDebitFeePercent ?? 0,
      cardCreditFeePercent: business?.cardCreditFeePercent ?? 0,
      cardDebitDays: business?.cardDebitDays ?? 0,
      cardCreditDays: business?.cardCreditDays ?? 0,
      fixedCost,
      categories: categories.map(c => ({
        ...c,
        average3m: (expenses.get(c.name) ?? ZERO).dividedBy(3).toDecimalPlaces(2),
      })),
      hourlyRateHistory: history,
      servicesWithoutHours,
    };
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
   * DRE: receitas e despesas do período agrupadas por categoria, com o período
   * anterior de mesmo tamanho ao lado.
   *
   * A comparação substituiu o percentual de participação que havia antes: saber
   * que o aluguel é 23% das despesas não muda nada; saber que ele subiu 8% em
   * relação ao mês passado, sim.
   */
  async getDre(query: DreQueryDto) {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('A data final deve ser posterior à data inicial');
    }

    // Período anterior imediatamente antes, com a mesma duração.
    const spanMs = endDate.getTime() - startDate.getTime();
    const prevEnd = new Date(startDate.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - spanMs);

    const [entries, previousEntries] = await Promise.all([
      realizedEntries(this.prisma, startDate, endDate),
      realizedEntries(this.prisma, prevStart, prevEnd),
    ]);

    const toRows = (type: 'INCOME' | 'EXPENSE') => {
      const current = byCategory(entries, type);
      const previous = byCategory(previousEntries, type);
      const categories = new Set([...current.keys(), ...previous.keys()]);

      return [...categories]
        .map(category => {
          const amount = current.get(category) ?? ZERO;
          const previousAmount = previous.get(category) ?? ZERO;
          return {
            category,
            amount,
            previousAmount,
            variation: this.variation(amount, previousAmount),
          };
        })
        .filter(r => !r.amount.isZero() || !r.previousAmount.isZero())
        .sort((a, b) => b.amount.comparedTo(a.amount));
    };

    const current = totals(entries);
    const previous = totals(previousEntries);

    return {
      period: { start: startDate, end: endDate },
      previousPeriod: { start: prevStart, end: prevEnd },
      income: toRows('INCOME'),
      expense: toRows('EXPENSE'),
      totals: {
        income: current.income,
        expense: current.expense,
        result: current.result,
        margin: current.income.isZero()
          ? ZERO
          : current.result.dividedBy(current.income).times(100).toDecimalPlaces(1),
        previousIncome: previous.income,
        previousExpense: previous.expense,
        previousResult: previous.result,
        incomeVariation: this.variation(current.income, previous.income),
        expenseVariation: this.variation(current.expense, previous.expense),
        resultVariation: this.variation(current.result, previous.result),
      },
    };
  }

  // ── Resultado do mês ──────────────────────────────────────────────────────

  /**
   * Receitas e despesas realizadas num intervalo, agrupadas por categoria.
   * Usa a mesma fonte do resto do sistema (`realizedEntries`) — antes esta
   * função tinha a própria cópia da consulta e ficou para trás quando o estorno
   * passou a existir.
   */
  private async realizedIn(start: Date, end: Date) {
    const entries = await realizedEntries(this.prisma, start, end);
    const sums = totals(entries);
    return {
      income: byCategory(entries, 'INCOME'),
      expense: byCategory(entries, 'EXPENSE'),
      totalIncome: sums.income,
      totalExpense: sums.expense,
      result: sums.result,
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

  // ── Divisão entre as sócias ───────────────────────────────────────────────

  /**
   * Sinais já recebidos no mês de peças que ainda não foram entregues.
   *
   * Esse dinheiro está no caixa mas ainda tem tecido e trabalho pela frente —
   * dividi-lo é o jeito mais comum de o ateliê gastar o que não é dele. Volta ao
   * bolo no mês em que a peça for entregue.
   */
  private async undeliveredSignalsIn(start: Date, end: Date) {
    const payments = await this.prisma.payment.findMany({
      where: {
        type: 'RECEIVABLE',
        reversedAt: null,
        paidAt: { gte: start, lte: end },
        receivable: {
          isDownPayment: true,
          deletedAt: null,
          workOrder: { deletedAt: null, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
        },
      },
      select: {
        amount: true,
        receivable: {
          select: {
            description: true,
            customer: { select: { name: true } },
            workOrder: { select: { number: true } },
          },
        },
      },
    });

    return {
      amount: payments.reduce((s, p) => s.plus(p.amount), ZERO),
      count: payments.length,
      items: payments.map(p => ({
        description: p.receivable?.description ?? '',
        customer: p.receivable?.customer?.name ?? null,
        workOrderNumber: p.receivable?.workOrder?.number ?? null,
        amount: p.amount,
      })),
    };
  }

  /**
   * Divisão do resultado do mês entre as sócias e o ateliê.
   *
   * O bolo a dividir não é o resultado cru: dele saem os sinais de peças ainda
   * não entregues e o prejuízo de meses anteriores que a reserva não cobriu.
   * O que sobra é repartido pelos percentuais configurados — um por sócia e um
   * do ateliê, somando 100%. Os centavos do arredondamento ficam com o ateliê
   * para o total bater exato.
   */
  async getDistribution(query: DistributionQueryDto) {
    const { start, end, key } = this.monthBounds(query.month);
    const [realized, business, partners, delivered, carryOvers] = await Promise.all([
      this.realizedIn(start, end),
      this.prisma.businessInfo.findFirst(),
      this.prisma.user.findMany({
        where: { isPartner: true, deletedAt: null },
        select: { id: true, name: true, distributionPercent: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.workOrder.findMany({
        where: { deletedAt: null, status: 'DELIVERED', deliveredAt: { gte: start, lte: end } },
        select: {
          id: true, number: true, total: true, discount: true, deliveredAt: true, assignedToId: true,
          customer: { select: { name: true } },
          garment: { select: { name: true } },
        },
        orderBy: { deliveredAt: 'asc' },
      }),
      // Prejuízos anteriores ainda não abatidos.
      this.prisma.distributionCarryOver.findMany({
        where: { settledIn: null, month: { lt: key } },
        orderBy: { month: 'asc' },
      }),
    ]);

    const grossResult = realized.result;

    const signals = business?.excludeUndeliveredSignals !== false
      ? await this.undeliveredSignalsIn(start, end)
      : { amount: ZERO, count: 0, items: [] as any[] };

    const carryOverTotal = carryOvers.reduce((s, c) => s.plus(c.amount), ZERO);
    const distributable = grossResult.minus(signals.amount).minus(carryOverTotal);

    // Regra do mês, quando existe, tem prioridade sobre a regra padrão — é o
    // caso da sócia afastada em julho, que não deve mudar os outros meses.
    const monthRule = await this.prisma.monthlyDistributionRule.findUnique({ where: { month: key } });
    const ruleShares = (monthRule?.shares ?? null) as { userId: string; percent: number }[] | null;
    const percentOf = (userId: string, fallback: Prisma.Decimal | null) =>
      ruleShares
        ? D(ruleShares.find(s => s.userId === userId)?.percent ?? 0)
        : D(fallback ?? 0);

    const atelierPercent = D(monthRule?.atelierPercent ?? business?.atelierPercent ?? 20);
    const rulePercentTotal = percentTotal(
      atelierPercent,
      partners.map(p => ({ percent: percentOf(p.id, p.distributionPercent) })),
    );

    const split = splitResult(
      distributable,
      partners.map(p => ({ userId: p.id, percent: percentOf(p.id, p.distributionPercent) })),
    );

    const shares = partners.map((p, i) => {
      const items = delivered.filter(w => w.assignedToId === p.id);
      return {
        userId: p.id,
        name: p.name,
        percent: split.shares[i].percent,
        amount: split.shares[i].amount,
        deliveredCount: items.length,
        deliveredValue: items.reduce((s, w) => s.plus(D(w.total).minus(w.discount)), ZERO),
        items: items.map(w => ({
          id: w.id,
          number: w.number,
          customer: w.customer?.name,
          garment: w.garment?.name ?? null,
          deliveredAt: w.deliveredAt,
          value: D(w.total).minus(w.discount),
        })),
      };
    });

    // O ateliê fica com a parte dele mais o arredondamento, para a soma fechar.
    const atelierShare = split.atelierShare;

    const unassigned = delivered.filter(w => !w.assignedToId);
    const [closed, reserve] = await Promise.all([
      this.prisma.monthlyDistribution.findUnique({
        where: { month: key },
        include: {
          shares: { orderBy: { name: 'asc' } },
          payouts: { include: { user: { select: { name: true } } } },
        },
      }),
      this.accounts.getReserve(),
    ]);
    const reserveBalance = reserve ? (await this.accounts.getBalance(reserve.id)).balance : ZERO;
    const fixedCost = await this.getFixedCost(start, end);

    return {
      month: key,
      period: { start, end },
      income: realized.totalIncome,
      expense: realized.totalExpense,
      /// Resultado cru do mês, antes dos descontos.
      grossResult,
      withheldSignals: signals,
      carryOver: {
        total: carryOverTotal,
        months: carryOvers.map(c => ({ month: c.month, amount: c.amount })),
      },
      /// O que efetivamente vai ser repartido.
      result: distributable,
      rule: {
        atelierPercent,
        percentTotal: rulePercentTotal,
        // A soma tem que fechar 100%; a tela trava o fechamento enquanto não fechar.
        valid: rulePercentTotal.equals(100),
        // Regra pontual daquele mês, que não mexe na padrão.
        monthOnly: Boolean(monthRule),
        partnersWithoutPercent: partners
          .filter(p => percentOf(p.id, p.distributionPercent).isZero())
          .map(p => p.name),
      },
      atelierShare,
      shares,
      reserve: {
        balance: reserveBalance,
        targetMonths: business?.reserveTargetMonths ?? 3,
        target: fixedCost.amount.times(business?.reserveTargetMonths ?? 3),
        accountId: reserve?.id ?? null,
      },
      unassigned: {
        count: unassigned.length,
        value: unassigned.reduce((s, w) => s.plus(D(w.total).minus(w.discount)), ZERO),
        items: unassigned.map(w => ({
          id: w.id, number: w.number, customer: w.customer?.name,
          deliveredAt: w.deliveredAt, value: D(w.total).minus(w.discount),
        })),
      },
      closed,
      business,
    };
  }

  /**
   * Mês negativo: cobre com a reserva do ateliê e, se ela não der conta, o que
   * faltar vira saldo a abater do próximo resultado.
   */
  async settleLoss(month: string) {
    const { start, end, key } = this.monthBounds(month);
    const [realized, business, reserve, already] = await Promise.all([
      this.realizedIn(start, end),
      this.prisma.businessInfo.findFirst(),
      this.accounts.getReserve(),
      this.prisma.distributionCarryOver.findUnique({ where: { month: key } }),
    ]);

    const loss = realized.result;
    if (loss.gte(0)) throw new BadRequestException('O mês não fechou negativo.');
    if (already) throw new BadRequestException(`O prejuízo de ${key} já foi tratado.`);

    const missing = loss.abs();
    let coveredByReserve = ZERO;

    if (business?.coverLossWithReserve !== false && reserve) {
      const balance = (await this.accounts.getBalance(reserve.id)).balance;
      coveredByReserve = balance.gte(missing) ? missing : balance.gt(0) ? balance : ZERO;
    }

    const pending = missing.minus(coveredByReserve);

    return this.prisma.$transaction(async tx => {
      if (coveredByReserve.gt(0) && reserve) {
        // A reserva paga a diferença: sai da conta de reserva como transferência
        // para a conta operacional, que é de onde o dinheiro faltou.
        const target = await tx.financialAccount.findFirst({
          where: { isDefault: true, active: true },
        }) ?? await tx.financialAccount.findFirst({ where: { kind: 'CASH_DRAWER' } });

        if (target) {
          await tx.accountTransfer.create({
            data: {
              fromAccountId: reserve.id,
              toAccountId: target.id,
              amount: coveredByReserve,
              reason: `Cobertura do prejuízo de ${key}`,
            },
          });
        }
      }

      if (pending.gt(0) && business?.carryLossToNextMonth !== false) {
        await tx.distributionCarryOver.create({ data: { month: key, amount: pending } });
      }

      return { month: key, loss: missing, coveredByReserve, pending };
    });
  }

  /**
   * Fecha a divisão do mês.
   *
   * Além de congelar os valores, gera a retirada de cada sócia (que fica
   * pendente até o dinheiro sair de fato) e credita a parte do ateliê na conta
   * de reserva. É isso que impede o dinheiro não retirado voltar ao bolo do mês
   * seguinte e ser dividido duas vezes.
   */
  async closeDistribution(dto: CloseDistributionDto) {
    const existing = await this.prisma.monthlyDistribution.findUnique({ where: { month: dto.month } });
    if (existing) {
      throw new BadRequestException(
        `A divisão de ${dto.month} já foi fechada. Reabra antes de fechar de novo.`,
      );
    }

    const d = await this.getDistribution({ month: dto.month });
    if (d.result.lte(0)) {
      throw new BadRequestException(
        d.grossResult.gt(0)
          ? 'Depois de tirar os sinais de peças não entregues e o prejuízo anterior, não sobrou nada para dividir.'
          : 'O mês não teve resultado positivo — não há o que dividir.',
      );
    }
    if (d.shares.length === 0) {
      throw new BadRequestException(
        'Nenhuma sócia cadastrada. Marque as sócias em Configurações → Usuários.',
      );
    }
    if (!d.rule.valid) {
      throw new BadRequestException(
        `Os percentuais somam ${d.rule.percentTotal.toFixed(2)}% — ajuste a regra para fechar 100% antes de dividir.`,
      );
    }

    return this.prisma.$transaction(async tx => {
      const distribution = await tx.monthlyDistribution.create({
        data: {
          month: d.month,
          result: d.result,
          grossResult: d.grossResult,
          withheldSignals: d.withheldSignals.amount,
          carryOverUsed: d.carryOver.total,
          parts: d.shares.length + 1,
          valuePerPart: d.shares[0]?.amount ?? ZERO,
          atelierShare: d.atelierShare,
          atelierPercent: d.rule.atelierPercent,
          notes: dto.notes ?? null,
          shares: {
            create: d.shares.map(s => ({
              userId: s.userId,
              name: s.name,
              amount: s.amount,
              percent: s.percent,
              deliveredCount: s.deliveredCount,
              deliveredValue: s.deliveredValue,
            })),
          },
          // Enquanto `paidAt` for nulo, o valor continua devido à sócia.
          payouts: {
            create: d.shares
              .filter(s => s.amount.gt(0))
              .map(s => ({ userId: s.userId, amount: s.amount })),
          },
        },
        include: { shares: true, payouts: true },
      });

      // A parte do ateliê vira saldo de verdade na reserva.
      if (d.atelierShare.gt(0) && d.reserve.accountId) {
        const source = await tx.financialAccount.findFirst({
          where: { isDefault: true, active: true },
        }) ?? await tx.financialAccount.findFirst({ where: { kind: 'CASH_DRAWER' } });

        if (source) {
          await tx.accountTransfer.create({
            data: {
              fromAccountId: source.id,
              toAccountId: d.reserve.accountId,
              amount: d.atelierShare,
              reason: `Parte do ateliê — divisão de ${d.month}`,
            },
          });
        }
      }

      // Prejuízos usados neste fechamento não pesam de novo no mês seguinte.
      if (d.carryOver.months.length > 0) {
        await tx.distributionCarryOver.updateMany({
          where: { month: { in: d.carryOver.months.map(m => m.month) } },
          data: { settledIn: d.month },
        });
      }

      return distribution;
    });
  }

  /**
   * Salva a regra de divisão: quanto cabe a cada sócia e quanto fica no ateliê.
   *
   * Grava tudo de uma vez porque uma regra pela metade não existe — se a soma
   * não fechar 100%, alguém recebe a mais ou a menos sem ninguém ter decidido.
   */
  async saveDistributionRule(dto: {
    atelierPercent: number;
    shares: { userId: string; percent: number }[];
    /// Preenchido quando a regra vale só para aquele mês (AAAA-MM).
    month?: string;
  }) {
    const total = percentTotal(dto.atelierPercent, dto.shares);

    if (!total.equals(100)) {
      const diff = total.minus(100);
      throw new BadRequestException(
        diff.gt(0)
          ? `Os percentuais passam de 100% em ${diff.toFixed(2)}%.`
          : `Faltam ${diff.abs().toFixed(2)}% para fechar 100%.`,
      );
    }

    const partners = await this.prisma.user.findMany({
      where: { isPartner: true, deletedAt: null },
      select: { id: true, name: true },
    });
    const missing = partners.filter(p => !dto.shares.some(s => s.userId === p.id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Falta o percentual de: ${missing.map(m => m.name).join(', ')}.`,
      );
    }

    // Regra pontual: vale só naquele mês e não encosta na regra padrão.
    if (dto.month) {
      const closed = await this.prisma.monthlyDistribution.findUnique({
        where: { month: dto.month },
      });
      if (closed) {
        throw new BadRequestException(
          `A divisão de ${dto.month} já está fechada — reabra antes de mudar a regra dela.`,
        );
      }
      await this.prisma.monthlyDistributionRule.upsert({
        where: { month: dto.month },
        create: {
          month: dto.month,
          atelierPercent: D(dto.atelierPercent),
          shares: dto.shares,
        },
        update: { atelierPercent: D(dto.atelierPercent), shares: dto.shares },
      });
      return { saved: true, month: dto.month, atelierPercent: dto.atelierPercent, shares: dto.shares };
    }

    await this.prisma.$transaction([
      ...dto.shares.map(s =>
        this.prisma.user.update({
          where: { id: s.userId },
          data: { distributionPercent: D(s.percent) },
        }),
      ),
      this.prisma.businessInfo.updateMany({ data: { atelierPercent: D(dto.atelierPercent) } }),
    ]);

    return { saved: true, atelierPercent: dto.atelierPercent, shares: dto.shares };
  }

  /** Registra que a sócia retirou o dinheiro da parte dela. */
  async payPartner(payoutId: string, accountId?: string) {
    const payout = await this.prisma.partnerPayout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException('Retirada não encontrada');
    if (payout.paidAt) throw new BadRequestException('Esta retirada já foi paga');

    return this.prisma.partnerPayout.update({
      where: { id: payoutId },
      data: { paidAt: new Date(), accountId: accountId ?? null },
      include: { user: { select: { name: true } } },
    });
  }

  async reopenDistribution(month: string) {
    const existing = await this.prisma.monthlyDistribution.findUnique({
      where: { month },
      include: { payouts: true },
    });
    if (!existing) throw new NotFoundException('Nenhuma divisão fechada neste mês');

    // Reabrir com retirada já paga apagaria o registro de um dinheiro que saiu.
    const paid = existing.payouts.filter(p => p.paidAt);
    if (paid.length > 0) {
      throw new BadRequestException(
        `${paid.length} sócia(s) já retiraram a parte deste mês — a divisão não pode ser reaberta.`,
      );
    }

    return this.prisma.$transaction(async tx => {
      // Desfaz o crédito da reserva e devolve os prejuízos à fila.
      await tx.accountTransfer.deleteMany({
        where: { reason: `Parte do ateliê — divisão de ${month}` },
      });
      await tx.distributionCarryOver.updateMany({
        where: { settledIn: month },
        data: { settledIn: null },
      });
      await tx.monthlyDistribution.delete({ where: { month } });
      return { reopened: true, month };
    });
  }

  listDistributions() {
    return this.prisma.monthlyDistribution.findMany({
      orderBy: { month: 'desc' },
      take: 24,
      include: { shares: { orderBy: { name: 'asc' } } },
    });
  }

  /**
   * Quanto cada tipo de peça e cada serviço rende pelo tempo que consome.
   *
   * O ateliê cobra por peça, mas o que limita o mês é a hora de costura: uma
   * peça de R$ 400 que leva 12 horas rende menos que uma de R$ 150 que leva 2.
   * Sem esta conta, a decisão de que trabalho aceitar é no chute.
   */
  async getReturnAnalysis(query: DreQueryDto) {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('A data final deve ser posterior à data inicial');
    }

    const delivered = await this.prisma.workOrder.findMany({
      where: { deletedAt: null, status: 'DELIVERED', deliveredAt: { gte: startDate, lte: endDate } },
      select: {
        total: true,
        discount: true,
        estimatedHours: true,
        garment: { select: { id: true, name: true } },
        items: {
          select: {
            total: true,
            quantity: true,
            service: { select: { id: true, name: true, estimatedHours: true } },
          },
        },
      },
    });

    type Row = {
      key: string; name: string; count: number;
      value: Prisma.Decimal; hours: Prisma.Decimal; withoutHours: number;
    };
    const bump = (map: Map<string, Row>, key: string, name: string, value: Prisma.Decimal.Value, hours: Prisma.Decimal | null) => {
      const row = map.get(key) ?? { key, name, count: 0, value: ZERO, hours: ZERO, withoutHours: 0 };
      row.count += 1;
      row.value = row.value.plus(value);
      if (hours === null) row.withoutHours += 1;
      else row.hours = row.hours.plus(hours);
      map.set(key, row);
    };

    const byGarment = new Map<string, Row>();
    const byService = new Map<string, Row>();

    for (const wo of delivered) {
      const value = D(wo.total).minus(wo.discount);
      bump(byGarment, wo.garment?.id ?? 'none', wo.garment?.name ?? 'Sem tipo de peça', value, wo.estimatedHours);

      for (const item of wo.items) {
        if (!item.service) continue;
        const hours = item.service.estimatedHours
          ? D(item.service.estimatedHours).times(item.quantity)
          : null;
        bump(byService, item.service.id, item.service.name, item.total, hours);
      }
    }

    const toRows = (map: Map<string, Row>) =>
      [...map.values()]
        .map(r => ({
          ...r,
          // Sem hora estimada não dá para dizer quanto rende — melhor mostrar
          // vazio do que um número inventado.
          perHour: r.hours.isZero() ? null : r.value.dividedBy(r.hours).toDecimalPlaces(2),
          averageTicket: r.count ? r.value.dividedBy(r.count).toDecimalPlaces(2) : ZERO,
        }))
        .sort((a, b) => {
          if (a.perHour && b.perHour) return b.perHour.comparedTo(a.perHour);
          if (a.perHour) return -1;
          if (b.perHour) return 1;
          return b.value.comparedTo(a.value);
        });

    const business = await this.prisma.businessInfo.findFirst();
    const totalValue = delivered.reduce((s, w) => s.plus(D(w.total).minus(w.discount)), ZERO);
    const totalHours = delivered.reduce((s, w) => s.plus(w.estimatedHours ?? 0), ZERO);

    return {
      period: { start: startDate, end: endDate },
      byGarment: toRows(byGarment),
      byService: toRows(byService),
      totals: {
        deliveredCount: delivered.length,
        value: totalValue,
        hours: totalHours,
        perHour: totalHours.isZero() ? null : totalValue.dividedBy(totalHours).toDecimalPlaces(2),
        targetHourlyRate: business?.targetHourlyRate ?? null,
        withoutHours: delivered.filter(w => w.estimatedHours === null).length,
      },
    };
  }

  // ── Painel ────────────────────────────────────────────────────────────────

  /**
   * Sinais já recebidos de peças que ainda não foram entregues. É dinheiro que
   * está no caixa mas ainda tem trabalho e material pela frente — tratá-lo como
   * sobra é o jeito mais comum de um ateliê gastar o que não é dele.
   */
  private async committedDownPayments() {
    const signals = await this.prisma.accountReceivable.findMany({
      where: {
        deletedAt: null,
        isDownPayment: true,
        paidAmount: { gt: 0 },
        workOrder: { deletedAt: null, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
      },
      select: {
        id: true,
        paidAmount: true,
        customer: { select: { name: true } },
        workOrder: { select: { id: true, number: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      amount: signals.reduce((s, r) => s.plus(r.paidAmount), ZERO),
      count: signals.length,
      items: signals.map(r => ({
        id: r.id,
        amount: r.paidAmount,
        customer: r.customer?.name ?? null,
        workOrderId: r.workOrder?.id ?? null,
        workOrderNumber: r.workOrder?.number ?? null,
      })),
    };
  }

  /**
   * Projeção dia a dia até o fim do mês: parte do dinheiro em caixa e aplica os
   * vencimentos em aberto. Devolve o saldo final e o pior dia — que é a
   * informação que evita marcar uma compra na data errada.
   */

  /**
   * Painel de abertura do financeiro. Responde, numa tela só: quanto tem, quanto
   * desse dinheiro ainda não é do ateliê, como está o mês, se dá para pagar as
   * contas até o dia 31, se o faturamento cobre o custo fixo, quanto se ganha
   * por hora e quem está devendo.
   */
  async getOverview() {
    await this.markOverdue();

    const now = new Date();
    const { start, end } = this.monthBounds();
    const prev = this.monthBounds(
      `${new Date(now.getFullYear(), now.getMonth() - 1, 1).getFullYear()}-${String(
        new Date(now.getFullYear(), now.getMonth() - 1, 1).getMonth() + 1,
      ).padStart(2, '0')}`,
    );
    const today = startOfToday();

    const [
      register, entries, previousEntries, committed,
      openReceivables, openPayables, overdue, fixedCost, hourly, accounts,
    ] = await Promise.all([
      this.getCurrentCashRegister(),
      realizedEntries(this.prisma, start, end),
      realizedEntries(this.prisma, prev.start, prev.end),
      this.committedDownPayments(),
      this.prisma.accountReceivable.findMany({
        where: {
          deletedAt: null,
          status: { notIn: [...FinancialService.SETTLED] },
          dueDate: { gte: today, lte: end },
        },
        select: { dueDate: true, amount: true, paidAmount: true },
      }),
      this.prisma.accountPayable.findMany({
        where: {
          deletedAt: null,
          status: { notIn: [...FinancialService.SETTLED] },
          dueDate: { gte: today, lte: end },
        },
        select: { dueDate: true, amount: true, paidAmount: true, description: true, supplier: true },
      }),
      this.prisma.accountReceivable.findMany({
        where: { deletedAt: null, status: 'OVERDUE' },
        select: {
          id: true, description: true, dueDate: true, amount: true, paidAmount: true,
          customer: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
      this.getFixedCost(start, end),
      this.getHourlyRate(start, end),
      this.accounts.listWithBalances(),
    ]);

    const month = totals(entries);
    const previous = totals(previousEntries);

    // A reserva do ateliê tem dono: é dinheiro guardado, não caixa disponível
    // para pagar as contas do mês.
    const available = accounts.filter(a => a.active && a.kind !== 'RESERVE');
    const reserve = accounts.find(a => a.kind === 'RESERVE');
    const drawerAccount = accounts.find(a => a.kind === 'CASH_DRAWER');
    const totalAvailable = available.reduce((s, a) => s.plus(a.balance), ZERO);

    const toReceive = openReceivables.reduce((s, r) => s.plus(D(r.amount).minus(r.paidAmount)), ZERO);
    const toPay = openPayables.reduce((s, p) => s.plus(D(p.amount).minus(p.paidAmount)), ZERO);
    const projection = projectBalance(totalAvailable, openReceivables, openPayables);

    const days = (d: Date) => Math.floor((today.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);

    return {
      money: {
        accounts: available.map(a => ({
          id: a.id, name: a.name, kind: a.kind, balance: a.balance, pending: a.pending,
        })),
        total: totalAvailable,
        // Vendas no cartão que ainda não caíram: já são do ateliê, mas não dá
        // para contar com elas hoje.
        pendingCard: available.reduce((s, a) => s.plus(a.pending), ZERO),
        drawer: drawerAccount?.balance ?? ZERO,
        reserve: reserve?.balance ?? ZERO,
        cashRegisterOpen: Boolean(register),
        committed: committed.amount,
        committedCount: committed.count,
        committedItems: committed.items,
        // O que sobra depois de tirar o que ainda é obrigação.
        free: totalAvailable.minus(committed.amount),
      },
      month: {
        key: this.monthBounds().key,
        income: month.income,
        expense: month.expense,
        result: month.result,
        previousResult: previous.result,
        resultVariation: this.variation(month.result, previous.result),
      },
      untilEndOfMonth: {
        toReceive,
        toReceiveCount: openReceivables.length,
        toPay,
        toPayCount: openPayables.length,
        projectedBalance: projection.finalBalance,
        lowest: projection.lowest,
        coversPayables: projection.lowest.balance.gte(0),
      },
      health: {
        fixedCost: fixedCost.amount,
        fixedCostMode: fixedCost.mode,
        fixedCostByCategory: fixedCost.byCategory,
        invoiced: month.income,
        breakEvenReached: month.income.gte(fixedCost.amount),
        missingToBreakEven: month.income.gte(fixedCost.amount)
          ? ZERO
          : fixedCost.amount.minus(month.income),
        hourlyRate: hourly.rate,
        targetHourlyRate: (await this.prisma.businessInfo.findFirst())?.targetHourlyRate ?? null,
        deliveredWithoutHours: hourly.withoutHours,
      },
      overdue: {
        total: overdue.reduce((s, r) => s.plus(D(r.amount).minus(r.paidAmount)), ZERO),
        count: overdue.length,
        items: overdue.map(r => ({
          id: r.id,
          description: r.description,
          customerId: r.customer?.id ?? null,
          customer: r.customer?.name ?? 'Sem cliente',
          phone: r.customer?.phone ?? null,
          amount: D(r.amount).minus(r.paidAmount),
          daysOverdue: days(r.dueDate),
        })),
      },
      cashRegister: register && {
        id: register.id,
        openedAt: register.openedAt,
        expectedBalance: register.expectedBalance,
      },
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
