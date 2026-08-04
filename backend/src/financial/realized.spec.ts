import { byCategory, realizedEntries, totals, RealizedEntry } from './realized';
import { D } from './money';

/**
 * O "realizado" é a fonte única de tudo que o financeiro mostra: painel, DRE,
 * resultado do mês, divisão e relatórios. Se ele contar uma coisa a mais ou a
 * menos, todas as telas mentem juntas — e foi exatamente isso que acontecia
 * quando cada uma fazia a própria consulta.
 */

const entrada = (over: Partial<RealizedEntry> = {}): RealizedEntry => ({
  date: new Date('2026-08-10'),
  type: 'INCOME',
  amount: D(100),
  category: 'Costura',
  customerId: null,
  ...over,
});

describe('totals', () => {
  it('separa entrada de saída e devolve o resultado', () => {
    const t = totals([
      entrada({ amount: D(500) }),
      entrada({ amount: D(300) }),
      entrada({ type: 'EXPENSE', amount: D(200), category: 'Materiais' }),
    ]);
    expect(t.income.toFixed(2)).toBe('800.00');
    expect(t.expense.toFixed(2)).toBe('200.00');
    expect(t.result.toFixed(2)).toBe('600.00');
  });

  it('devolve zero quando não houve movimento', () => {
    const t = totals([]);
    expect(t.income.isZero()).toBe(true);
    expect(t.result.isZero()).toBe(true);
  });

  it('mês de prejuízo devolve resultado negativo', () => {
    const t = totals([entrada({ type: 'EXPENSE', amount: D(1200) })]);
    expect(t.result.toFixed(2)).toBe('-1200.00');
  });
});

describe('byCategory', () => {
  it('agrupa pelo nome da categoria', () => {
    const map = byCategory([
      entrada({ amount: D(500), category: 'Costura' }),
      entrada({ amount: D(120), category: 'Ajuste' }),
      entrada({ amount: D(80), category: 'Costura' }),
    ], 'INCOME');

    expect(map.get('Costura')!.toFixed(2)).toBe('580.00');
    expect(map.get('Ajuste')!.toFixed(2)).toBe('120.00');
  });

  it('junta o que está sem categoria numa linha só', () => {
    const map = byCategory([
      entrada({ amount: D(50), category: null }),
      entrada({ amount: D(70), category: null }),
    ], 'INCOME');
    expect(map.get('Sem categoria')!.toFixed(2)).toBe('120.00');
  });

  it('não mistura receita com despesa', () => {
    const entries = [
      entrada({ amount: D(500), category: 'Costura' }),
      entrada({ type: 'EXPENSE', amount: D(200), category: 'Costura' }),
    ];
    expect(byCategory(entries, 'INCOME').get('Costura')!.toFixed(2)).toBe('500.00');
    expect(byCategory(entries, 'EXPENSE').get('Costura')!.toFixed(2)).toBe('200.00');
  });
});

describe('realizedEntries', () => {
  /**
   * Prisma de mentira: devolve o que cada consulta traria e guarda os filtros
   * usados, que é justamente o que precisa estar certo aqui.
   */
  const fakePrisma = (payments: any[], cash: any[]) => {
    const calls: any = {};
    return {
      calls,
      prisma: {
        payment: {
          findMany: jest.fn(async (args: any) => { calls.payment = args; return payments; }),
        },
        cashTransaction: {
          findMany: jest.fn(async (args: any) => { calls.cash = args; return cash; }),
        },
      } as any,
    };
  };

  it('junta as baixas de contas com os lançamentos avulsos do caixa', async () => {
    const { prisma } = fakePrisma(
      [{
        type: 'RECEIVABLE', amount: D(300), paidAt: new Date('2026-08-05'),
        receivable: { category: 'Costura', customerId: 'c1' }, payable: null,
      }],
      [{ type: 'INCOME', amount: D(50), createdAt: new Date('2026-08-06'), category: 'Ajuste' }],
    );

    const entries = await realizedEntries(prisma, new Date('2026-08-01'), new Date('2026-08-31'));
    expect(entries).toHaveLength(2);
    expect(totals(entries).income.toFixed(2)).toBe('350.00');
  });

  it('baixa de conta a pagar vira saída', async () => {
    const { prisma } = fakePrisma(
      [{
        type: 'PAYABLE', amount: D(200), paidAt: new Date('2026-08-05'),
        receivable: null, payable: { category: 'Materiais' },
      }],
      [],
    );
    const entries = await realizedEntries(prisma, new Date('2026-08-01'), new Date('2026-08-31'));
    expect(entries[0].type).toBe('EXPENSE');
    expect(entries[0].category).toBe('Materiais');
  });

  it('não conta baixa estornada', async () => {
    const { prisma, calls } = fakePrisma([], []);
    await realizedEntries(prisma, new Date('2026-08-01'), new Date('2026-08-31'));
    expect(calls.payment.where.reversedAt).toBeNull();
  });

  it('deixa de fora sangria, suprimento e estorno do caixa', async () => {
    const { prisma, calls } = fakePrisma([], []);
    await realizedEntries(prisma, new Date('2026-08-01'), new Date('2026-08-31'));
    expect(calls.cash.where.kind.notIn).toEqual(['WITHDRAWAL', 'SUPPLY', 'REVERSAL']);
  });

  it('não conta duas vezes a baixa em espécie', async () => {
    // A baixa em dinheiro gera um lançamento no caixa ligado ao pagamento; só os
    // avulsos (payment: null) entram, senão o valor apareceria dobrado.
    const { prisma, calls } = fakePrisma([], []);
    await realizedEntries(prisma, new Date('2026-08-01'), new Date('2026-08-31'));
    expect(calls.cash.where.payment).toBeNull();
  });

  it('respeita o período pedido nas duas origens', async () => {
    const { prisma, calls } = fakePrisma([], []);
    const start = new Date('2026-08-01');
    const end = new Date('2026-08-31');
    await realizedEntries(prisma, start, end);
    expect(calls.payment.where.paidAt).toEqual({ gte: start, lte: end });
    expect(calls.cash.where.createdAt).toEqual({ gte: start, lte: end });
  });
});
