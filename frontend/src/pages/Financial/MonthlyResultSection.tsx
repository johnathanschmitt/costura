import { useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, IconButton, Skeleton,
  LinearProgress, Button, Tooltip,
} from '@mui/material';
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, TrendingFlat, Print,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';
import { fmt, toNumber } from './format';

const monthLabel = (key: string) => dayjs(`${key}-01`).format('MMMM [de] YYYY');

/** Seta e cor da variação: para despesa, cair é bom — daí `invert`. */
function Variation({ value, invert }: { value: unknown; invert?: boolean }) {
  if (value === null || value === undefined) {
    return <Typography variant="caption" color="text.disabled">sem base de comparação</Typography>;
  }
  const n = toNumber(value);
  const flat = Math.abs(n) < 0.05;
  const good = invert ? n < 0 : n > 0;
  const Icon = flat ? TrendingFlat : n > 0 ? TrendingUp : TrendingDown;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Icon fontSize="small" sx={{ color: flat ? 'text.disabled' : good ? 'success.main' : 'error.main' }} />
      <Typography
        variant="caption"
        sx={{ color: flat ? 'text.secondary' : good ? 'success.main' : 'error.main', fontWeight: 600 }}
      >
        {n > 0 ? '+' : ''}{n.toFixed(1)}% vs. mês anterior
      </Typography>
    </Box>
  );
}

