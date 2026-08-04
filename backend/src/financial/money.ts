import { Prisma } from '@prisma/client';

/**
 * As contas de dinheiro do ateliê, separadas do banco e do Nest.
 *
 * Ficam aqui porque é onde mora o risco: um centavo errado no rateio, uma faixa
 * de atraso deslocada por um dia ou uma projeção que ignora um vencimento são
 * erros silenciosos — ninguém percebe olhando a tela. Sendo funções puras, dá
 * para testá-las de verdade, sem subir banco.
 */

export const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
export const ZERO = D(0);

export const brl = (v: Prisma.Decimal.Value) =>
  `R$ ${D(v).toFixed(2).replace('.', ',')}`;

/** Início do dia de hoje — vencimento é por dia, não por hora. */
export function startOfToday(now: Date = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Dias de atraso de um vencimento; negativo quando ainda vai vencer. */
export function daysOverdue(dueDate: Date, today: Date = startOfToday()) {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - due.getTime()) / 86_400_000);
}

/** Saldo que deveria haver na gaveta: abertura + entradas − saídas. */
export function expectedDrawerBalance(
  openingBalance: Prisma.Decimal.Value,
  transactions: { type: 'INCOME' | 'EXPENSE'; amount: Prisma.Decimal.Value }[],
) {
  return transactions.reduce(
    (acc, t) => (t.type === 'INCOME' ? acc.plus(t.amount) : acc.minus(t.amount)),
    D(openingBalance),
  );
}

/** Quanto a contagem por cédula soma: 3 notas de 100 + 2 de 50 = 400. */
export function countBreakdownTotal(breakdown: Record<string, number>) {
  return Object.entries(breakdown).reduce(
    (sum, [note, qty]) => sum.plus(D(note).times(qty || 0)),
    ZERO,
  );
}

export type ShareInput = { userId: string; percent: Prisma.Decimal.Value };
export type ShareResult = { userId: string; percent: Prisma.Decimal; amount: Prisma.Decimal };

/**
 * Rateio do resultado entre as sócias e o ateliê.
 *
 * Cada parte é arredondada para baixo e a diferença que sobra fica com o
 * ateliê — assim a soma das partes bate exatamente com o valor dividido, sem
 * criar nem sumir com centavo.
 */
export function splitResult(
  distributable: Prisma.Decimal.Value,
  shares: ShareInput[],
): { shares: ShareResult[]; atelierShare: Prisma.Decimal } {
  const total = D(distributable);
  if (total.lte(0)) {
    return {
      shares: shares.map(s => ({ userId: s.userId, percent: D(s.percent), amount: ZERO })),
      atelierShare: ZERO,
    };
  }

  const result = shares.map(s => ({
    userId: s.userId,
    percent: D(s.percent),
    amount: total.times(D(s.percent)).dividedBy(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN),
  }));

  const distributed = result.reduce((sum, s) => sum.plus(s.amount), ZERO);
  return { shares: result, atelierShare: total.minus(distributed) };
}

/** A soma dos percentuais das sócias mais o do ateliê tem que fechar 100%. */
export function percentTotal(
  atelierPercent: Prisma.Decimal.Value,
  shares: { percent: Prisma.Decimal.Value }[],
) {
  return shares.reduce((sum, s) => sum.plus(s.percent), D(atelierPercent));
}

export type AgingEntry = { dueDate: Date; amount: Prisma.Decimal.Value; paidAmount: Prisma.Decimal.Value };

/**
 * Idade da dívida em faixas. Um total de "R$ 4.000 a receber" não diz nada;
 * saber que R$ 600 estão parados há mais de 60 dias diz que é hora de cobrar.
 */
