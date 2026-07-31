import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Button, Divider, Table, TableBody, TableCell, TableHead, TableRow, CircularProgress } from '@mui/material';
import { Print, ArrowBack } from '@mui/icons-material';
import dayjs from 'dayjs';
import api from '../../services/api';

const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

export default function QuotePrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: quote, isLoading: loadingQuote } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => api.get(`/quotes/${id}`).then(r => r.data),
  });

  const { data: biz, isLoading: loadingBiz } = useQuery({
    queryKey: ['business-info'],
    queryFn: () => api.get('/settings/business').then(r => r.data),
  });

  useEffect(() => {
    if (quote && biz) setTimeout(() => window.print(), 600);
  }, [quote, biz]);

  if (loadingQuote || loadingBiz) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>
  );
  if (!quote) return null;

  const subtotal = quote.items?.reduce((s: number, i: any) => s + parseFloat(i.total), 0) ?? 0;
  const discount = parseFloat(quote.discount ?? 0);
  const total = subtotal - discount;

  const hasContact = biz?.phone || biz?.email || biz?.website;
  const hasAddress = biz?.address || biz?.city;

  return (
    <>
      {/* Barra de ação — oculta na impressão */}
      <Box sx={{ displayPrint: 'none', p: 2, display: 'flex', gap: 1, bgcolor: 'grey.100', borderBottom: 1, borderColor: 'divider' }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(`/quotes/${id}/edit`)}>Voltar</Button>
        <Button variant="contained" startIcon={<Print />} onClick={() => window.print()}>Imprimir</Button>
      </Box>

      <Box sx={{ maxWidth: 800, mx: 'auto', p: 4, fontFamily: 'Inter, sans-serif' }}>
        {/* Cabeçalho */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {biz?.logoBase64 && (
              <Box
                component="img"
                src={biz.logoBase64}
                alt="Logo"
                sx={{ maxHeight: 72, maxWidth: 160, objectFit: 'contain' }}
              />
            )}
            <Box>
              <Typography variant="h5" fontWeight={700} color="primary">
                {biz?.name ?? 'Ateliê de Costura'}
              </Typography>
              {biz?.tagline && (
                <Typography variant="body2" color="text.secondary">{biz.tagline}</Typography>
              )}
              {hasContact && (
                <Typography variant="caption" color="text.secondary" display="block">
                  {[biz?.phone, biz?.email, biz?.website].filter(Boolean).join(' · ')}
                </Typography>
              )}
              {hasAddress && (
                <Typography variant="caption" color="text.secondary" display="block">
                  {[biz?.address, biz?.city].filter(Boolean).join(' — ')}
                </Typography>
              )}
              {biz?.taxId && (
                <Typography variant="caption" color="text.secondary" display="block">
                  CNPJ/CPF: {biz.taxId}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="h6" fontWeight={700}>{quote.number}</Typography>
            <Typography variant="body2" color="text.secondary">
              Emitido em {dayjs(quote.createdAt).format('DD/MM/YYYY')}
            </Typography>
            {quote.validUntil && (
              <Typography variant="body2" color="text.secondary">
                Válido até {dayjs(quote.validUntil).format('DD/MM/YYYY')}
              </Typography>
            )}
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Cliente */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" fontWeight={700} mb={0.5}>CLIENTE</Typography>
          <Typography variant="body1" fontWeight={600}>{quote.customer?.name}</Typography>
          {quote.customer?.email && <Typography variant="body2">{quote.customer.email}</Typography>}
          {quote.customer?.phone && <Typography variant="body2">{quote.customer.phone}</Typography>}
        </Box>

        {/* Itens */}
        <Table size="small" sx={{ mb: 3 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell sx={{ fontWeight: 700 }}>Descrição</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Qtd</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Valor unit.</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {quote.items?.map((item: any) => (
              <TableRow key={item.id}>
                <TableCell>{item.description}</TableCell>
                <TableCell align="center">{parseFloat(item.quantity)}</TableCell>
                <TableCell align="right">{fmt(parseFloat(item.unitPrice))}</TableCell>
                <TableCell align="right">{fmt(parseFloat(item.total))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Totais */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
          <Box sx={{ minWidth: 240 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography variant="body2" color="text.secondary">Subtotal</Typography>
              <Typography variant="body2">{fmt(subtotal)}</Typography>
            </Box>
            {discount > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                <Typography variant="body2" color="text.secondary">Desconto</Typography>
                <Typography variant="body2" color="error.main">- {fmt(discount)}</Typography>
              </Box>
            )}
            <Divider sx={{ my: 0.5 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography variant="subtitle1" fontWeight={700}>Total</Typography>
              <Typography variant="subtitle1" fontWeight={700} color="primary">{fmt(total)}</Typography>
            </Box>
          </Box>
        </Box>

        {quote.notes && (
          <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1, mb: 3 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={0.5}>Observações</Typography>
            <Typography variant="body2">{quote.notes}</Typography>
          </Box>
        )}

        <Divider sx={{ mb: 2 }} />
        <Typography variant="caption" color="text.secondary" textAlign="center" display="block">
          {biz?.footerText || 'Este orçamento foi gerado pelo sistema de gestão do ateliê.'}
        </Typography>
      </Box>

      <style>{`
        @media print {
          .MuiBox-root[style*="displayPrint: none"] { display: none !important; }
          body { margin: 0; }
        }
      `}</style>
    </>
  );
}
