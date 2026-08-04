import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Button, Skeleton, Grid, Alert, Chip, Tooltip, LinearProgress,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { useQuery } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import api from '../../services/api';
import { fmt, toNumber } from './format';

function ReturnTable({ title, rows, target, isLoading, emptyLabel }: any) {
  const best = rows.find((r: any) => r.perHour !== null);
  const bestRate = best ? toNumber(best.perHour) : 0;

  return (
    <TableContainer component={Paper} variant="outlined">
      <Box sx={{ px: 2, pt: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={600}>{title}</Typography>
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Nome</TableCell>
            <TableCell align="right">Qtd.</TableCell>
            <TableCell align="right">Valor</TableCell>
            <TableCell align="right">Horas</TableCell>
            <TableCell align="right">Por hora</TableCell>
            <TableCell width={110} />
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading && Array.from({ length: 3 }).map((_, i) => (
            <TableRow key={i}>{[1, 2, 3, 4, 5, 6].map(j => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
          ))}
          {!isLoading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} align="center">
                <Typography variant="body2" color="text.secondary" py={2}>{emptyLabel}</Typography>
              </TableCell>
            </TableRow>
          )}
          {rows.map((r: any) => {
            const rate = r.perHour === null ? null : toNumber(r.perHour);
            const belowTarget = rate !== null && target && rate < target;
            return (
              <TableRow key={r.key} hover>
                <TableCell>
                  {r.name}
                  {r.withoutHours > 0 && (
                    <Tooltip title={`${r.withoutHours} sem tempo estimado — ficaram de fora da conta por hora`}>
                      <Chip size="small" label={`${r.withoutHours} sem hora`} sx={{ ml: 1 }} />
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell align="right">{r.count}</TableCell>
                <TableCell align="right">{fmt(r.value)}</TableCell>
                <TableCell align="right">{toNumber(r.hours).toFixed(1)}h</TableCell>
                <TableCell align="right">
                  {rate === null ? (
                    <Typography variant="caption" color="text.disabled">—</Typography>
                  ) : (
                    <Typography
                      variant="body2"
                      fontWeight={700}
                      color={belowTarget ? 'error.main' : 'success.main'}
                    >
                      {fmt(rate)}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  {rate !== null && bestRate > 0 && (
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, (rate / bestRate) * 100)}
                      color={belowTarget ? 'error' : 'success'}
                      sx={{ height: 6, borderRadius: 1 }}
                    />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/**
 * Quanto cada tipo de peça e cada serviço rende pelo tempo que consome.
 *
 * O ateliê cobra por peça, mas o que limita o mês é a hora de costura: uma peça
 * de R$ 400 que leva 12 horas rende menos que uma de R$ 150 que leva 2. É esta
 * tela que diz o que vale a pena aceitar — e o que precisa de reajuste.
 */
export default function ReturnsSection() {
  const [startDate, setStartDate] = useState<Dayjs>(dayjs().subtract(2, 'month').startOf('month'));
  const [endDate, setEndDate] = useState<Dayjs>(dayjs().endOf('month'));

  const { data, isLoading } = useQuery({
    queryKey: ['financial-returns', startDate.toISOString(), endDate.toISOString()],
    queryFn: () => api.get('/financial/returns', {
      params: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
    }).then(r => r.data),
  });

  const presets = [
    { label: 'Este mês', start: dayjs().startOf('month'), end: dayjs().endOf('month') },
    { label: 'Últimos 3 meses', start: dayjs().subtract(2, 'month').startOf('month'), end: dayjs().endOf('month') },
    { label: 'Este ano', start: dayjs().startOf('year'), end: dayjs().endOf('year') },
  ];

  const totals = data?.totals;
  const target = totals?.targetHourlyRate ? toNumber(totals.targetHourlyRate) : null;

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
        <Box sx={{ flexGrow: 1 }} />
        <DatePicker label="De" value={startDate} onChange={v => v && setStartDate(v)} slotProps={{ textField: { size: 'small' } }} />
        <DatePicker label="Até" value={endDate} onChange={v => v && setEndDate(v)} slotProps={{ textField: { size: 'small' } }} />
      </Box>

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary">Peças entregues</Typography>
              <Typography variant="h5" fontWeight={700}>{totals?.deliveredCount ?? 0}</Typography>
              <Typography variant="caption" color="text.secondary">
                {toNumber(totals?.hours).toFixed(1)}h de trabalho estimadas
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary">Valor entregue</Typography>
              <Typography variant="h5" fontWeight={700}>{fmt(totals?.value)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
            <CardContent>
              <Typography variant="body2" sx={{ opacity: 0.85 }}>Média por hora</Typography>
              <Typography variant="h5" fontWeight={700}>
                {totals?.perHour === null || totals?.perHour === undefined ? '—' : fmt(totals.perHour)}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                {target ? `meta ${fmt(target)}/h` : 'sem meta definida'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {(totals?.withoutHours ?? 0) > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {totals.withoutHours} peça(s) entregues sem tempo estimado ficaram de fora da conta por
          hora. O tempo é informado na OS ou no cadastro do serviço.
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <ReturnTable
            title="Por tipo de peça"
            rows={data?.byGarment ?? []}
            target={target}
            isLoading={isLoading}
            emptyLabel="Nenhuma peça entregue no período"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <ReturnTable
            title="Por serviço"
            rows={data?.byService ?? []}
            target={target}
            isLoading={isLoading}
            emptyLabel="Nenhum serviço nas OS entregues no período"
          />
        </Grid>
      </Grid>

      <Typography variant="caption" color="text.secondary" display="block" mt={2}>
        As horas vêm do tempo estimado da OS e do cadastro dos serviços. Ordenado da peça que mais
        rende por hora para a que menos rende.
      </Typography>
    </Box>
  );
}
