import {
  ageBuckets, cardSettlement, countBreakdownTotal, D, daysOverdue, expectedDrawerBalance,
  percentTotal, projectBalance, splitResult,
} from './money';

/**
 * Testes da aritmética do dinheiro.
 *
 * O que se protege aqui é o tipo de erro que ninguém vê na tela: um centavo que
 * some no rateio, uma conta que cai na faixa de atraso errada, uma projeção que
 * fecha no azul escondendo o dia em que falta dinheiro.
 */

const dia = (iso: string) => new Date(`${iso}T00:00:00`);

describe('expectedDrawerBalance', () => {
  it('soma entradas e subtrai saídas a partir da abertura', () => {
    const saldo = expectedDrawerBalance(200, [
      { type: 'INCOME', amount: 150 },
      { type: 'EXPENSE', amount: 40 },
      { type: 'INCOME', amount: 10 },
    ]);
    expect(saldo.toFixed(2)).toBe('320.00');
  });

  it('não perde centavo em valores quebrados', () => {
    const saldo = expectedDrawerBalance(0, [
      { type: 'INCOME', amount: '0.10' },
      { type: 'INCOME', amount: '0.20' },
    ]);
    // Com número comum isto daria 0.30000000000000004.
    expect(saldo.toFixed(2)).toBe('0.30');
  });

  it('aceita ficar negativo — é assim que a falta aparece na conferência', () => {
    expect(expectedDrawerBalance(50, [{ type: 'EXPENSE', amount: 80 }]).toFixed(2)).toBe('-30.00');
  });
});

describe('countBreakdownTotal', () => {
  it('soma as cédulas contadas', () => {
    expect(countBreakdownTotal({ '100': 3, '50': 2, '10': 4 }).toFixed(2)).toBe('440.00');
  });

  it('conta moedas sem erro de arredondamento', () => {
    expect(countBreakdownTotal({ '0.5': 3, '0.25': 2, '0.05': 1 }).toFixed(2)).toBe('2.05');
  });

  it('ignora quantidade vazia', () => {
    expect(countBreakdownTotal({ '100': 0, '50': 1 } as any).toFixed(2)).toBe('50.00');
  });
});

describe('splitResult', () => {
  const socias = [
    { userId: 'a', percent: 40 },
    { userId: 'b', percent: 30 },
    { userId: 'c', percent: 10 },
  ];

  it('divide pelos percentuais e o ateliê fica com o resto', () => {
    const { shares, atelierShare } = splitResult(300, socias);
    expect(shares.map(s => s.amount.toFixed(2))).toEqual(['120.00', '90.00', '30.00']);
    expect(atelierShare.toFixed(2)).toBe('60.00');
  });

  it('a soma das partes bate exatamente com o valor dividido', () => {
    // 1000 / 3 não fecha em centavos: é onde o dinheiro costuma sumir.
    const tres = [
      { userId: 'a', percent: '33.33' },
      { userId: 'b', percent: '33.33' },
      { userId: 'c', percent: '33.34' },
    ];
    const { shares, atelierShare } = splitResult('1000.05', tres);
    const soma = shares.reduce((s, x) => s.plus(x.amount), atelierShare);
    expect(soma.toFixed(2)).toBe('1000.05');
  });

  it('arredonda a parte da sócia para baixo, nunca para cima', () => {
    // 10% de 10,05 = 1,005 → a sócia leva 1,00 e o centavo fica com o ateliê.
    const { shares, atelierShare } = splitResult('10.05', [{ userId: 'a', percent: 10 }]);
    expect(shares[0].amount.toFixed(2)).toBe('1.00');
    expect(atelierShare.toFixed(2)).toBe('9.05');
  });

  it('não distribui nada quando não sobrou resultado', () => {
    const { shares, atelierShare } = splitResult(0, socias);
    expect(shares.every(s => s.amount.isZero())).toBe(true);
    expect(atelierShare.isZero()).toBe(true);
  });

  it('mês negativo não vira parte negativa para ninguém', () => {
    const { shares, atelierShare } = splitResult(-500, socias);
    expect(shares.every(s => s.amount.isZero())).toBe(true);
    expect(atelierShare.isZero()).toBe(true);
  });
});

