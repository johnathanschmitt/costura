import { useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, IconButton, Skeleton,
  LinearProgress, Divider, Button, Tooltip, Avatar,
} from '@mui/material';
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, TrendingFlat,
  Print, Person,
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

function Metric({ label, value, hint, color }: any) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="h6" fontWeight={700} color={color}>{value}</Typography>
        {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
      </CardContent>
    </Card>
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
  const ind = data.indicators;
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

      <Grid container spacing={3}>
        {/* 2. Rateio — para onde foi cada real */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={600}>Para onde foi o dinheiro</Typography>
            <Typography variant="caption" color="text.secondary" display="block" mb={2}>
              De cada {fmt(c.income)} que entrou, esta é a fatia de cada destino.
            </Typography>

            {data.allocation.length === 0 ? (
              <Typography variant="body2" color="text.secondary" py={2}>
                Nenhuma movimentação no mês.
              </Typography>
            ) : data.allocation.map((a: any) => (
              <Box key={a.category} sx={{ mb: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                  <Typography variant="body2" fontWeight={a.kind === 'PROFIT' ? 700 : 400}>
                    {a.category}
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {fmt(a.amount)} · {toNumber(a.share).toFixed(1)}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(toNumber(a.share), 100)}
                  color={a.kind === 'PROFIT' ? 'success' : 'error'}
                  sx={{ height: 8, borderRadius: 1 }}
                />
              </Box>
            ))}

            {result < 0 && (
              <Typography variant="caption" color="error.main" display="block" mt={1}>
                As saídas passaram do que entrou — o mês fechou negativo em {fmt(Math.abs(result))}.
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* 4. Indicadores do mês */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={600} mb={2}>Indicadores do mês</Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={6}>
                <Metric
                  label="Peças entregues"
                  value={ind.deliveredCount}
                  hint={`${fmt(ind.deliveredValue)} no total`}
                />
              </Grid>
              <Grid item xs={6}>
                <Metric
                  label="Ticket médio"
                  value={fmt(ind.averageTicket)}
                  hint="por peça entregue"
                />
              </Grid>
              <Grid item xs={6}>
                <Metric
                  label="Margem de lucro"
                  value={`${toNumber(c.margin).toFixed(1)}%`}
                  hint="do que entrou, virou sobra"
                  color={result >= 0 ? 'success.main' : 'error.main'}
                />
              </Grid>
              <Grid item xs={6}>
                <Metric
                  label="Orçamentos virando OS"
                  value={`${toNumber(ind.conversionRate).toFixed(0)}%`}
                  hint={`${ind.quotesConverted} de ${ind.quotesCreated} feitos no mês`}
                />
              </Grid>
            </Grid>

            {ind.bySeamstress.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" fontWeight={600} mb={1}>
                  Produção por costureira
                </Typography>
                {ind.bySeamstress.map((s: any) => (
                  <Box key={s.name} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75 }}>
                    <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: 'secondary.main' }}>
                      {s.name === 'Sem costureira' ? <Person sx={{ fontSize: 16 }} /> : s.name.charAt(0)}
                    </Avatar>
                    <Typography variant="body2" sx={{ flexGrow: 1 }}>{s.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {s.count} peça{s.count > 1 ? 's' : ''}
                    </Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ minWidth: 92, textAlign: 'right' }}>
                      {fmt(s.value)}
                    </Typography>
                  </Box>
                ))}
              </>
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
