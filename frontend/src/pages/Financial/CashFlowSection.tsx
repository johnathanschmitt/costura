import { useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, Button, Skeleton,
} from '@mui/material';
import { ArrowUpward, ArrowDownward, TrendingUp } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import { useQuery } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import api from '../../services/api';

export default function CashFlowSection() {
  const [startDate, setStartDate] = useState<Dayjs>(dayjs().startOf('month'));
  const [endDate, setEndDate] = useState<Dayjs>(dayjs().endOf('month'));

  const { data, isLoading } = useQuery({
    queryKey: ['cash-flow', startDate.toISOString(), endDate.toISOString()],
    queryFn: () =>
      api.get('/financial/cash-flow', {
        params: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      }).then(r => r.data),
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n ?? 0);

  const balance = Number(data?.totalReceived ?? 0) - Number(data?.totalPaid ?? 0);

  const presets = [
    { label: 'Este mês', start: dayjs().startOf('month'), end: dayjs().endOf('month') },
    { label: 'Mês passado', start: dayjs().subtract(1, 'month').startOf('month'), end: dayjs().subtract(1, 'month').endOf('month') },
    { label: 'Últimos 3 meses', start: dayjs().subtract(3, 'month').startOf('month'), end: dayjs().endOf('month') },
    { label: 'Este ano', start: dayjs().startOf('year'), end: dayjs().endOf('year') },
  ];

  return (
    <Box>
      {/* Seletor de período */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {presets.map(p => (
          <Button
            key={p.label}
            size="small"
            variant={startDate.isSame(p.start, 'day') && endDate.isSame(p.end, 'day') ? 'contained' : 'outlined'}
            onClick={() => { setStartDate(p.start); setEndDate(p.end); }}
          >
            {p.label}
          </Button>
        ))}
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <DatePicker
          label="De"
          value={startDate}
          onChange={v => v && setStartDate(v)}
          slotProps={{ textField: { size: 'small' } }}
        />
        <DatePicker
          label="Até"
          value={endDate}
          onChange={v => v && setEndDate(v)}
          slotProps={{ textField: { size: 'small' } }}
        />
      </Box>

      {/* Totais */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ArrowUpward sx={{ color: 'success.main' }} />
                <Typography variant="body2" color="text.secondary">Total Recebido</Typography>
              </Box>
              {isLoading ? <Skeleton width={120} height={40} /> : (
                <Typography variant="h4" fontWeight={700} color="success.main">
                  {fmt(data?.totalReceived ?? 0)}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ArrowDownward sx={{ color: 'error.main' }} />
                <Typography variant="body2" color="text.secondary">Total Pago</Typography>
              </Box>
              {isLoading ? <Skeleton width={120} height={40} /> : (
                <Typography variant="h4" fontWeight={700} color="error.main">
                  {fmt(data?.totalPaid ?? 0)}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: balance >= 0 ? 'success.main' : 'error.main', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUp />
                <Typography variant="body2" sx={{ opacity: 0.85 }}>Resultado</Typography>
              </Box>
              {isLoading ? <Skeleton width={120} height={40} sx={{ bgcolor: 'rgba(255,255,255,0.3)' }} /> : (
                <Typography variant="h4" fontWeight={700}>
                  {balance >= 0 ? '+' : ''}{fmt(balance)}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Transações do período */}
      <Typography variant="subtitle1" fontWeight={600} mb={1.5}>
        Transações do caixa no período
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Data</TableCell>
              <TableCell>Descrição</TableCell>
              <TableCell>Categoria</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell align="right">Valor</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>{[1,2,3,4,5].map(j => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
            )) : (data?.transactions ?? []).map((t: any) => (
              <TableRow key={t.id} hover>
                <TableCell>{dayjs(t.createdAt).format('DD/MM HH:mm')}</TableCell>
                <TableCell>{t.description}</TableCell>
                <TableCell>{t.category ?? '—'}</TableCell>
                <TableCell>
                  <Chip
                    label={t.type === 'INCOME' ? 'Entrada' : 'Saída'}
                    size="small"
                    color={t.type === 'INCOME' ? 'success' : 'error'}
                    icon={t.type === 'INCOME' ? <ArrowUpward sx={{ fontSize: '14px !important' }} /> : <ArrowDownward sx={{ fontSize: '14px !important' }} />}
                  />
                </TableCell>
                <TableCell align="right">
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    color={t.type === 'INCOME' ? 'success.main' : 'error.main'}
                  >
                    {t.type === 'INCOME' ? '+' : '-'} {fmt(t.amount)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && (!data?.transactions || data.transactions.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" color="text.secondary" py={2}>
                    Nenhuma transação no período selecionado
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
