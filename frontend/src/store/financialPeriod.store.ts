import { create } from 'zustand';
import dayjs from 'dayjs';

/**
 * O período é do módulo, não de cada tela.
 *
 * Havia três seletores independentes — o navegador de mês das contas, as setas
 * do resultado e o De/Até das telas de análise —, cada um guardando o próprio
 * estado. Mudar para julho em "A Receber" e abrir "Resultado" levava de volta a
 * agosto, e a usuária refazia a escolha a cada tela.
 *
 * Aqui `month` e o par `from`/`to` são a mesma verdade vista de dois jeitos:
 * escolher o mês reposiciona o intervalo, e escolher um intervalo reposiciona o
 * mês pela data inicial.
 */
interface PeriodState {
  /** Mês exibido, no formato AAAA-MM. */
  month: string;
  /** Intervalo livre, para as telas que aceitam períodos que não são um mês. */
  from: string;
  to: string;
  /** Vencidos de meses anteriores continuam na lista das contas. */
  includeOverdue: boolean;
  setMonth: (month: string) => void;
  setRange: (from: string, to: string) => void;
  setIncludeOverdue: (value: boolean) => void;
}

const boundsOf = (month: string) => ({
  from: dayjs(`${month}-01`).startOf('month').format('YYYY-MM-DD'),
  to: dayjs(`${month}-01`).endOf('month').format('YYYY-MM-DD'),
});

const thisMonth = dayjs().format('YYYY-MM');

export const useFinancialPeriod = create<PeriodState>(set => ({
  month: thisMonth,
  ...boundsOf(thisMonth),
  includeOverdue: true,
  setMonth: month => set({ month, ...boundsOf(month) }),
  setRange: (from, to) => set({ from, to, month: dayjs(from).format('YYYY-MM') }),
  setIncludeOverdue: includeOverdue => set({ includeOverdue }),
}));
