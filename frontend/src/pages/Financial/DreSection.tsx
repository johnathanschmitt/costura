import { useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Button, LinearProgress, Skeleton,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { useQuery } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import api from '../../services/api';
import { fmt, toNumber } from './format';

function CategoryTable({ title, rows, color, total, isLoading }: any) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Box sx={{ px: 2, pt: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Typography variant="subtitle1" fontWeight={600}>{title}</Typography>
        <Typography variant="h6" fontWeight={700} color={color}>{fmt(total)}</Typography>
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Categoria</TableCell>
            <TableCell align="right">Valor</TableCell>
            <TableCell width={140}>Participação</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? Array.from({ length: 3 }).map((_, i) => (
            <TableRow key={i}>{[1, 2, 3].map(j => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
          )) : rows.map((r: any) => (
            <TableRow key={r.category} hover>
              <TableCell>{r.category}</TableCell>
              <TableCell align="right">{fmt(r.amount)}</TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(toNumber(r.share), 100)}
                    color={color === 'success.main' ? 'success' : 'error'}
                    sx={{ flexGrow: 1, height: 6, borderRadius: 1 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 42, textAlign: 'right' }}>
                    {toNumber(r.share).toFixed(1)}%
                  </Typography>
                </Box>
              </TableCell>
            </TableRow>
          ))}
          {!isLoading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} align="center">
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

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <DatePicker label="De" value={startDate} onChange={v => v && setStartDate(v)} slotProps={{ textField: { size: 'small' } }} />
        <DatePicker label="Até" value={endDate} onChange={v => v && setEndDate(v)} slotProps={{ textField: { size: 'small' } }} />
      </Box>

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary">Receita</Typography>
              <Typography variant="h5" fontWeight={700} color="success.main">{fmt(data?.totals?.income)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary">Despesa</Typography>
              <Typography variant="h5" fontWeight={700} color="error.main">{fmt(data?.totals?.expense)}</Typography>
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
                margem de {toNumber(data?.totals?.margin).toFixed(1)}% sobre a receita
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
            color="success.main"
            isLoading={isLoading}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <CategoryTable
            title="Despesas por categoria"
            rows={data?.expense ?? []}
            total={data?.totals?.expense}
            color="error.main"
            isLoading={isLoading}
          />
        </Grid>
      </Grid>

      <Typography variant="caption" color="text.secondary" display="block" mt={2}>
        Sangrias e suprimentos ficam de fora — são transferências de dinheiro, não resultado.
      </Typography>
    </Box>
  );
}