export default function MonthlyResultSection() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));

  const { data, isLoading } = useQuery({
    queryKey: ['monthly-result', month],
    queryFn: () => api.get('/financial/monthly-result', { params: { month } }).then(r => r.data),
  });

  const shift = (delta: number) => setMonth(m => dayjs(`${m}-01`).add(delta, 'month').format('YYYY-MM'));
  const isCurrentMonth = month === dayjs().format('YYYY-MM');

  if (isLoading) {
    return (
      <Grid container spacing={2}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Grid item xs={12} sm={6} md={3} key={i}><Skeleton variant="rounded" height={110} /></Grid>
        ))}
      </Grid>
    );
  }

  const c = data.current;
  const result = toNumber(c.result);
  const maxHistory = Math.max(
    ...data.history.map((h: any) => Math.max(toNumber(h.income), toNumber(h.expense))), 1,
  );

  return (
    <Box>
      {/* Navegação por mês */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <IconButton size="small" onClick={() => shift(-1)}><ChevronLeft /></IconButton>
        <Typography variant="h6" sx={{ minWidth: 210, textAlign: 'center', textTransform: 'capitalize' }}>
          {monthLabel(data.month)}
        </Typography>
        <IconButton size="small" onClick={() => shift(1)} disabled={isCurrentMonth}>
          <ChevronRight />
        </IconButton>
        {!isCurrentMonth && (
          <Button size="small" onClick={() => setMonth(dayjs().format('YYYY-MM'))}>Mês atual</Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="outlined"
          startIcon={<Print />}
          onClick={() => navigate(`/financial/fechamento/${data.month}`)}
        >
          Fechamento do mês
        </Button>
      </Box>

      {/* 1. Painel do mês com comparação */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Entrou</Typography>
              <Typography variant="h5" fontWeight={700} color="success.main">{fmt(c.income)}</Typography>
              <Variation value={data.variation.income} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Saiu</Typography>
              <Typography variant="h5" fontWeight={700} color="error.main">{fmt(c.expense)}</Typography>
              <Variation value={data.variation.expense} invert />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', bgcolor: result >= 0 ? 'success.main' : 'error.main', color: 'white' }}>
            <CardContent>
              <Typography variant="body2" sx={{ opacity: 0.85 }}>Sobrou no mês</Typography>
              <Typography variant="h5" fontWeight={700}>
                {result >= 0 ? '+' : ''}{fmt(result)}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                margem de {toNumber(c.margin).toFixed(1)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Mês anterior ({dayjs(`${data.previous.month}-01`).format('MMM/YY')})
              </Typography>
              <Typography variant="h6" fontWeight={700}>{fmt(data.previous.result)}</Typography>
              <Variation value={data.variation.result} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/*
        Aqui existiam dois painéis que não ajudavam a decidir nada: o "rateio de
        cada real", que repetia as despesas do DRE em percentual, e os
        indicadores comerciais (ticket médio, conversão de orçamento, produção
        por costureira), que são assunto de Relatórios e não de financeiro.
        No lugar ficou a pergunta que o mês precisa responder: de onde veio e
        para onde foi o dinheiro, em reais.
      */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={600} mb={1.5}>De onde veio</Typography>
            {c.incomeByCategory.length === 0 ? (
              <Typography variant="body2" color="text.secondary" py={2}>
                Nada entrou no mês.
              </Typography>
            ) : c.incomeByCategory.map((r: any) => (
              <Box key={r.category} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75 }}>
                <Typography variant="body2">{r.category}</Typography>
                <Typography variant="body2" fontWeight={600} color="success.main">{fmt(r.amount)}</Typography>
              </Box>
            ))}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={600} mb={1.5}>Para onde foi</Typography>
            {c.expenseByCategory.length === 0 ? (
              <Typography variant="body2" color="text.secondary" py={2}>
                Nenhuma despesa no mês.
              </Typography>
            ) : c.expenseByCategory.map((r: any) => (
              <Box key={r.category} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75 }}>
                <Typography variant="body2">{r.category}</Typography>
                <Typography variant="body2" fontWeight={600} color="error.main">{fmt(r.amount)}</Typography>
              </Box>
            ))}
            {result < 0 && (
              <Typography variant="caption" color="error.main" display="block" mt={1}>
                As saídas passaram do que entrou — o mês fechou negativo em {fmt(Math.abs(result))}.
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* 3. Histórico — base do fechamento */}
        <Grid item xs={12}>
          <TableContainer component={Paper} variant="outlined">
            <Box sx={{ px: 2, pt: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>Histórico dos últimos meses</Typography>
              <Typography variant="caption" color="text.secondary">
                Clique num mês para abrir o painel dele.
              </Typography>
            </Box>
            <Table size="small" sx={{ mt: 1 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Mês</TableCell>
                  <TableCell align="right">Entrou</TableCell>
                  <TableCell align="right">Saiu</TableCell>
                  <TableCell align="right">Resultado</TableCell>
                  <TableCell sx={{ width: '30%' }}>Proporção</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[...data.history].reverse().map((h: any) => {
                  const r = toNumber(h.result);
                  const atual = h.key === data.month;
                  return (
                    <TableRow
                      key={h.key}
                      hover
                      onClick={() => setMonth(h.key)}
                      sx={{ cursor: 'pointer', bgcolor: atual ? 'action.selected' : undefined }}
                    >
                      <TableCell sx={{ textTransform: 'capitalize', fontWeight: atual ? 700 : 400 }}>
                        {dayjs(`${h.key}-01`).format('MMM/YY')}
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'success.main' }}>{fmt(h.income)}</TableCell>
                      <TableCell align="right" sx={{ color: 'error.main' }}>{fmt(h.expense)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: r >= 0 ? 'success.main' : 'error.main' }}>
                        {r >= 0 ? '+' : ''}{fmt(r)}
                      </TableCell>
                      <TableCell>
                        {/* Barras lado a lado dão a leitura do mês num relance */}
                        <Tooltip title={`Entrou ${fmt(h.income)} · Saiu ${fmt(h.expense)}`}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                            <Box sx={{ height: 6, borderRadius: 1, bgcolor: 'success.main', width: `${(toNumber(h.income) / maxHistory) * 100}%`, minWidth: toNumber(h.income) > 0 ? 4 : 0 }} />
                            <Box sx={{ height: 6, borderRadius: 1, bgcolor: 'error.main', width: `${(toNumber(h.expense) / maxHistory) * 100}%`, minWidth: toNumber(h.expense) > 0 ? 4 : 0 }} />
                          </Box>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
      </Grid>
    </Box>
  );
}
