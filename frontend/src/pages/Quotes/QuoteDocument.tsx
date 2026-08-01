import { Box, Typography, Divider } from '@mui/material';
import { WhatsApp, Instagram, Facebook, MusicNote, Language, Email, Phone } from '@mui/icons-material';
import dayjs from 'dayjs';

/**
 * O documento do orçamento, usado tanto na impressão interna quanto na página
 * pública que a cliente abre — para o que ela vê ser exatamente o que o ateliê
 * imprime.
 *
 * Escrito com medidas fixas em mm e cores explícitas (não tokens do tema),
 * porque o alvo é a folha A4: o navegador imprime este bloco como está.
 */

const INK = '#1a1a1a';
const MUTED = '#6b6b6b';
const RULE = '#e3e3e3';
const BRAND = '#7B3F8C';
const BRAND_SOFT = '#f6eef8';

const fmt = (v: unknown) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v ?? 0));

const qty = (v: unknown) => Number(v ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  SENT: 'Aguardando aprovação',
  APPROVED: 'Aprovado',
  REJECTED: 'Recusado',
  EXPIRED: 'Expirado',
};

interface Props {
  quote: any;
  business: any;
  /** `internal` mostra os contatos da cliente; `public` omite. */
  variant?: 'internal' | 'public';
}

