import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Button, Skeleton, Grid, Alert, Chip, Tooltip, LinearProgress,
} from '@mui/material';
import { ArrowForward } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';
import api from '../../services/api';
import { fmt, toNumber } from './format';
import { useCompact } from './useCompact';

function ReturnTable({ title, rows, target, isLoading, emptyLabel, emptyHint }: any) {
  const compact = useCompact();
  const best = rows.find((r: any) => r.perHour !== null);
  const bestRate = best ? toNumber(best.perHour) : 0;

  const empty = (
    <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
      <Typography variant="body1" fontWeight={600} gutterBottom>{emptyLabel}</Typography>
      <Typography variant="body2" color="text.secondary">{emptyHint}</Typography>
    </Box>
  );

  // No telefone, cada peça vira uma linha com o número que importa: por hora.
  if (compact) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} mb={1}>{title}</Typography>
        {isLoading && [0, 1, 2].map(i => <Skeleton key={i} height={40} />)}
        {!isLoading && rows.length === 0 && empty}
        {rows.map((r: any) => {
          const rate = r.perHour === null ? null : toNumber(r.perHour);
          const belowTarget = rate !== null && target && rate < target;
          return (
            <Box key={r.key} sx={{ display: 'flex', alignItems: 'baseline', gap: 1, py: 0.75 }}>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2">{r.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {r.count}x - {fmt(r.value)} - {toNumber(r.hours).toFixed(1)}h
                </Typography>
              </Box>
              <Typography
                variant="body2"
                fontWeight={700}
                color={rate === null ? 'text.disabled' : belowTarget ? 'error.main' : 'success.main'}
                sx={{ whiteSpace: 'nowrap' }}
              >
                {rate === null ? '-' : fmt(rate)}
              </Typography>
            </Box>
          );
        })}
      </Paper>
    );
  }

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
              <TableCell colSpan={6}>{empty}</TableCell>
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
  const navigate = useNavigate();
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
  const rate = totals?.perHour === null || totals?.perHour === undefined
    ? null
    : toNumber(totals.perHour);

  // Frase de fecho: a pergunta desta tela é "estou cobrando barato?", e ela
  // termina apontando exatamente o serviço que puxa a média para baixo.
  const worst = target === null
    ? null
    : [...(data?.byService ?? []), ...(data?.byGarment ?? [])]
      .filter((r: any) => r.perHour !== null && toNumber(r.perHour) < target)
      .sort((a: any, b: any) => toNumber(a.perHour) - toNumber(b.perHour))[0];

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
              <Typography variant="body2" sx={{ opacity: 0.85 }}>Cada hora de costura rendeu</Typography>
              <Typography variant="h5" fontWeight={700}>
                {rate === null ? '—' : fmt(rate)}
              </Typography>
              {/* O número já vem na unidade da vida real; o que falta é dizer o
                  que ele significa perto da meta, sem obrigar a fazer a conta. */}
              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                {target === null
                  ? 'sem meta definida'
                  : rate === null
                    ? `meta de ${fmt(target)} por hora`
                    : `${fmt(Math.abs(rate - target))} ${rate >= target ? 'acima' : 'abaixo'} da meta de ${fmt(target)}`}
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
            emptyLabel="Nenhuma peça entregue no período."
            emptyHint="Cada OS entregue entra aqui pelo tipo de peça, com o tempo estimado dela."
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <ReturnTable
            title="Por serviço"
            rows={data?.byService ?? []}
            target={target}
            isLoading={isLoading}
            emptyLabel="Nenhum serviço nas OS entregues no período."
            emptyHint="Os serviços vêm dos itens das OS entregues, cada um com o tempo do cadastro."
          />
        </Grid>
      </Grid>

      {worst && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, flexWrap: 'wrap' }}>
          <Typography variant="body2">
            <strong>{worst.name}</strong> rende {fmt(worst.perHour)} por hora,{' '}
            {toNumber(worst.perHour) < target! / 2 ? 'menos da metade' : `${fmt(target! - toNumber(worst.perHour))} abaixo`}
            {' '}da meta de {fmt(target)}. É o candidato mais claro a reajuste.
          </Typography>
          <Button size="small" endIcon={<ArrowForward />} onClick={() => navigate('/catalog/services')}>
            Rever o preço
          </Button>
        </Box>
      )}

      <Typography variant="caption" color="text.secondary" display="block" mt={2}>
        As horas vêm do tempo estimado da OS e do cadastro dos serviços. Ordenado da peça que mais
        rende por hora para a que menos rende.
      </Typography>
    </Box>
  );
}
