import { useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton, Skeleton,
  Button, Tooltip, ToggleButton, ToggleButtonGroup, Collapse,
} from '@mui/material';
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, TrendingFlat, Print,
  ArrowForward,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';
import { useFinancialPeriod } from '../../store/financialPeriod.store';
import { fmt, toNumber } from './format';
import { useCompact } from './useCompact';

const monthLabel = (key: string) => dayjs(`${key}-01`).format('MMMM [de] YYYY');

/** O trimestre a que uma data pertence. O dayjs só sabe disso com plugin. */
const quarterOf = (d: dayjs.Dayjs) => {
  const start = d.month(Math.floor(d.month() / 3) * 3).startOf('month');
  return { start, end: start.add(2, 'month').endOf('month') };
};

/** Seta e cor da variação: para despesa, cair é bom — daí `invert`. */
function Variation({ value, invert, suffix }: { value: unknown; invert?: boolean; suffix?: string }) {
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
        {n > 0 ? '+' : ''}{n.toFixed(1)}%{suffix ?? ''}
      </Typography>
    </Box>
  );
}

/**
 * De onde veio / Para onde foi, cada linha comparada com o período anterior.
 * A comparação existia só no DRE — e é justamente ela que responde "o que mudou
 * neste mês?", que é a razão de abrir a tela.
 */
function CategoryList({ title, rows, color, invert, empty, hint }: any) {
  if (!rows.length) {
    return (
      <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
        <Typography variant="subtitle1" fontWeight={600} mb={1.5}>{title}</Typography>
        <Typography variant="body2" color="text.secondary" py={2}>{empty}</Typography>
        <Typography variant="caption" color="text.secondary">{hint}</Typography>
      </Paper>
    );
  }
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Typography variant="subtitle1" fontWeight={600} mb={1.5}>{title}</Typography>
      {rows.map((r: any) => (
        <Box key={r.category} sx={{ display: 'flex', alignItems: 'baseline', gap: 1, py: 0.75 }}>
          <Typography variant="body2" sx={{ flexGrow: 1 }}>{r.category}</Typography>
          <Typography variant="body2" fontWeight={600} color={color}>{fmt(r.amount)}</Typography>
          <Box sx={{ width: 92, textAlign: 'right' }}>
            <Variation value={r.variation} invert={invert} />
          </Box>
        </Box>
      ))}
    </Paper>
  );
}

/**
 * Resultado — como foi o período e no quê.
 *
 * Absorveu o DRE, que era esta mesma tela com nome de contador: os dois liam a
 * mesma fonte e mostravam os mesmos três números com vocabulários diferentes.
 * O que o DRE tinha de próprio — período livre, comparação por categoria e a
 * impressão — ficou; a sigla sobrevive só no PDF, que é quem pede assim.
 */