describe('percentTotal', () => {
  it('soma as sócias com o ateliê', () => {
    expect(percentTotal(20, [{ percent: 40 }, { percent: 30 }, { percent: 10 }]).toFixed(2))
      .toBe('100.00');
  });

  it('acusa quando falta fechar', () => {
    expect(percentTotal(20, [{ percent: 30 }, { percent: 30 }]).equals(100)).toBe(false);
  });
});

describe('daysOverdue', () => {
  const hoje = dia('2026-08-03');

  it('conta os dias desde o vencimento', () => {
    expect(daysOverdue(dia('2026-07-04'), hoje)).toBe(30);
  });

  it('vencimento de hoje ainda não está atrasado', () => {
    expect(daysOverdue(hoje, hoje)).toBe(0);
  });

  it('vencimento futuro devolve negativo', () => {
    expect(daysOverdue(dia('2026-08-13'), hoje)).toBe(-10);
  });

  it('ignora a hora do vencimento', () => {
    expect(daysOverdue(new Date('2026-08-02T23:30:00'), hoje)).toBe(1);
  });
});

describe('ageBuckets', () => {
  const hoje = dia('2026-08-03');

  it('separa por faixa de atraso', () => {
    const { buckets, total, overdue } = ageBuckets([
      { dueDate: dia('2026-08-20'), amount: 200, paidAmount: 0 },   // a vencer
      { dueDate: dia('2026-07-20'), amount: 100, paidAmount: 0 },   // 14 dias
      { dueDate: dia('2026-06-20'), amount: 380, paidAmount: 0 },   // 44 dias
      { dueDate: dia('2026-04-01'), amount: 500, paidAmount: 100 }, // 124 dias, parcial
    ], hoje);

    expect(buckets.map(b => b.amount.toFixed(2)))
      .toEqual(['200.00', '100.00', '380.00', '400.00']);
    expect(total.toFixed(2)).toBe('1080.00');
    expect(overdue.toFixed(2)).toBe('880.00');
  });

  it('conta só o saldo em aberto, não o valor cheio', () => {
    const { total } = ageBuckets(
      [{ dueDate: dia('2026-07-01'), amount: 300, paidAmount: 250 }],
      hoje,
    );
    expect(total.toFixed(2)).toBe('50.00');
  });

  it('ignora conta já quitada', () => {
    const { total, buckets } = ageBuckets(
      [{ dueDate: dia('2026-07-01'), amount: 300, paidAmount: 300 }],
      hoje,
    );
    expect(total.isZero()).toBe(true);
    expect(buckets.every(b => b.count === 0)).toBe(true);
  });

  it('a virada de 30 para 31 dias cai na faixa seguinte', () => {
    const trinta = ageBuckets([{ dueDate: dia('2026-07-04'), amount: 10, paidAmount: 0 }], hoje);
    const trintaEUm = ageBuckets([{ dueDate: dia('2026-07-03'), amount: 10, paidAmount: 0 }], hoje);
    expect(trinta.buckets[1].count).toBe(1);
    expect(trintaEUm.buckets[2].count).toBe(1);
  });
});

