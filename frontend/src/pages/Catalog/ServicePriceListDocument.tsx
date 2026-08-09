import { Box, Typography, Divider } from '@mui/material';
import { WhatsApp, Instagram, Facebook, MusicNote, Language, Email, Phone } from '@mui/icons-material';

const INK = '#1a1a1a';
const MUTED = '#6b6b6b';
const RULE = '#e3e3e3';
const BRAND = '#7B3F8C';

const fmt = (v: unknown) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v ?? 0));

interface Props {
  services: any[];
  business: any;
}

export default function ServicePriceListDocument({ services, business: biz }: Props) {
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

  return (
    <Box
      className="quote-doc"
      sx={{
        color: INK,
        bgcolor: '#fff',
        maxWidth: '210mm',
        mx: 'auto',
        // Margem superior extra para compensar o cabeçalho injetado pelo navegador
        mt: '10mm',
        p: { xs: '10mm', sm: '14mm' },
        fontSize: 13,
        lineHeight: 1.5,
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      {/* Cabeçalho */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', minWidth: 0 }}>
          {biz?.logoBase64 && (
            <Box component="img" src={biz.logoBase64} alt="" sx={{ maxHeight: 64, maxWidth: 140, objectFit: 'contain', flexShrink: 0 }} />
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2, color: BRAND }}>
              {biz?.name ?? 'Ateliê'}
            </Typography>
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
          </Box>
        </Box>
        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1, color: BRAND }}>
            TABELA DE PREÇOS
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: RULE, my: 2.5 }} />

      {/* Tabela de Serviços */}
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', mb: 4 }}>
        <Box component="thead">
          <Box component="tr" sx={{ borderBottom: `2px solid ${BRAND}` }}>
            <Box component="th" sx={{ textAlign: 'left', p: 1.25, fontSize: 11, fontWeight: 700, color: BRAND, textTransform: 'uppercase' }}>Serviço</Box>
            <Box component="th" sx={{ textAlign: 'left', p: 1.25, fontSize: 11, fontWeight: 700, color: BRAND, textTransform: 'uppercase' }}>Descrição</Box>
            <Box component="th" sx={{ textAlign: 'right', p: 1.25, fontSize: 11, fontWeight: 700, color: BRAND, textTransform: 'uppercase' }}>Preço base</Box>
          </Box>
        </Box>
        <Box component="tbody">
          {services.map((s: any) => (
            <Box component="tr" key={s.id} sx={{ borderBottom: `1px solid ${RULE}` }}>
              <Box component="td" sx={{ p: 1.25, fontSize: 13, fontWeight: 600 }}>{s.name}</Box>
              <Box component="td" sx={{ p: 1.25, fontSize: 12, color: MUTED }}>{s.description ?? '—'}</Box>
              <Box component="td" sx={{ p: 1.25, fontSize: 13, textAlign: 'right' }}>{fmt(s.basePrice)}</Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Rodapé */}
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
