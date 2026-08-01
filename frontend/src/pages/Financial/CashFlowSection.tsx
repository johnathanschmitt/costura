import { useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, Button, Skeleton, Tooltip,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import { ArrowUpward, ArrowDownward, TrendingUp, Download } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import { useQuery } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import api from '../../services/api';
import CashFlowChart from './CashFlowChart';
import { EXPENSE_CATEGORIES, fmt, METHOD_LABELS, toNumber } from './format';

export default function CashFlowSection() {
  const [startDate, setStartDate] = useState<Dayjs>(dayjs().startOf('month'));
  const [endDate, setEndDate] = useState<Dayjs>(dayjs().endOf('month'));
  const [groupBy, setGroupBy] = useState<'week' | 'month'>('month');
  const [category, setCategory] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['cash-flow', startDate.toISOString(), endDate.toISOString()],
    queryFn: () =>
      api.get('/financial/cash-flow', {
        params: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      }).then(r => r.data),
  });

  const { data: chart } = useQuery({
    queryKey: ['cash-flow-chart', startDate.toISOString(), endDate.toISOString(), groupBy, category],
    queryFn: () =>
      api.get('/financial/cash-flow/chart', {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          groupBy,
          category: category || undefined,
        },
      }).then(r => r.data),
  });

  const exportCsv = async () => {
    const res = await api.get('/financial/cash-flow/export', {
      params: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fluxo-de-caixa-${startDate.format('YYYY-MM-DD')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const periodLabel = (key: string) =>
    groupBy === 'month' ? dayjs(`${key}-01`).format('MMMM/YY') : `semana de ${dayjs(key).format('DD/MM')}`;

  const balance = toNumber(data?.balance);
  const entries = data?.entries ?? [];
  const byMethod = (data?.receivedByMethod ?? []).filter((m: any) => toNumber(m.amount) > 0);

  const presets = [
    { label: 'Este mês', start: dayjs().startOf('month'), end: dayjs().endOf('month') },
    { label: 'Mês passado', start: dayjs().subtract(1, 'month').startOf('month'), end: dayjs().subtract(1, 'month').endOf('month') },
    { label: 'Últimos 3 meses', start: dayjs().subtract(3, 'month').startOf('month'), end: dayjs().endOf('month') },
    { label: 'Este ano', start: dayjs().startOf('year'), end: dayjs().endOf('year') },
  ];

  return (
    <Box>
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

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
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
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Agrupar por</InputLabel>
          <Select value={groupBy} label="Agrupar por" onChange={e => setGroupBy(e.target.value as any)}>
            <MenuItem value="month">Mês</MenuItem>
            <MenuItem value="week">Semana</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Categoria</InputLabel>
          <Select value={category} label="Categoria" onChange={e => setCategory(e.target.value)}>
            <MenuItem value="">Todas</MenuItem>
            {EXPENSE_CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="outlined" startIcon={<Download />} onClick={exportCsv}>
          Exportar
        </Button>
      </Box>

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ArrowUpward sx={{ color: 'success.main' }} />
                <Typography variant="body2" color="text.secondary">Total Recebido</Typography>
              </Box>
              {isLoading ? <Skeleton width={120} height={40} /> : (
                <>
                  <Typography variant="h4" fontWeight={700} color="success.main">
                    {fmt(data?.totalReceived)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {fmt(data?.breakdown?.fromAccountsReceivable)} de contas ·{' '}
                    {fmt(data?.breakdown?.fromDirectCash)} avulso
                  </Typography>
                </>
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
                <>
                  <Typography variant="h4" fontWeight={700} color="error.main">
                    {fmt(data?.totalPaid)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {fmt(data?.breakdown?.toAccountsPayable)} de contas ·{' '}
                    {fmt(data?.breakdown?.fromDirectCashExpense)} avulso
                  </Typography>
                </>
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

      {/* Projeção e extremos do período */}
      {chart && (
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body2" color="text.secondary">Projeção do período</Typography>
                <Typography
                  variant="h5"
                  fontWeight={700}
                  color={Number(chart.totals.projectedResult) >= 0 ? 'success.main' : 'error.main'}
                >
                  {fmt(chart.totals.projectedResult)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  inclui {fmt(chart.totals.plannedIn)} a receber e {fmt(chart.totals.plannedOut)} a pagar
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body2" color="text.secondary">Melhor período</Typography>
                {chart.best ? (
                  <>
                    <Typography variant="h6" fontWeight={700} color="success.main">
                      {fmt(chart.best.result)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                      {periodLabel(chart.best.key)}
                    </Typography>
                  </>
                ) : <Typography variant="body2" color="text.disabled">—</Typography>}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body2" color="text.secondary">Pior período</Typography>
                {chart.worst ? (
                  <>
                    <Typography variant="h6" fontWeight={700} color="error.main">
                      {fmt(chart.worst.result)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                      {periodLabel(chart.worst.key)}
                    </Typography>
                  </>
                ) : <Typography variant="body2" color="text.disabled">—</Typography>}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Gráfico */}
      <Box sx={{ mb: 3 }}>
        <CashFlowChart data={chart} groupBy={groupBy} />
      </Box>

      {byMethod.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" mb={1}>
            Recebimentos por forma de pagamento
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {byMethod.map((m: any) => (
              <Chip
                key={m.method}
                label={`${METHOD_LABELS[m.method] ?? m.method}: ${fmt(m.amount)}`}
                variant="outlined"
                color={m.method === 'CASH' ? 'primary' : 'default'}
              />
            ))}
          </Box>
        </Box>
      )}

      <Typography variant="subtitle1" fontWeight={600} mb={1.5}>
        Movimentações do período
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Data</TableCell>
              <TableCell>Descrição</TableCell>
              <TableCell>Cliente / Fornecedor</TableCell>
              <TableCell>Categoria</TableCell>
              <TableCell>Forma</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell align="right">Valor</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>{[1,2,3,4,5,6,7].map(j => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
            )) : entries.map((t: any) => (
              <TableRow key={`${t.source}-${t.id}`} hover>
                <TableCell>{dayjs(t.date).format('DD/MM HH:mm')}</TableCell>
                <TableCell>
                  {t.description}
                  {t.source === 'CASH' && (
                    <Tooltip title="Lançamento avulso do caixa, sem conta vinculada">
                      <Chip label="avulso" size="small" variant="outlined" sx={{ ml: 1, height: 18, fontSize: 11 }} />
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell>{t.party ?? '—'}</TableCell>
                <TableCell>{t.category ?? '—'}</TableCell>
                <TableCell>{METHOD_LABELS[t.method] ?? t.method}</TableCell>
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
            {!isLoading && entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary" py={2}>
                    Nenhuma movimentação no período selecionado
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