export default function MonthlyResultSection() {
  const navigate = useNavigate();
  const compact = useCompact();
  const { month, from, to, setMonth, setRange } = useFinancialPeriod();
  const [custom, setCustom] = useState(false);

  const start = dayjs(from);
  const end = dayjs(to);

  // O período é um mês inteiro? Só então o histórico mês a mês faz sentido.
  const isWholeMonth =
    start.isSame(start.startOf('month'), 'day') && end.isSame(start.endOf('month'), 'day');

  const quarter = quarterOf(start);
  const preset = isWholeMonth ? 'mes'
    : start.isSame(start.startOf('year'), 'day') && end.isSame(start.endOf('year'), 'day') ? 'ano'
      : start.isSame(quarter.start, 'day') && end.isSame(quarter.end, 'day') ? 'trimestre'
        : 'livre';

  const { data, isLoading } = useQuery({
    queryKey: ['dre', from, to],
    queryFn: () => api.get('/financial/dre', {
      params: { startDate: start.startOf('day').toISOString(), endDate: end.endOf('day').toISOString() },
    }).then(r => r.data),
  });

  const { data: monthly } = useQuery({
    queryKey: ['monthly-result', month],
    queryFn: () => api.get('/financial/monthly-result', { params: { month } }).then(r => r.data),
    enabled: isWholeMonth,
  });

  const shift = (delta: number) => setMonth(dayjs(`${month}-01`).add(delta, 'month').format('YYYY-MM'));
  const isCurrentMonth = month === dayjs().format('YYYY-MM');

  const applyPreset = (key: string) => {
    const now = dayjs();
    if (key === 'mes') setMonth(now.format('YYYY-MM'));
    if (key === 'trimestre') {
      const q = quarterOf(now);
      setRange(q.start.format('YYYY-MM-DD'), q.end.format('YYYY-MM-DD'));
    }
    if (key === 'ano') setRange(now.startOf('year').format('YYYY-MM-DD'), now.endOf('year').format('YYYY-MM-DD'));
    setCustom(key === 'livre');
  };

  const income = toNumber(data?.totals?.income);
  const result = toNumber(data?.totals?.result);
  const expenseRows = data?.expense ?? [];

  // Frase de fecho: uma tela que só informa deixa a usuária sozinha com o "e
  // agora?". A despesa que mais subiu é o próximo passo mais provável.
  const rose = [...expenseRows]
    .filter((r: any) => toNumber(r.variation) > 0 && toNumber(r.amount) > toNumber(r.previousAmount))
    .sort((a: any, b: any) =>
      (toNumber(b.amount) - toNumber(b.previousAmount)) - (toNumber(a.amount) - toNumber(a.previousAmount)))[0];

  const history = monthly?.history ?? [];
  const maxHistory = Math.max(
    ...history.map((h: any) => Math.max(toNumber(h.income), toNumber(h.expense))), 1,
  );

  const periodLabel = isWholeMonth
    ? monthLabel(month)
    : `${start.format('DD/MM/YYYY')} a ${end.format('DD/MM/YYYY')}`;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        {isWholeMonth ? (
          <>
            <IconButton size="small" onClick={() => shift(-1)}><ChevronLeft /></IconButton>
            <Typography variant="h6" sx={{ minWidth: 210, textAlign: 'center', textTransform: 'capitalize' }}>
              {monthLabel(month)}
            </Typography>
            <IconButton size="small" onClick={() => shift(1)} disabled={isCurrentMonth}>
              <ChevronRight />
            </IconButton>
            {!isCurrentMonth && (
              <Button size="small" onClick={() => setMonth(dayjs().format('YYYY-MM'))}>Mês atual</Button>
            )}
          </>
        ) : (
          <Typography variant="h6" sx={{ minWidth: 210 }}>{periodLabel}</Typography>
        )}

        <Box sx={{ flexGrow: 1 }} />

        <ToggleButtonGroup exclusive size="small" value={preset} onChange={(_, v) => v && applyPreset(v)}>
          <ToggleButton value="mes">mês</ToggleButton>
          <ToggleButton value="trimestre">trimestre</ToggleButton>
          <ToggleButton value="ano">ano</ToggleButton>
          <ToggleButton value="livre" onClick={() => setCustom(c => !c)}>período…</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Collapse in={custom || preset === 'livre'}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <DatePicker
            label="De"
            value={start}
            onChange={v => v && setRange(v.format('YYYY-MM-DD'), to)}
            slotProps={{ textField: { size: 'small' } }}
          />
          <DatePicker
            label="Até"
            value={end}
            onChange={v => v && setRange(from, v.format('YYYY-MM-DD'))}
            slotProps={{ textField: { size: 'small' } }}
          />
        </Box>
      </Collapse>

      <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          startIcon={<Print />}
          onClick={() => navigate(
            `/financial/dre/print?startDate=${start.startOf('day').toISOString()}&endDate=${end.endOf('day').toISOString()}`,
          )}
        >
          PDF para o contador
        </Button>
        {isWholeMonth && (
          <Button variant="outlined" startIcon={<Print />} onClick={() => navigate(`/financial/fechamento/${month}`)}>
            Fechamento do mês
          </Button>
        )}
      </Box>

      {isLoading ? (
        <Grid container spacing={2}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Grid item xs={12} sm={4} key={i}><Skeleton variant="rounded" height={110} /></Grid>
          ))}
        </Grid>
      ) : (
        <>
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} sm={4}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Entrou</Typography>
                  <Typography variant="h5" fontWeight={700} color="success.main">{fmt(income)}</Typography>
                  <Variation value={data?.totals?.incomeVariation} />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Saiu</Typography>
                  <Typography variant="h5" fontWeight={700} color="error.main">{fmt(data?.totals?.expense)}</Typography>
                  <Variation value={data?.totals?.expenseVariation} invert />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card sx={{ height: '100%', bgcolor: result >= 0 ? 'success.main' : 'error.main', color: 'white' }}>
                <CardContent>
                  <Typography variant="body2" sx={{ opacity: 0.85 }}>Sobrou</Typography>
                  <Typography variant="h5" fontWeight={700}>
                    {result >= 0 ? '+' : ''}{fmt(result)}
                  </Typography>
                  {/* O número na unidade da vida real. "Margem de 34,2%" precisa
                      ser interpretado; "de cada R$ 100, sobraram R$ 34" não. */}
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    {income > 0
                      ? `de cada R$ 100 que entrou, ${fmt((result / income) * 100)} ${result >= 0 ? 'sobraram' : 'faltaram'}`
                      : 'nada entrou no período'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <CategoryList
                title="De onde veio"
                rows={data?.income ?? []}
                color="success.main"
                empty="Nada entrou no período."
                hint="Cada conta recebida entra aqui pela categoria dela — costura, ajustes, venda direta."
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <CategoryList
                title="Para onde foi"
                rows={expenseRows}
                color="error.main"
                invert
                empty="Nenhuma despesa no período."
                hint="Cada conta paga entra aqui pela categoria dela — aluguel, tecidos, energia."
              />
            </Grid>

            {/* No telefone as barras de proporção não cabem; fica a leitura
                que interessa — que mês sobrou quanto. */}
            {isWholeMonth && history.length > 0 && compact && (
              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600} mb={1}>
                    Histórico dos últimos meses
                  </Typography>
                  {[...history].reverse().map((h: any) => {
                    const r = toNumber(h.result);
                    const atual = h.key === month;
                    return (
                      <Box
                        key={h.key}
                        onClick={() => setMonth(h.key)}
                        sx={{
                          display: 'flex', justifyContent: 'space-between', py: 0.75,
                          cursor: 'pointer', fontWeight: atual ? 700 : 400,
                        }}
                      >
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                          {dayjs(`${h.key}-01`).format('MMM/YY')}
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          color={r >= 0 ? 'success.main' : 'error.main'}
                        >
                          {r >= 0 ? '+' : ''}{fmt(r)}
                        </Typography>
                      </Box>
                    );
                  })}
                </Paper>
              </Grid>
            )}

            {isWholeMonth && history.length > 0 && !compact && (
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
                        <TableCell align="right">Sobrou</TableCell>
                        <TableCell sx={{ width: '30%' }}>Proporção</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[...history].reverse().map((h: any) => {
                        const r = toNumber(h.result);
                        const atual = h.key === month;
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
            )}
          </Grid>

          {rose && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, flexWrap: 'wrap' }}>
              <Typography variant="body2">
                O que mais subiu foi <strong>{rose.category}</strong>, +{toNumber(rose.variation).toFixed(0)}%
                {' '}({fmt(toNumber(rose.amount) - toNumber(rose.previousAmount))} a mais que antes).
              </Typography>
              <Button
                size="small"
                endIcon={<ArrowForward />}
                onClick={() => navigate(`/financial/contas-do-mes?lado=pagar&categoria=${encodeURIComponent(rose.category)}`)}
              >
                Ver as contas de {rose.category}
              </Button>
            </Box>
          )}

          <Typography variant="caption" color="text.secondary" display="block" mt={2}>
            Comparado com o período de mesmo tamanho imediatamente anterior. Sangrias e suprimentos
            ficam de fora — são transferências de dinheiro, não resultado.
          </Typography>
        </>
      )}
    </Box>
  );
}