export default function QuoteDocument({ quote, business: biz, variant = 'internal' }: Props) {
  const items = quote.items ?? [];
  const subtotal = Number(quote.subtotal ?? items.reduce((s: number, i: any) => s + Number(i.total), 0));
  const discount = Number(quote.discount ?? 0);
  const total = Number(quote.total ?? subtotal - discount);
  const itemDiscounts = items.reduce((s: number, i: any) => s + Number(i.discount ?? 0), 0);
  const expired = quote.validUntil && dayjs(quote.validUntil).isBefore(dayjs(), 'day');

  const socials = [
    biz?.whatsapp && { icon: <WhatsApp sx={{ fontSize: 13 }} />, text: biz.whatsapp },
    biz?.instagram && { icon: <Instagram sx={{ fontSize: 13 }} />, text: biz.instagram },
    biz?.facebook && { icon: <Facebook sx={{ fontSize: 13 }} />, text: biz.facebook },
    biz?.tiktok && { icon: <MusicNote sx={{ fontSize: 13 }} />, text: biz.tiktok },
    biz?.website && { icon: <Language sx={{ fontSize: 13 }} />, text: biz.website },
  ].filter(Boolean) as { icon: JSX.Element; text: string }[];

  const contacts = [
    biz?.phone && { icon: <Phone sx={{ fontSize: 13 }} />, text: biz.phone },
    biz?.email && { icon: <Email sx={{ fontSize: 13 }} />, text: biz.email },
  ].filter(Boolean) as { icon: JSX.Element; text: string }[];

  const infoChips = [
    { label: 'Emitido em', value: dayjs(quote.createdAt).format('DD/MM/YYYY') },
    quote.validUntil && {
      label: 'Válido até',
      value: dayjs(quote.validUntil).format('DD/MM/YYYY'),
      warn: expired,
    },
    quote.deliveryDate && {
      label: 'Entrega estimada',
      value: dayjs(quote.deliveryDate).format('DD/MM/YYYY'),
    },
  ].filter(Boolean) as { label: string; value: string; warn?: boolean }[];

  return (
    <Box
      className="quote-doc"
      sx={{
        color: INK,
        bgcolor: '#fff',
        maxWidth: '210mm',
        mx: 'auto',
        p: { xs: '10mm', sm: '14mm' },
        fontSize: 13,
        lineHeight: 1.5,
        // Sem isto o navegador descarta os fundos coloridos ao imprimir.
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      {/* ── Cabeçalho ───────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', minWidth: 0 }}>
          {biz?.logoBase64 && (
            <Box
              component="img"
              src={biz.logoBase64}
              alt=""
              sx={{ maxHeight: 64, maxWidth: 140, objectFit: 'contain', flexShrink: 0 }}
            />
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2, color: BRAND }}>
              {biz?.name ?? 'Ateliê'}
            </Typography>
            {biz?.tagline && (
              <Typography sx={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>
                {biz.tagline}
              </Typography>
            )}
            {(biz?.address || biz?.city) && (
              <Typography sx={{ fontSize: 11.5, color: MUTED, mt: 0.5 }}>
                {[biz.address, biz.city].filter(Boolean).join(' — ')}
              </Typography>
            )}
            {contacts.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 0.25 }}>
                {contacts.map((c, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.4, color: MUTED }}>
                    {c.icon}
                    <Typography sx={{ fontSize: 11.5 }}>{c.text}</Typography>
                  </Box>
                ))}
              </Box>
            )}
            {biz?.taxId && (
              <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
                CNPJ/CPF: {biz.taxId}
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Typography sx={{ fontSize: 11, letterSpacing: 1.5, color: MUTED, fontWeight: 600 }}>
            ORÇAMENTO
          </Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1, color: BRAND }}>
            {quote.number}
          </Typography>
          {quote.status && (
            <Box
              sx={{
                display: 'inline-block', mt: 0.75, px: 1.25, py: 0.25, borderRadius: 5,
                fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3,
                bgcolor: quote.status === 'APPROVED' ? '#e6f4ea' : expired ? '#fdecea' : BRAND_SOFT,
                color: quote.status === 'APPROVED' ? '#1e6b34' : expired ? '#a3271f' : BRAND,
              }}
            >
              {STATUS_LABEL[quote.status] ?? quote.status}
            </Box>
          )}
        </Box>
      </Box>

      {/* Faixa fina da marca, para o documento ter identidade sem pesar na impressão */}
      <Box sx={{ height: 3, bgcolor: BRAND, borderRadius: 2, mt: 2, mb: 2.5 }} />

      {/* ── Cliente e datas ─────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 3, flexWrap: 'wrap', mb: 3 }}>
        <Box>
          <Typography sx={{ fontSize: 10, letterSpacing: 1, color: MUTED, fontWeight: 700, mb: 0.5 }}>
            PARA
          </Typography>
          <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{quote.customer?.name}</Typography>
          {variant === 'internal' && (
            <>
              {quote.customer?.phone && (
                <Typography sx={{ fontSize: 12, color: MUTED }}>{quote.customer.phone}</Typography>
              )}
              {quote.customer?.email && (
                <Typography sx={{ fontSize: 12, color: MUTED }}>{quote.customer.email}</Typography>
              )}
            </>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 3 }}>
          {infoChips.map(c => (
            <Box key={c.label} sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontSize: 10, letterSpacing: 0.8, color: MUTED, fontWeight: 700 }}>
                {c.label.toUpperCase()}
              </Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: c.warn ? '#a3271f' : INK }}>
                {c.value}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── Itens ───────────────────────────────────────────────── */}
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', mb: 2 }}>
        <Box component="thead">
          <Box component="tr" sx={{ bgcolor: BRAND_SOFT }}>
            {[
              { label: 'Descrição', align: 'left' as const },
              { label: 'Qtd', align: 'center' as const, w: '12%' },
              { label: 'Valor unit.', align: 'right' as const, w: '18%' },
              { label: 'Total', align: 'right' as const, w: '18%' },
            ].map(h => (
              <Box
                key={h.label}
                component="th"
                sx={{
                  textAlign: h.align, width: h.w, px: 1.25, py: 1,
                  fontSize: 10.5, letterSpacing: 0.6, fontWeight: 700, color: BRAND,
                  textTransform: 'uppercase',
                }}
              >
                {h.label}
              </Box>
            ))}
          </Box>
        </Box>
        <Box component="tbody">
          {items.map((item: any) => {
            const itemDiscount = Number(item.discount ?? 0);
            const gross = Number(item.quantity) * Number(item.unitPrice);
            return (
              <Box component="tr" key={item.id} sx={{ borderBottom: `1px solid ${RULE}`, breakInside: 'avoid' }}>
                <Box component="td" sx={{ px: 1.25, py: 1.1, verticalAlign: 'top' }}>
                  <Typography sx={{ fontSize: 13 }}>{item.description}</Typography>
                  {itemDiscount > 0 && (
                    <Typography sx={{ fontSize: 11, color: '#1e6b34' }}>
                      desconto de {fmt(itemDiscount)} sobre {fmt(gross)}
                    </Typography>
                  )}
                </Box>
                <Box component="td" sx={{ px: 1.25, py: 1.1, textAlign: 'center', verticalAlign: 'top', fontSize: 13 }}>
                  {qty(item.quantity)}
                </Box>
                <Box component="td" sx={{ px: 1.25, py: 1.1, textAlign: 'right', verticalAlign: 'top', fontSize: 13 }}>
                  {fmt(item.unitPrice)}
                </Box>
                <Box component="td" sx={{ px: 1.25, py: 1.1, textAlign: 'right', verticalAlign: 'top', fontSize: 13, fontWeight: 600 }}>
                  {fmt(item.total)}
                </Box>
              </Box>
            );
          })}
          {items.length === 0 && (
            <Box component="tr">
              <Box component="td" colSpan={4} sx={{ px: 1.25, py: 2, color: MUTED, fontSize: 12 }}>
                Nenhum item neste orçamento.
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* ── Totais ──────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', breakInside: 'avoid', mb: 3 }}>
        <Box sx={{ minWidth: 250 }}>
          <Row label="Subtotal" value={fmt(subtotal + itemDiscounts)} muted />
          {itemDiscounts > 0 && (
            <Row label="Descontos nos itens" value={`− ${fmt(itemDiscounts)}`} positive />
          )}
          {discount > 0 && <Row label="Desconto geral" value={`− ${fmt(discount)}`} positive />}
          <Box sx={{ borderTop: `2px solid ${BRAND}`, mt: 1, pt: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>TOTAL</Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 700, color: BRAND }}>{fmt(total)}</Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ── Observações ─────────────────────────────────────────── */}
      {quote.notes && (
        <Box
          sx={{
            bgcolor: '#fafafa', borderLeft: `3px solid ${BRAND}`,
            p: 1.75, mb: 3, breakInside: 'avoid',
          }}
        >
          <Typography sx={{ fontSize: 10, letterSpacing: 1, color: MUTED, fontWeight: 700, mb: 0.5 }}>
            OBSERVAÇÕES E CONDIÇÕES
          </Typography>
          <Typography sx={{ fontSize: 12.5, whiteSpace: 'pre-wrap' }}>{quote.notes}</Typography>
        </Box>
      )}

      {/* ── Aceite ──────────────────────────────────────────────── */}
      {quote.status !== 'APPROVED' && (
        <Box sx={{ display: 'flex', gap: 5, mt: 5, mb: 3, breakInside: 'avoid' }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ borderTop: `1px solid ${INK}`, pt: 0.5 }}>
              <Typography sx={{ fontSize: 11, color: MUTED }}>
                Assinatura da cliente — de acordo
              </Typography>
            </Box>
          </Box>
          <Box sx={{ width: 150 }}>
            <Box sx={{ borderTop: `1px solid ${INK}`, pt: 0.5 }}>
              <Typography sx={{ fontSize: 11, color: MUTED }}>Data</Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* ── Rodapé com redes sociais ────────────────────────────── */}
      <Divider sx={{ borderColor: RULE, mb: 1.5 }} />
      {socials.length > 0 && (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', mb: 1 }}>
          {socials.map((s, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: BRAND }}>
              {s.icon}
              <Typography sx={{ fontSize: 11.5, fontWeight: 500 }}>{s.text}</Typography>
            </Box>
          ))}
        </Box>
      )}
      <Typography sx={{ fontSize: 11, color: MUTED, textAlign: 'center' }}>
        {biz?.footerText || 'Obrigada pela preferência!'}
      </Typography>
    </Box>
  );
}

function Row({ label, value, muted, positive }: {
  label: string; value: string; muted?: boolean; positive?: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.4 }}>
      <Typography sx={{ fontSize: 12.5, color: muted ? MUTED : INK }}>{label}</Typography>
      <Typography sx={{ fontSize: 12.5, color: positive ? '#1e6b34' : INK }}>{value}</Typography>
    </Box>
  );
}
