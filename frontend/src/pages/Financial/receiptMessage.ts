import dayjs from 'dayjs';
import { fmt, METHOD_LABELS } from './format';

/**
 * Recibo mandado pelo WhatsApp, logo depois de receber.
 *
 * O recibo impresso já existia, mas ninguém imprime papel no balcão para uma
 * cliente que veio de moto. A pergunta que o recibo resolve — "já paguei
 * aquilo?" — costuma voltar como ligação uma semana depois; uma mensagem no
 * momento do pagamento resolve antes de virar ligação.
 *
 * Como em toda a cobrança do sistema, nada é enviado sozinho: a conversa abre
 * com o texto pronto e quem decide mandar é a usuária.
 */
export function receiptLink({ phone, name, amount, description, method }: {
  phone?: string | null;
  name?: string | null;
  amount: number;
  description?: string | null;
  method: string;
}) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (!digits) return null;

  const texto =
    `Oi, ${(name ?? '').split(' ')[0]}! Recebemos ${fmt(amount)}`
    + (description ? ` referente a "${description}"` : '')
    + `, em ${METHOD_LABELS[method] ?? method}, no dia ${dayjs().format('DD/MM/YYYY')}. `
    + 'Obrigada!';

  return `https://wa.me/55${digits}?text=${encodeURIComponent(texto)}`;
}
