const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmt = (value: unknown) => currency.format(Number(value ?? 0));

/** Quantidades vêm como Decimal(10,3); mostramos sem zeros à direita. */
export const qty = (value: unknown) => {
  const n = Number(value ?? 0);
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
};

export const apiError = (e: any, fallback: string): string => {
  const message = e?.response?.data?.message;
  if (Array.isArray(message)) return message.join('. ');
  return message ?? fallback;
};

export const MOVEMENT_LABELS: Record<string, { label: string; color: any }> = {
  IN: { label: 'Entrada', color: 'success' },
  OUT: { label: 'Baixa', color: 'error' },
  ADJUSTMENT: { label: 'Ajuste', color: 'info' },
};