export function ageBuckets(entries: AgingEntry[], today: Date = startOfToday()) {
  const buckets = [
    { key: 'current', label: 'A vencer', amount: ZERO, count: 0 },
    { key: 'd1_30', label: '1 a 30 dias', amount: ZERO, count: 0 },
    { key: 'd31_60', label: '31 a 60 dias', amount: ZERO, count: 0 },
    { key: 'd60plus', label: 'mais de 60 dias', amount: ZERO, count: 0 },
  ];

  for (const e of entries) {
    const remaining = D(e.amount).minus(e.paidAmount);
    if (remaining.lte(0)) continue;
    const days = daysOverdue(e.dueDate, today);
    const bucket = days <= 0 ? buckets[0]
      : days <= 30 ? buckets[1]
      : days <= 60 ? buckets[2]
      : buckets[3];
    bucket.amount = bucket.amount.plus(remaining);
    bucket.count += 1;
  }

  return {
    buckets,
    total: buckets.reduce((s, b) => s.plus(b.amount), ZERO),
    overdue: buckets.slice(1).reduce((s, b) => s.plus(b.amount), ZERO),
  };
}

export type CardConfig = {
  debitFeePercent?: Prisma.Decimal.Value | null;
  creditFeePercent?: Prisma.Decimal.Value | null;
  debitDays?: number | null;
  creditDays?: number | null;
};

/**
 * O que a maquininha faz com uma venda no cartão.
 *
 * A cliente paga R$ 200 e o ateliê não recebe R$ 200: a adquirente fica com a
 * taxa e deposita o líquido dias depois. Tratar os R$ 200 como dinheiro em
 * conta no mesmo dia é o erro que faz o saldo do sistema nunca bater com o do
 * banco — e some com a taxa, que é despesa de verdade.
 *
 * Com taxa e prazo zerados (maquininha não usada), o cartão se comporta como
 * qualquer outra forma: valor cheio, disponível na hora.
 */
export function cardSettlement(
  amount: Prisma.Decimal.Value,
  method: 'CREDIT_CARD' | 'DEBIT_CARD' | string,
  config: CardConfig,
  paidAt: Date = new Date(),
) {
  const gross = D(amount);
  const isCard = method === 'CREDIT_CARD' || method === 'DEBIT_CARD';
  if (!isCard) return { fee: ZERO, net: gross, availableAt: paidAt, isCard: false };

  const isCredit = method === 'CREDIT_CARD';
  const percent = D((isCredit ? config.creditFeePercent : config.debitFeePercent) ?? 0);
  const days = (isCredit ? config.creditDays : config.debitDays) ?? 0;

  const fee = gross.times(percent).dividedBy(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const availableAt = new Date(paidAt);
  availableAt.setDate(availableAt.getDate() + days);

  return { fee, net: gross.minus(fee), availableAt, isCard: true };
}

export type DueEntry = { dueDate: Date; amount: Prisma.Decimal.Value; paidAmount: Prisma.Decimal.Value };

/**
 * Projeção dia a dia: parte do dinheiro em caixa e aplica os vencimentos em
 * aberto na ordem das datas.
 *
 * O saldo final não basta: o que muda a decisão é o pior dia do caminho — dá
 * para o mês fechar no azul e mesmo assim faltar dinheiro no dia 12.
 */
export function projectBalance(
  startingBalance: Prisma.Decimal.Value,
  receivables: DueEntry[],
  payables: DueEntry[],
) {
  const dayKey = (d: Date) => new Date(d).toISOString().slice(0, 10);
  const perDay = new Map<string, Prisma.Decimal>();
  const add = (d: Date, v: Prisma.Decimal) =>
    perDay.set(dayKey(d), (perDay.get(dayKey(d)) ?? ZERO).plus(v));

  for (const r of receivables) add(r.dueDate, D(r.amount).minus(r.paidAmount));
  for (const p of payables) add(p.dueDate, D(p.amount).minus(p.paidAmount).negated());

  let running = D(startingBalance);
  let lowest = { date: dayKey(new Date()), balance: running };

  for (const day of [...perDay.keys()].sort()) {
    running = running.plus(perDay.get(day)!);
    if (running.lt(lowest.balance)) lowest = { date: day, balance: running };
  }

  return { finalBalance: running, lowest };
}
