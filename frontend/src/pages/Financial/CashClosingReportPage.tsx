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
import { fmt, toNumber } from './format';

export default function CashClosingReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['closing-report', id],
    queryFn: () => api.get(`/financial/cash-register/${id}/closing-report`).then(r => r.data),
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
          {(error as any)?.response?.data?.message ?? 'Não foi possível carregar o relatório'}
        </Alert>
      </Box>
    );
  }

  const { register: reg, business: biz, breakdown: b } = data;
  const difference = toNumber(reg.difference);
  const diverges = Math.abs(difference) >= 0.005;

  const line = (label: string, value: unknown, sign?: '+' | '−') => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
      <Typography variant="body2">{label}</Typography>
      <Typography variant="body2">{sign && `${sign} `}{fmt(value)}</Typography>
    </Box>
  );

  return (
    <>
      <Box sx={{ displayPrint: 'none', p: 2, display: 'flex', gap: 1, bgcolor: 'grey.100', borderBottom: 1, borderColor: 'divider' }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/financial')}>Voltar</Button>
        <Button variant="contained" startIcon={<Print />} onClick={() => window.print()}>Imprimir</Button>
      </Box>

      <Box sx={{ maxWidth: 760, mx: 'auto', p: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>{biz?.name ?? 'Ateliê'}</Typography>
            {biz?.taxId && <Typography variant="body2">CNPJ/CPF: {biz.taxId}</Typography>}
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="h6" fontWeight={700}>FECHAMENTO DE CAIXA</Typography>
            <Typography variant="body2">
              Abertura: {dayjs(reg.openedAt).format('DD/MM/YYYY HH:mm')}
              {reg.openedBy && ` — ${reg.openedBy.name}`}
            </Typography>
            <Typography variant="body2">
              Fechamento: {reg.closedAt ? dayjs(reg.closedAt).format('DD/MM/YYYY HH:mm') : '—'}
              {reg.closedBy && ` — ${reg.closedBy.name}`}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="subtitle2" fontWeight={700} gutterBottom>RESUMO DO DINHEIRO EM CAIXA</Typography>
        <Box sx={{ maxWidth: 420 }}>
          {line('Saldo de abertura', reg.openingBalance)}
          <Divider sx={{ my: 1 }} />
          {line('Vendas em dinheiro', b.sales, '+')}
          {line('Recebimentos de contas', b.fromAccounts, '+')}
          {line('Suprimentos (troco)', b.supplies, '+')}
          {line('Despesas pagas', b.expenses, '−')}
          {line('Contas pagas', b.paidAccounts, '−')}
          {line('Sangrias', b.withdrawals, '−')}
          {toNumber(b.reversals) > 0 && line('Estornos de baixa', b.reversals, '−')}
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
            <Typography variant="body1" fontWeight={700}>Esperado na gaveta</Typography>
            <Typography variant="body1" fontWeight={700}>{fmt(reg.closingBalance)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
            <Typography variant="body1" fontWeight={700}>Contado</Typography>
            <Typography variant="body1" fontWeight={700}>{fmt(reg.countedBalance)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, bgcolor: diverges ? 'warning.light' : undefined, px: diverges ? 1 : 0 }}>
            <Typography variant="body1" fontWeight={700}>
              {diverges ? (difference < 0 ? 'Falta' : 'Sobra') : 'Diferença'}
            </Typography>
            <Typography variant="body1" fontWeight={700}>
              {fmt(Math.abs(difference))}
            </Typography>
          </Box>
        </Box>

        {reg.notes && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" fontWeight={700}>OBSERVAÇÕES</Typography>
            <Typography variant="body2">{reg.notes}</Typography>
          </Box>
        )}

        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            MOVIMENTAÇÕES ({reg.transactions.length})
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Hora</TableCell>
                <TableCell>Descrição</TableCell>
                <TableCell>Categoria</TableCell>
                <TableCell align="right">Valor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reg.transactions.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell>{dayjs(t.createdAt).format('HH:mm')}</TableCell>
                  <TableCell>{t.description}</TableCell>
                  <TableCell>{t.category ?? '—'}</TableCell>
                  <TableCell align="right">
                    {t.type === 'INCOME' ? '+' : '−'} {fmt(t.amount)}
                  </TableCell>
                </TableRow>
              ))}
              {reg.transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography variant="body2" color="text.secondary">
                      Nenhuma movimentação de dinheiro neste caixa
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>

        <Box sx={{ mt: 6, mx: 'auto', width: 280, textAlign: 'center' }}>
          <Divider />
          <Typography variant="caption" color="text.secondary">Responsável pelo fechamento</Typography>
        </Box>
      </Box>
    </>
  );
}
