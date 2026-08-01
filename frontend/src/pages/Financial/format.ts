const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Valores monetários chegam da API como string (Decimal) ou número. */
export const fmt = (value: unknown) => currency.format(Number(value ?? 0));

export const toNumber = (value: unknown) => Number(value ?? 0);

/** O ValidationPipe do Nest devolve `message` como array quando há vários erros. */
export const apiError = (e: any, fallback: string): string => {
  const message = e?.response?.data?.message;
  if (Array.isArray(message)) return message.join('. ');
  return message ?? fallback;
};

export const METHOD_LABELS: Record<string, string> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  CREDIT_CARD: 'Crédito',
  DEBIT_CARD: 'Débito',
  TRANSFER: 'Transferência',
  CHECK: 'Cheque',
  OTHER: 'Outro',
};

export const EXPENSE_CATEGORIES = [
  'Aluguel', 'Material', 'Mão de obra', 'Energia', 'Água', 'Internet',
  'Impostos', 'Marketing', 'Outros',
];

export const STATUS_MAP: Record<string, { label: string; color: any }> = {
  PENDING: { label: 'Pendente', color: 'warning' },
  PARTIAL: { label: 'Parcial', color: 'info' },
  PAID: { label: 'Pago', color: 'success' },
  OVERDUE: { label: 'Vencido', color: 'error' },
  CANCELLED: { label: 'Cancelado', color: 'default' },
};
