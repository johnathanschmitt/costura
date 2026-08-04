import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const ZERO = D(0);

/** Categoria da taxa retida pela maquininha — criada pela migration. */
export const CARD_FEE_CATEGORY = 'Taxas de cartão';

export type RealizedEntry = {
  date: Date;
  type: 'INCOME' | 'EXPENSE';
  amount: Prisma.Decimal;
  category: string | null;
  customerId: string | null;
};

/**
 * Fonte única do "realizado" do ateliê: o que entrou e saiu de dinheiro num
 * período, datado pela baixa.
 *
 * São duas origens que se somam sem se sobrepor:
 *  - o livro de pagamentos (`Payment`), uma linha por baixa de conta;
 *  - os lançamentos avulsos do caixa que não vieram de baixa (`payment: null`) —
 *    a venda direta na gaveta e a despesa paga na hora.
 *
 * Sangria e suprimento ficam de fora: são transferência de dinheiro entre a
 * gaveta e o banco, não receita nem despesa.
 *
 * Antes cada tela fazia essa conta do seu jeito: o Dashboard e os Relatórios
 * somavam `AccountReceivable.paidAmount` só das contas quitadas — o que ignora
 * pagamento parcial e joga a venda parcelada inteira no mês da última parcela —
 * enquanto o Financeiro somava os pagamentos. As três telas mostravam receitas
 * diferentes para o mesmo mês.
 */
export async function realizedEntries(
  prisma: PrismaService,
  start: Date,
  end: Date,
): Promise<RealizedEntry[]> {
  const period = { gte: start, lte: end };

  const [payments, directCash] = await Promise.all([
    prisma.payment.findMany({
      // Baixa estornada não conta: o dinheiro voltou.
      where: { paidAt: period, reversedAt: null },
      select: {
        type: true,
        amount: true,
        feeAmount: true,
        paidAt: true,
        receivable: { select: { category: true, customerId: true } },
        payable: { select: { category: true } },
      },
    }),
    prisma.cashTransaction.findMany({
      where: {
        createdAt: period,
        payment: null,
        kind: { notIn: ['WITHDRAWAL', 'SUPPLY', 'REVERSAL'] },
      },
      select: { type: true, amount: true, createdAt: true, category: true },
    }),
  ]);

  return [
    ...payments.map<RealizedEntry>(p => ({
      date: p.paidAt,
      type: p.type === 'RECEIVABLE' ? 'INCOME' : 'EXPENSE',
      amount: p.amount,
      category: (p.type === 'RECEIVABLE' ? p.receivable?.category : p.payable?.category) ?? null,
      customerId: p.receivable?.customerId ?? null,
    })),
    // A taxa da maquininha é despesa de verdade: a venda entra pelo valor cheio
    // e a taxa sai como custo, para aparecer no DRE em vez de sumir.
    ...payments
      .filter(p => p.feeAmount && !D(p.feeAmount).isZero())
      .map<RealizedEntry>(p => ({
        date: p.paidAt,
        type: 'EXPENSE',
        amount: D(p.feeAmount!),
        category: CARD_FEE_CATEGORY,
        customerId: null,
      })),
    ...directCash.map<RealizedEntry>(t => ({
      date: t.createdAt,
      type: t.type,
      amount: t.amount,
      category: t.category,
      customerId: null,
    })),
  ];
}

/** Soma das entradas e saídas, com o resultado. */
export function totals(entries: RealizedEntry[]) {
  const income = entries
    .filter(e => e.type === 'INCOME')
    .reduce((s, e) => s.plus(e.amount), ZERO);
  const expense = entries
    .filter(e => e.type === 'EXPENSE')
    .reduce((s, e) => s.plus(e.amount), ZERO);
  return { income, expense, result: income.minus(expense) };
}

/** Agrupa por categoria, com "Sem categoria" para o que ficou em branco. */
export function byCategory(entries: RealizedEntry[], type: 'INCOME' | 'EXPENSE') {
  const map = new Map<string, Prisma.Decimal>();
  for (const e of entries) {
    if (e.type !== type) continue;
    const key = e.category || 'Sem categoria';
    map.set(key, (map.get(key) ?? ZERO).plus(e.amount));
  }
  return map;
}
