import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Button, Divider, Table, TableBody, TableCell,
  TableHead, TableRow, CircularProgress, Alert,
} from '@mui/material';
import { Print, ArrowBack } from '@mui/icons-material';
import dayjs from 'dayjs';
import api from '../../services/api';
import { fmt } from './constants';

export default function WorkOrderReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['work-order-receipt', id],
    queryFn: () => api.get(`/work-orders/${id}/receipt`).then(r => r.data),
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
        <Alert severity="warning" action={<Button onClick={() => navigate('/work-orders')}>Voltar</Button>}>
          {(error as any)?.response?.data?.message ?? 'Não foi possível carregar o recibo'}
        </Alert>
      </Box>
    );
  }

  const wo = data.workOrder;
  const biz = data.business;
  const fin = wo.financials;
  const balance = Number(fin?.balance ?? 0);

  return (
    <>
      <Box sx={{ displayPrint: 'none', p: 2, display: 'flex', gap: 1, bgcolor: 'grey.100', borderBottom: 1, borderColor: 'divider' }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(`/work-orders/${id}/edit`)}>Voltar</Button>
        <Button variant="contained" startIcon={<Print />} onClick={() => window.print()}>Imprimir</Button>
      </Box>

      <Box sx={{ maxWidth: 800, mx: 'auto', p: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>{biz?.name ?? 'Ateliê'}</Typography>
            {biz?.document && <Typography variant="body2">CNPJ/CPF: {biz.document}</Typography>}
            {(biz?.address || biz?.city) && (
              <Typography variant="body2">{[biz.address, biz.city].filter(Boolean).join(' — ')}</Typography>
            )}
            {(biz?.phone || biz?.email) && (
              <Typography variant="body2">{[biz.phone, biz.email].filter(Boolean).join(' · ')}</Typography>
            )}
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="h6" fontWeight={700}>RECIBO DE ENTREGA</Typography>
            <Typography variant="body2">{wo.number}</Typography>
            <Typography variant="body2">
              {wo.deliveredAt ? dayjs(wo.deliveredAt).format('DD/MM/YYYY [às] HH:mm') : '—'}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="subtitle2" fontWeight={700} gutterBottom>CLIENTE</Typography>
        <Typography variant="body1">{wo.customer?.name}</Typography>
        {wo.customer?.phone && <Typography variant="body2">{wo.customer.phone}</Typography>}
        {wo.customer?.cpf && <Typography variant="body2">CPF: {wo.customer.cpf}</Typography>}

        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>PEÇAS E SERVIÇOS ENTREGUES</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Descrição</TableCell>
                <TableCell align="right">Qtd</TableCell>
                <TableCell align="right">Valor unit.</TableCell>
                <TableCell align="right">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {wo.items?.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell>{i.description}</TableCell>
                  <TableCell align="right">{Number(i.quantity)}</TableCell>
                  <TableCell align="right">{fmt(i.unitPrice)}</TableCell>
                  <TableCell align="right">{fmt(i.total)}</TableCell>
                </TableRow>
              ))}
              {(!wo.items || wo.items.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography variant="body2" color="text.secondary">{wo.notes ?? '—'}</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>

        <Box sx={{ mt: 3, ml: 'auto', width: 280 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2">Total</Typography>
            <Typography variant="body2">{fmt(fin?.total)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2">Pago</Typography>
            <Typography variant="body2">{fmt(fin?.paid)}</Typography>
          </Box>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body1" fontWeight={700}>
              {balance > 0.005 ? 'Saldo em aberto' : 'Situação'}
            </Typography>
            <Typography variant="body1" fontWeight={700}>
              {balance > 0.005 ? fmt(balance) : 'QUITADO'}
            </Typography>
          </Box>
        </Box>

        {balance > 0.005 && (
          <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic' }}>
            A peça foi entregue com saldo em aberto de {fmt(balance)}.
          </Typography>
        )}

        <Box sx={{ mt: 6, display: 'flex', gap: 6, justifyContent: 'space-between' }}>
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Divider />
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {wo.receivedBy || wo.customer?.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">Recebi a peça</Typography>
          </Box>
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Divider />
            <Typography variant="body2" sx={{ mt: 0.5 }}>{wo.deliveredBy?.name ?? '—'}</Typography>
            <Typography variant="caption" color="text.secondary">Entregue por</Typography>
          </Box>
        </Box>
      </Box>
    </>
  );
}
