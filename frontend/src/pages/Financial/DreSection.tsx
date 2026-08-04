import { useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Button, LinearProgress, Skeleton,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { Print } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';
import api from '../../services/api';
import { fmt, toNumber } from './format';

/** Variação percentual entre períodos, com cor e sinal. */
function Variation({ value, invert }: { value: unknown; invert?: boolean }) {
  if (value === null || value === undefined) {
    return <Typography variant="caption" color="text.disabled">—</Typography>;
  }
  const v = toNumber(value);
  // Em despesa, subir é ruim.
  const good = invert ? v <= 0 : v >= 0;
  return (
    <Typography variant="caption" fontWeight={600} color={v === 0 ? 'text.secondary' : good ? 'success.main' : 'error.main'}>
      {v > 0 ? '▲ +' : v < 0 ? '▼ ' : ''}{v}%
    </Typography>
  );
}

/**
 * A coluna de "participação" (percentual de cada categoria no total) saiu: ela
 * não muda decisão nenhuma. No lugar entrou o mesmo período anterior, que é o
 * que mostra o que está subindo.
 */
function CategoryTable({ title, rows, color, total, previousTotal, isLoading, invert }: any) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Box sx={{ px: 2, pt: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Typography variant="subtitle1" fontWeight={600}>{title}</Typography>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="h6" fontWeight={700} color={color}>{fmt(total)}</Typography>
          <Typography variant="caption" color="text.secondary">
            antes {fmt(previousTotal)}
          </Typography>
        </Box>
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Categoria</TableCell>
            <TableCell align="right">Período</TableCell>
            <TableCell align="right">Anterior</TableCell>
            <TableCell align="right" width={90}>Variação</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? Array.from({ length: 3 }).map((_, i) => (
            <TableRow key={i}>{[1, 2, 3, 4].map(j => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
          )) : rows.map((r: any) => (
            <TableRow key={r.category} hover>
              <TableCell>{r.category}</TableCell>
              <TableCell align="right">{fmt(r.amount)}</TableCell>
              <TableCell align="right">
                <Typography variant="body2" color="text.secondary">{fmt(r.previousAmount)}</Typography>
              </TableCell>
              <TableCell align="right"><Variation value={r.variation} invert={invert} /></TableCell>
            </TableRow>
          ))}
          {!isLoading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} align="center">
                <Typography variant="body2" color="text.secondary" py={2}>
                  Nada no período
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function DreSection() {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState<Dayjs>(dayjs().startOf('month'));
  const [endDate, setEndDate] = useState<Dayjs>(dayjs().endOf('month'));

  const { data, isLoading } = useQuery({
    queryKey: ['dre', startDate.toISOString(), endDate.toISOString()],
    queryFn: () => api.get('/financial/dre', {
      params: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
    }).then(r => r.data),
  });

  const presets = [
    { label: 'Este mês', start: dayjs().startOf('month'), end: dayjs().endOf('month') },
    { label: 'Mês passado', start: dayjs().subtract(1, 'month').startOf('month'), end: dayjs().subtract(1, 'month').endOf('month') },
    { label: 'Este ano', start: dayjs().startOf('year'), end: dayjs().endOf('year') },
  ];

  const result = toNumber(data?.totals?.result);

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

      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
        <DatePicker label="De" value={startDate} onChange={v => v && setStartDate(v)} slotProps={{ textField: { size: 'small' } }} />
        <DatePicker label="Até" value={endDate} onChange={v => v && setEndDate(v)} slotProps={{ textField: { size: 'small' } }} />
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="outlined"
          startIcon={<Print />}
          onClick={() => navigate(
            `/financial/dre/print?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
          )}
        >
          PDF para o contador
        </Button>
      </Box>

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary">Receita</Typography>
              <Typography variant="h5" fontWeight={700} color="success.main">{fmt(data?.totals?.income)}</Typography>
              <Variation value={data?.totals?.incomeVariation} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary">Despesa</Typography>
              <Typography variant="h5" fontWeight={700} color="error.main">{fmt(data?.totals?.expense)}</Typography>
              <Variation value={data?.totals?.expenseVariation} invert />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: result >= 0 ? 'success.main' : 'error.main', color: 'white' }}>
            <CardContent>
              <Typography variant="body2" sx={{ opacity: 0.85 }}>Resultado</Typography>
              <Typography variant="h5" fontWeight={700}>
                {result >= 0 ? '+' : ''}{fmt(result)}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                margem de {toNumber(data?.totals?.margin).toFixed(1)}% · antes{' '}
                {fmt(data?.totals?.previousResult)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <CategoryTable
            title="Receitas por categoria"
            rows={data?.income ?? []}
            total={data?.totals?.income}
            previousTotal={data?.totals?.previousIncome}
            color="success.main"
            isLoading={isLoading}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <CategoryTable
            title="Despesas por categoria"
            rows={data?.expense ?? []}
            total={data?.totals?.expense}
            previousTotal={data?.totals?.previousExpense}
            color="error.main"
            isLoading={isLoading}
            invert
          />
        </Grid>
      </Grid>

      <Typography variant="caption" color="text.secondary" display="block" mt={2}>
        Comparado com o período de mesmo tamanho imediatamente anterior. Sangrias e suprimentos
        ficam de fora — são transferências de dinheiro, não resultado.
      </Typography>
    </Box>
  );
}
