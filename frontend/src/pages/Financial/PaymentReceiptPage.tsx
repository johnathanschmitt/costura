import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Button, Divider, CircularProgress, Alert } from '@mui/material';
import { Print, ArrowBack } from '@mui/icons-material';
import dayjs from 'dayjs';
import api from '../../services/api';
import { fmt, METHOD_LABELS, toNumber } from './format';

export default function PaymentReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['payment-receipt', id],
    queryFn: () => api.get(`/financial/payments/${id}/receipt`).then(r => r.data),
    retry: false,
  });

  useEffect(() => {
    if (data) setTimeout(() => window.print(), 600);
  }, [data]);

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>;
  }
  if (error) {
    return (
      <Box sx={{ maxWidth: 700, mx: 'auto', p: 4 }}>
        <Alert severity="warning" action={<Button onClick={() => navigate('/financial')}>Voltar</Button>}>
          {(error as any)?.response?.data?.message ?? 'Não foi possível carregar o comprovante'}
        </Alert>
      </Box>
    );
  }

  const { payment: p, business: biz } = data;
  const isReceivable = p.type === 'RECEIVABLE';
  const party = isReceivable ? p.receivable?.customer?.name : p.payable?.supplier;
  const description = isReceivable ? p.receivable?.description : p.payable?.description;
  const tendered = p.amountTendered != null ? toNumber(p.amountTendered) : null;

  return (
    <>
      <Box sx={{ displayPrint: 'none', p: 2, display: 'flex', gap: 1, bgcolor: 'grey.100', borderBottom: 1, borderColor: 'divider' }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/financial')}>Voltar</Button>
        <Button variant="contained" startIcon={<Print />} onClick={() => window.print()}>Imprimir</Button>
      </Box>

      <Box sx={{ maxWidth: 620, mx: 'auto', p: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>{biz?.name ?? 'Ateliê'}</Typography>
            {biz?.taxId && <Typography variant="body2">CNPJ/CPF: {biz.taxId}</Typography>}
            {(biz?.phone || biz?.email) && (
              <Typography variant="body2">{[biz.phone, biz.email].filter(Boolean).join(' · ')}</Typography>
            )}
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="h6" fontWeight={700}>
              {isReceivable ? 'RECIBO DE PAGAMENTO' : 'COMPROVANTE DE PAGAMENTO'}
            </Typography>
            <Typography variant="body2">{dayjs(p.paidAt).format('DD/MM/YYYY [às] HH:mm')}</Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="body1" sx={{ lineHeight: 1.9 }}>
          {isReceivable ? 'Recebemos de' : 'Pagamos a'} <strong>{party ?? '—'}</strong> a
          importância de <strong>{fmt(p.amount)}</strong>, referente a{' '}
          <strong>{description ?? '—'}</strong>, na forma de{' '}
          <strong>{METHOD_LABELS[p.method] ?? p.method}</strong>.
        </Typography>

        {tendered !== null && (
          <Box sx={{ mt: 3, bgcolor: 'background.default', p: 2, borderRadius: 2, maxWidth: 320 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Valor entregue</Typography>
              <Typography variant="body2">{fmt(tendered)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Valor da conta</Typography>
              <Typography variant="body2">{fmt(p.amount)}</Typography>
            </Box>
            <Divider sx={{ my: 0.5 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" fontWeight={700}>Troco</Typography>
              <Typography variant="body2" fontWeight={700}>{fmt(p.changeGiven)}</Typography>
            </Box>
          </Box>
        )}

        {p.notes && (
          <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic' }}>{p.notes}</Typography>
        )}

        <Box sx={{ mt: 8, mx: 'auto', width: 300, textAlign: 'center' }}>
          <Divider />
          <Typography variant="body2" sx={{ mt: 0.5 }}>{biz?.name ?? 'Ateliê'}</Typography>
          <Typography variant="caption" color="text.secondary">Assinatura</Typography>
        </Box>
      </Box>
    </>
  );
}
