import { useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, Button, Skeleton, Tooltip,
  FormControl, InputLabel, Select, MenuItem, TablePagination, TextField, Alert,
} from '@mui/material';
import {
  ArrowUpward, ArrowDownward, TrendingUp, Download, Search, WarningAmber,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import { useQuery } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import api from '../../services/api';
import CashFlowChart from './CashFlowChart';
import CategorySelect from './CategorySelect';
import { fmt, METHOD_LABELS, toNumber } from './format';

export default function CashFlowSection() {
  const [startDate, setStartDate] = useState<Dayjs>(dayjs().startOf('month'));
  const [endDate, setEndDate] = useState<Dayjs>(dayjs().endOf('month'));
  const [groupBy, setGroupBy] = useState<'week' | 'month'>('month');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);

  const periodLabel = (key: string) =>
    groupBy === 'month' ? dayjs(`${key}-01`).format('MMMM/YY') : `semana de ${dayjs(key).format('DD/MM')}`;

  const { data, isLoading } = useQuery({
    queryKey: ['cash-flow', startDate.toISOString(), endDate.toISOString(), page, limit, search],
    queryFn: () =>
      api.get('/financial/cash-flow', {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          page: page + 1,
          limit,
          search: search || undefined,
        },
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
        <Box sx={{ minWidth: 160 }}>
          <CategorySelect type="EXPENSE" value={category} onChange={setCategory} emptyLabel="Todas" />
        </Box>
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

      {/*
        "Melhor período" e "pior período" saíram: são curiosidade histórica, não
        decisão. O que muda o que se faz hoje é a projeção — e ela ficou.
      */}
      {/* Saldo projetado negativo é o aviso que muda decisão: dá para o período
          fechar no azul e faltar dinheiro no meio do caminho. */}
      {chart?.firstNegative && (
        <Alert severity="error" sx={{ mb: 2 }} icon={<WarningAmber />}>
          O saldo projetado fica negativo em{' '}
          <strong>{periodLabel(chart.firstNegative.key)}</strong> ({fmt(chart.firstNegative.balance)}).
          Antecipe um recebimento ou negocie um vencimento.
        </Alert>
      )}

      {chart && (
        <Card variant="outlined" sx={{ mb: 3 }}>
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

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="subtitle1" fontWeight={600}>Movimentações do período</Typography>
        <Box sx={{ flexGrow: 1 }} />
        {/* O extrato vinha cortado em 500 linhas sem avisar: quem procurava um
            lançamento antigo simplesmente não achava. */}
        <TextField
          size="small"
          placeholder="Buscar por descrição, cliente ou categoria"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          InputProps={{ startAdornment: <Search fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} /> }}
          sx={{ minWidth: 320 }}
        />
      </Box>
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
                    {search
                      ? `Nada encontrado para "${search}" no período`
                      : 'Nenhuma movimentação no período selecionado'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={data?.entriesTotal ?? 0}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={limit}
          onRowsPerPageChange={e => { setLimit(Number(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[20, 50, 100, 200]}
          labelRowsPerPage="Por página"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
        />
      </TableContainer>
    </Box>
  );
}
