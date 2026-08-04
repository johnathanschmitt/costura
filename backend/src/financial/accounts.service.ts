import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountKind, Prisma, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const ZERO = D(0);

const brl = (v: Prisma.Decimal.Value) => `R$ ${D(v).toFixed(2).replace('.', ',')}`;

/**
 * Contas onde o dinheiro fica: a gaveta, o banco, a carteira do Pix, o cofre e a
 * reserva do ateliê.
 *
 * Antes só a gaveta tinha saldo. Pix e cartão viravam um pagamento e não somavam
 * em conta nenhuma, então "quanto o ateliê tem hoje" só era respondível para o
 * dinheiro em espécie — e a sangria tirava da gaveta sem o dinheiro chegar em
 * lugar algum.
 */
@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  /** Nome das contas criadas pela migration; usadas como padrão pelo sistema. */
  static readonly DRAWER = 'Gaveta';
  static readonly RESERVE = 'Reserva do ateliê';

  async getDrawer() {
    return this.prisma.financialAccount.findFirst({ where: { kind: 'CASH_DRAWER' } });
  }

  async getReserve() {
    return this.prisma.financialAccount.findFirst({ where: { kind: 'RESERVE' } });
  }

  /**
   * Conta em que uma baixa cai.
   *
   * Dinheiro em espécie vai sempre para a gaveta — é ela que o caixa confere.
   * Nas outras formas, vale a conta escolhida na baixa e, na falta dela, a conta
   * marcada como padrão.
   */
  async resolveForPayment(method: PaymentMethod, accountId?: string) {
    if (method === PaymentMethod.CASH) return (await this.getDrawer())?.id ?? null;
    if (accountId) {
      const account = await this.prisma.financialAccount.findUnique({ where: { id: accountId } });
      if (!account) throw new NotFoundException('Conta não encontrada');
      if (!account.active) throw new BadRequestException(`A conta ${account.name} está inativa`);
      return account.id;
    }
    const fallback = await this.prisma.financialAccount.findFirst({
      where: { isDefault: true, active: true },
    });
    return fallback?.id ?? null;
  }

  /**
   * Saldo de cada conta.
   *
   * A gaveta é calculada pelos lançamentos do caixa — é o mesmo número que a
   * usuária confere no fechamento, e usar os pagamentos aqui contaria duas vezes
   * (toda baixa em espécie também vira lançamento de caixa).
   *
   * As demais contas somam as baixas que caíram nelas e as transferências.
   */
  async listWithBalances() {
    const [accounts, openRegister, lastClosed, payments, transfers] = await Promise.all([
      this.prisma.financialAccount.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] }),
      this.prisma.cashRegister.findFirst({
        where: { status: 'OPEN' },
        include: { transactions: { select: { type: true, amount: true } } },
      }),
      this.prisma.cashRegister.findFirst({
        where: { status: 'CLOSED' },
        orderBy: { closedAt: 'desc' },
        select: { countedBalance: true, closingBalance: true },
      }),
      this.prisma.payment.findMany({
        where: { reversedAt: null, accountId: { not: null } },
        select: {
          accountId: true, type: true, amount: true, netAmount: true, availableAt: true,
          reconciledAt: true,
        },
      }),
      this.prisma.accountTransfer.findMany({
        select: {
          fromAccountId: true, toAccountId: true, amount: true, cashTransactionId: true,
          reconciledAt: true,
        },
      }),
    ]);

    /**
     * O dinheiro que está na gaveta agora é o saldo do caixa aberto — abertura
     * mais entradas menos saídas. Com o caixa fechado, é o que foi contado no
     * último fechamento e ficou lá.
     *
     * Somar os lançamentos de todos os caixas daria errado: a abertura de hoje
     * costuma ser o mesmo dinheiro contado ontem, e ele seria contado duas vezes.
     */
    const drawerBalance = openRegister
      ? openRegister.transactions.reduce(
          (acc, t) => (t.type === 'INCOME' ? acc.plus(t.amount) : acc.minus(t.amount)),
          D(openRegister.openingBalance),
        )
      : D(lastClosed?.countedBalance ?? lastClosed?.closingBalance ?? 0);

    const now = new Date();

    return accounts.map(account => {
      const isDrawer = account.kind === AccountKind.CASH_DRAWER;
      // Na gaveta o saldo inicial da conta não entra: quem manda é a abertura
      // do caixa, que é o dinheiro fisicamente contado.
      let balance = isDrawer ? drawerBalance : D(account.openingBalance);
      // Venda no cartão que ainda não caiu: já é do ateliê, mas não dá para
      // gastar hoje — some do saldo e aparece à parte.
      let pending = ZERO;
      // Lançamento que ainda não passou pelos olhos de ninguém contra o extrato
      // do banco. A gaveta é conferida contando dinheiro, no fechamento.
      let unreconciled = 0;

      if (!isDrawer) {
        for (const p of payments) {
          if (p.accountId !== account.id) continue;
          if (!p.reconciledAt) unreconciled += 1;
          // No cartão o que cai na conta é o líquido, não o que a cliente pagou.
          const value = D(p.netAmount ?? p.amount);
          if (p.type === 'PAYABLE') {
            balance = balance.minus(p.amount);
          } else if (!p.availableAt || p.availableAt <= now) {
            balance = balance.plus(value);
          } else {
            pending = pending.plus(value);
          }
        }
      }

      for (const t of transfers) {
        // A sangria já saiu do saldo da gaveta como lançamento do caixa;
        // contar também a transferência tiraria o valor duas vezes.
        if (isDrawer && t.cashTransactionId) continue;
        const touches = t.toAccountId === account.id || t.fromAccountId === account.id;
        if (touches && !isDrawer && !t.reconciledAt) unreconciled += 1;
        if (t.toAccountId === account.id) balance = balance.plus(t.amount);
        if (t.fromAccountId === account.id) balance = balance.minus(t.amount);
      }

      return { ...account, balance, pending, unreconciled };
    });
  }

  async getBalance(accountId: string) {
    const all = await this.listWithBalances();
    const found = all.find(a => a.id === accountId);
    if (!found) throw new NotFoundException('Conta não encontrada');
    return found;
  }

  async create(dto: { name: string; kind: AccountKind; openingBalance?: number; isDefault?: boolean }) {
    const exists = await this.prisma.financialAccount.findUnique({ where: { name: dto.name } });
    if (exists) throw new BadRequestException('Já existe uma conta com esse nome');
    if (dto.kind === AccountKind.CASH_DRAWER) {
      throw new BadRequestException('A gaveta do caixa já existe e é única');
    }
    if (dto.isDefault) await this.clearDefault();
    return this.prisma.financialAccount.create({
      data: {
        name: dto.name,
        kind: dto.kind,
        openingBalance: D(dto.openingBalance ?? 0),
        isDefault: dto.isDefault ?? false,
        order: 5,
      },
    });
  }

  async update(
    id: string,
    dto: { name?: string; active?: boolean; isDefault?: boolean; openingBalance?: number },
  ) {
    const account = await this.prisma.financialAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Conta não encontrada');
    if (account.isSystem && dto.name && dto.name !== account.name) {
      throw new BadRequestException('Conta do sistema não pode ser renomeada');
    }
    if (account.isSystem && dto.active === false) {
      throw new BadRequestException('Conta do sistema não pode ser desativada');
    }
    if (dto.isDefault) await this.clearDefault();
    return this.prisma.financialAccount.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.active !== undefined && { active: dto.active }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        ...(dto.openingBalance !== undefined && { openingBalance: D(dto.openingBalance) }),
      },
    });
  }

  async remove(id: string) {
    const account = await this.prisma.financialAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Conta não encontrada');
    if (account.isSystem) {
      throw new BadRequestException('Conta do sistema não pode ser removida — desative-a');
    }

    // Remover uma conta com movimento apagaria a origem de lançamentos que já
    // aconteceram; desativar preserva o histórico e some dos seletores.
    const [payments, transfers] = await Promise.all([
      this.prisma.payment.count({ where: { accountId: id } }),
      this.prisma.accountTransfer.count({
        where: { OR: [{ fromAccountId: id }, { toAccountId: id }] },
      }),
    ]);
    if (payments + transfers > 0) {
      throw new BadRequestException(
        `Esta conta tem ${payments + transfers} movimentação(ões) — desative-a em vez de remover.`,
      );
    }
    await this.prisma.financialAccount.delete({ where: { id } });
    return { removed: true };
  }

  private clearDefault() {
    return this.prisma.financialAccount.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  /**
   * Transferência entre contas: dinheiro mudando de lugar, não resultado.
   *
   * A transferência que sai da gaveta é a sangria, e ela precisa passar pelo
   * caixa (`FinancialService.transfer`) para o saldo conferido continuar certo —
   * por isso aqui a gaveta é bloqueada como origem.
   */
  async transfer(
    dto: { fromAccountId: string; toAccountId: string; amount: number; reason: string },
    userId?: string,
  ) {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException('Escolha contas diferentes para a transferência');
    }
    const [from, to] = await Promise.all([
      this.getBalance(dto.fromAccountId),
      this.getBalance(dto.toAccountId),
    ]);
    if (from.kind === AccountKind.CASH_DRAWER) {
      throw new BadRequestException(
        'Para tirar dinheiro da gaveta use a sangria, no caixa — assim o fechamento continua batendo.',
      );
    }
    if (to.kind === AccountKind.CASH_DRAWER) {
      throw new BadRequestException(
        'Para colocar dinheiro na gaveta use o suprimento, no caixa.',
      );
    }

    const amount = D(dto.amount);
    if (amount.gt(from.balance)) {
      throw new BadRequestException(
        `A transferência de ${brl(amount)} passa do saldo de ${from.name} (${brl(from.balance)})`,
      );
    }

    return this.prisma.accountTransfer.create({
      data: {
        fromAccountId: dto.fromAccountId,
        toAccountId: dto.toAccountId,
        amount,
        reason: dto.reason,
        userId: userId ?? null,
      },
      include: {
        fromAccount: { select: { name: true } },
        toAccount: { select: { name: true } },
      },
    });
  }

  /**
   * Marca um lançamento como conferido contra o extrato do banco.
   *
   * Conciliar é o que separa "o sistema acha que tem" de "o banco confirma que
   * tem": sem isso, um Pix que não caiu ou uma tarifa não lançada só aparecem
   * quando o dinheiro falta.
   */
  async toggleReconciled(kind: 'PAYMENT' | 'TRANSFER', id: string, reconciled: boolean) {
    const at = reconciled ? new Date() : null;
    if (kind === 'PAYMENT') {
      const payment = await this.prisma.payment.findUnique({ where: { id } });
      if (!payment) throw new NotFoundException('Lançamento não encontrado');
      return this.prisma.payment.update({ where: { id }, data: { reconciledAt: at } });
    }
    const transfer = await this.prisma.accountTransfer.findUnique({ where: { id } });
    if (!transfer) throw new NotFoundException('Transferência não encontrada');
    return this.prisma.accountTransfer.update({ where: { id }, data: { reconciledAt: at } });
  }

  /**
   * "Conferi até tal dia": marca tudo até a data e guarda até onde a conta foi
   * conferida, para a tela mostrar o que ainda não passou pelos olhos de ninguém.
   */
  async reconcileUntil(accountId: string, until: string) {
    const account = await this.prisma.financialAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException('Conta não encontrada');
    if (account.kind === AccountKind.CASH_DRAWER) {
      throw new BadRequestException(
        'A gaveta é conferida no fechamento do caixa, contando o dinheiro.',
      );
    }

    const date = new Date(until);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Data inválida');
    date.setHours(23, 59, 59, 999);
    if (date > new Date()) throw new BadRequestException('Não dá para conferir uma data futura');

    const [payments, transfers] = await this.prisma.$transaction([
      this.prisma.payment.updateMany({
        where: { accountId, reversedAt: null, reconciledAt: null, paidAt: { lte: date } },
        data: { reconciledAt: new Date() },
      }),
      this.prisma.accountTransfer.updateMany({
        where: {
          reconciledAt: null,
          createdAt: { lte: date },
          OR: [{ fromAccountId: accountId }, { toAccountId: accountId }],
        },
        data: { reconciledAt: new Date() },
      }),
    ]);

    await this.prisma.financialAccount.update({
      where: { id: accountId },
      data: { reconciledUntil: date },
    });

    return { reconciled: payments.count + transfers.count, until: date };
  }

  /** Extrato da conta: baixas que caíram nela e transferências. */
  async statement(accountId: string, startDate?: string, endDate?: string) {
    const account = await this.getBalance(accountId);
    const period = {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    };
    const hasPeriod = Boolean(startDate || endDate);

    const [payments, transfersIn, transfersOut, cash] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          accountId,
          reversedAt: null,
          ...(hasPeriod && { paidAt: period }),
        },
        orderBy: { paidAt: 'desc' },
        take: 200,
        include: {
          receivable: { select: { description: true, customer: { select: { name: true } } } },
          payable: { select: { description: true, supplier: true } },
        },
      }),
      this.prisma.accountTransfer.findMany({
        where: { toAccountId: accountId, ...(hasPeriod && { createdAt: period }) },
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: { fromAccount: { select: { name: true } } },
      }),
      this.prisma.accountTransfer.findMany({
        where: { fromAccountId: accountId, ...(hasPeriod && { createdAt: period }) },
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: { toAccount: { select: { name: true } } },
      }),
      // A gaveta se explica pelos lançamentos do caixa, não pelos pagamentos.
      account.kind === AccountKind.CASH_DRAWER
        ? this.prisma.cashTransaction.findMany({
            where: hasPeriod ? { createdAt: period } : {},
            orderBy: { createdAt: 'desc' },
            take: 200,
          })
        : Promise.resolve([]),
    ]);

    const entries = [
      ...(account.kind === AccountKind.CASH_DRAWER
        ? cash.map(t => ({
            id: t.id,
            date: t.createdAt,
            reconciledAt: null,
            description: t.description,
            type: t.type,
            amount: t.amount,
            source: 'CASH' as const,
          }))
        : payments.map(p => ({
            id: p.id,
            date: p.paidAt,
            reconciledAt: p.reconciledAt,
            description:
              p.type === 'RECEIVABLE'
                ? `${p.receivable?.description ?? 'Recebimento'}${p.receivable?.customer?.name ? ` — ${p.receivable.customer.name}` : ''}`
                : `${p.payable?.description ?? 'Pagamento'}${p.payable?.supplier ? ` — ${p.payable.supplier}` : ''}`,
            type: p.type === 'RECEIVABLE' ? 'INCOME' : 'EXPENSE',
            amount: p.amount,
            source: 'PAYMENT' as const,
          }))),
      ...transfersIn.map(t => ({
        id: t.id,
        date: t.createdAt,
        reconciledAt: t.reconciledAt,
        description: `Transferência de ${t.fromAccount.name} — ${t.reason}`,
        type: 'INCOME' as const,
        amount: t.amount,
        source: 'TRANSFER' as const,
      })),
      ...transfersOut.map(t => ({
        id: t.id,
        date: t.createdAt,
        reconciledAt: t.reconciledAt,
        description: `Transferência para ${t.toAccount.name} — ${t.reason}`,
        type: 'EXPENSE' as const,
        amount: t.amount,
        source: 'TRANSFER' as const,
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    return { account, entries };
  }
}
