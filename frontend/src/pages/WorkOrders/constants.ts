export const STATUS_MAP: Record<string, { label: string; color: any }> = {
  PENDING: { label: 'Aguardando', color: 'default' },
  IN_PROGRESS: { label: 'Em Produção', color: 'info' },
  WAITING_MATERIAL: { label: 'Aguard. Material', color: 'warning' },
  FITTING: { label: 'Prova', color: 'secondary' },
  DONE: { label: 'Aguard. Retirada', color: 'success' },
  DELIVERED: { label: 'Entregue', color: 'success' },
  CANCELLED: { label: 'Cancelada', color: 'error' },
};

export const PRIORITY_MAP: Record<string, { label: string; color: any; bar: string }> = {
  LOW: { label: 'Baixa', color: 'default', bar: '#9e9e9e' },
  NORMAL: { label: 'Normal', color: 'default', bar: '#42a5f5' },
  HIGH: { label: 'Alta', color: 'warning', bar: '#ffa726' },
  URGENT: { label: 'Urgente', color: 'error', bar: '#ef5350' },
};

export const fmt = (value: unknown) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0));

export const apiError = (e: any, fallback: string): string => {
  const message = e?.response?.data?.message;
  if (Array.isArray(message)) return message.join('. ');
  return message ?? fallback;
};
