/**
 * Monta o link do WhatsApp para o número cadastrado da cliente.
 *
 * O `wa.me` só aceita texto pré-preenchido — não existe anexar arquivo por
 * link. Por isso a mensagem carrega o endereço público do orçamento, que abre
 * a versão imprimível sem exigir login.
 */

const BR_COUNTRY_CODE = '55';

/**
 * Normaliza o telefone para o formato que o wa.me espera: só dígitos, com
 * código do país. Aceita "(11) 98765-4321", "11987654321" e "5511987654321".
 */
export function toWhatsAppNumber(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');

  // Já tem código do país (12 ou 13 dígitos: 55 + DDD + 8 ou 9 dígitos).
  if (digits.startsWith(BR_COUNTRY_CODE) && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  // DDD + número, sem país.
  if (digits.length === 10 || digits.length === 11) {
    return BR_COUNTRY_CODE + digits;
  }
  // Número internacional já completo.
  if (digits.length > 13) return digits;

  return null;
}

/**
 * O PDF vai anexado à mão na conversa, então a mensagem não carrega link —
 * ela apresenta o orçamento e avisa que o arquivo segue junto. Quem quiser
 * mandar o link mesmo assim é só incluir {link} no modelo das configurações.
 */
/**
 * Sem emoji de propósito: alguns clientes de WhatsApp e algumas fontes exibem
 * caracteres fora do plano básico como "�" quando chegam pela URL. Quem quiser
 * emoji pode incluir no modelo em Configurações, digitando no próprio campo.
 */
const DEFAULT_TEMPLATE = `Olá {cliente}, tudo bem?

Segue em anexo o orçamento {numero} do {atelie}, no valor de {total}.

Válido até {validade}.

Qualquer dúvida é só chamar!`;

export interface TemplateVars {
  cliente: string;
  numero: string;
  total: string;
  link: string;
  atelie: string;
  validade: string;
}

/** Substitui os marcadores {chave} do modelo configurado. */
export function renderTemplate(template: string | null | undefined, vars: TemplateVars): string {
  const base = template?.trim() || DEFAULT_TEMPLATE;
  return base.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key as keyof TemplateVars]) : match,
  );
}

/** Marcadores aceitos no modelo, com o que cada um significa. */
export const TEMPLATE_VARS: { key: keyof TemplateVars; description: string }[] = [
  { key: 'cliente', description: 'Primeiro nome da cliente' },
  { key: 'numero', description: 'Número do orçamento' },
  { key: 'total', description: 'Valor total, já formatado' },
  { key: 'validade', description: 'Data de validade da proposta' },
  { key: 'atelie', description: 'Nome do ateliê' },
  { key: 'link', description: 'Endereço público do orçamento' },
];

export { DEFAULT_TEMPLATE };