describe('projectBalance', () => {
  it('aplica os vencimentos e devolve o saldo final', () => {
    const { finalBalance } = projectBalance(
      1000,
      [{ dueDate: dia('2026-08-10'), amount: 500, paidAmount: 0 }],
      [{ dueDate: dia('2026-08-20'), amount: 300, paidAmount: 0 }],
    );
    expect(finalBalance.toFixed(2)).toBe('1200.00');
  });

  it('encontra o pior dia mesmo quando o mês fecha no azul', () => {
    // Fecha com 1.200, mas no dia 5 o saldo cai para 100 — é esse o aviso útil.
    const { finalBalance, lowest } = projectBalance(
      1000,
      [{ dueDate: dia('2026-08-25'), amount: 1100, paidAmount: 0 }],
      [{ dueDate: dia('2026-08-05'), amount: 900, paidAmount: 0 }],
    );
    expect(finalBalance.toFixed(2)).toBe('1200.00');
    expect(lowest.date).toBe('2026-08-05');
    expect(lowest.balance.toFixed(2)).toBe('100.00');
  });

  it('desconta só o que falta receber de uma conta parcial', () => {
    const { finalBalance } = projectBalance(
      0,
      [{ dueDate: dia('2026-08-10'), amount: 500, paidAmount: 200 }],
      [],
    );
    expect(finalBalance.toFixed(2)).toBe('300.00');
  });

  it('sem vencimento nenhum, o saldo é o de hoje', () => {
    const { finalBalance, lowest } = projectBalance(750, [], []);
    expect(finalBalance.toFixed(2)).toBe('750.00');
    expect(lowest.balance.toFixed(2)).toBe('750.00');
  });

  it('acusa saldo negativo no caminho', () => {
    const { lowest } = projectBalance(
      100,
      [],
      [{ dueDate: dia('2026-08-12'), amount: 400, paidAmount: 0 }],
    );
    expect(lowest.balance.isNegative()).toBe(true);
    expect(lowest.date).toBe('2026-08-12');
  });
});

describe('cardSettlement', () => {
  const maquininha = { debitFeePercent: 1.99, creditFeePercent: 3.5, debitDays: 1, creditDays: 30 };

  it('desconta a taxa do crédito e joga o dinheiro para D+30', () => {
    const { fee, net, availableAt } = cardSettlement(200, 'CREDIT_CARD', maquininha, dia('2026-08-03'));
    expect(fee.toFixed(2)).toBe('7.00');
    expect(net.toFixed(2)).toBe('193.00');
    expect(availableAt.toISOString().slice(0, 10)).toBe('2026-09-02');
  });

  it('débito tem taxa e prazo próprios', () => {
    const { fee, net, availableAt } = cardSettlement(100, 'DEBIT_CARD', maquininha, dia('2026-08-03'));
    expect(fee.toFixed(2)).toBe('1.99');
    expect(net.toFixed(2)).toBe('98.01');
    expect(availableAt.toISOString().slice(0, 10)).toBe('2026-08-04');
  });

  it('bruto menos taxa é sempre o líquido, sem centavo perdido', () => {
    const { fee, net } = cardSettlement('333.33', 'CREDIT_CARD', maquininha);
    expect(fee.plus(net).toFixed(2)).toBe('333.33');
  });

  it('dinheiro e Pix não passam pela maquininha', () => {
    for (const forma of ['CASH', 'PIX', 'TRANSFER']) {
      const r = cardSettlement(200, forma, maquininha, dia('2026-08-03'));
      expect(r.isCard).toBe(false);
      expect(r.fee.isZero()).toBe(true);
      expect(r.net.toFixed(2)).toBe('200.00');
      expect(r.availableAt.toISOString().slice(0, 10)).toBe('2026-08-03');
    }
  });

  it('sem taxa e sem prazo configurados, o cartão se comporta como antes', () => {
    const r = cardSettlement(200, 'CREDIT_CARD', {}, dia('2026-08-03'));
    expect(r.fee.isZero()).toBe(true);
    expect(r.net.toFixed(2)).toBe('200.00');
    expect(r.availableAt.toISOString().slice(0, 10)).toBe('2026-08-03');
  });

  it('arredonda a taxa no centavo mais próximo', () => {
    // 3,5% de 10,15 = 0,35525
    expect(cardSettlement('10.15', 'CREDIT_CARD', maquininha).fee.toFixed(2)).toBe('0.36');
  });

  it('a virada do mês no prazo cai no mês seguinte', () => {
    const { availableAt } = cardSettlement(
      100, 'CREDIT_CARD', { creditFeePercent: 0, creditDays: 30 }, dia('2026-01-31'),
    );
    expect(availableAt.toISOString().slice(0, 10)).toBe('2026-03-02');
  });
});

describe('D (Decimal)', () => {
  it('soma centavos sem o erro do ponto flutuante', () => {
    expect(D('0.1').plus('0.2').toFixed(2)).toBe('0.30');
  });
});
