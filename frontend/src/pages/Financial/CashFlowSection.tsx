import {
  Box, Card, CardContent, Typography, Chip, Button, Alert,
  FormControl, InputLabel, Select, MenuItem, Collapse,
} from '@mui/material';
import { WarningAmber, CheckCircleOutline } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import api from '../../services/api';
import { useFinancialPeriod } from '../../store/financialPeriod.store';
import CashFlowChart from './CashFlowChart';
import CategorySelect from './CategorySelect';
import { fmt, METHOD_LABELS, toNumber } from './format';

/**
 * Previsão — o que ainda vai entrar e sair, dia a dia.
 *
 * A tela respondia a duas perguntas ao mesmo tempo, "o que já entrou" e "o que
 * vai entrar", e por isso ninguém sabia dizer o que estava olhando. O que já
 * entrou é assunto do Resultado (os totais) e de "Onde está o dinheiro" (o
 * extrato); aqui ficou só o que nenhuma outra tela faz: a projeção e o aviso de
 * quando o saldo fura.
 */
export default function CashFlowSection() {
  const { from, to, setRange } = useFinancialPeriod();
  const [groupBy, setGroupBy] = useState<'week' | 'month'>('month');
  const [category, setCategory] = useState('');
  const [custom, setCustom] = useState(false);

  const start = dayjs(from);
  const end = dayjs(to);

  const periodLabel = (key: string) =>
    groupBy === 'month' ? dayjs(`${key}-01`).format('MMMM/YY') : `semana de ${dayjs(key).format('DD/MM')}`;

  const params = {
    startDate: start.startOf('day').toISOString(),
    endDate: end.endOf('day').toISOString(),
  };

  const { data: chart } = useQuery({
    queryKey: ['cash-flow-chart', params.startDate, params.endDate, groupBy, category],
    queryFn: () =>
      api.get('/financial/cash-flow/chart', {
        params: { ...params, groupBy, category: category || undefined },
      }).then(r => r.data),
  });

  // Só as formas de pagamento interessam desta consulta; o extrato que ela
  // também devolve mora agora em "Onde está o dinheiro".
  const { data: received } = useQuery({
    queryKey: ['cash-flow-methods', params.startDate, params.endDate],
    queryFn: () => api.get('/financial/cash-flow', { params: { ...params, limit: 1 } }).then(r => r.data),
  });

  const byMethod = (received?.receivedByMethod ?? []).filter((m: any) => toNumber(m.amount) > 0);

  const presets = [
    { label: 'Este mês', start: dayjs().startOf('month'), end: dayjs().endOf('month') },
    { label: 'Próximos 3 meses', start: dayjs().startOf('month'), end: dayjs().add(2, 'month').endOf('month') },
    { label: 'Este ano', start: dayjs().startOf('year'), end: dayjs().endOf('year') },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2, alignItems: 'center' }}>
        {presets.map(p => (
          <Button
            key={p.label}
            size="small"
            variant={start.isSame(p.start, 'day') && end.isSame(p.end, 'day') ? 'contained' : 'outlined'}
            onClick={() => setRange(p.start.format('YYYY-MM-DD'), p.end.format('YYYY-MM-DD'))}
          >
            {p.label}
          </Button>
        ))}
        <Button size="small" onClick={() => setCustom(c => !c)}>período…</Button>

        <Box sx={{ flexGrow: 1 }} />

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
      </Box>

      <Collapse in={custom}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
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

      {/* A melhor frase acionável do módulo: dá para o período fechar no azul e
          faltar dinheiro no meio do caminho. */}
      {chart?.firstNegative ? (
        <Alert severity="error" sx={{ mb: 2 }} icon={<WarningAmber />}>
          O saldo projetado fica negativo em{' '}
          <strong>{periodLabel(chart.firstNegative.key)}</strong> ({fmt(chart.firstNegative.balance)}).
          Antecipe um recebimento ou negocie um vencimento.
        </Alert>
      ) : chart && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
          <CheckCircleOutline fontSize="small" sx={{ color: 'text.disabled' }} />
          <Typography variant="body2" color="text.secondary">
            O saldo não fica negativo em nenhum dia do período.
          </Typography>
        </Box>
      )}

      {chart && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary">Sobra projetada no período</Typography>
            <Typography
              variant="h4"
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

      <Box sx={{ mb: 3 }}>
        <CashFlowChart data={chart} groupBy={groupBy} />
      </Box>

      {byMethod.length > 0 && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary" mb={1}>
            O que já entrou no período, por forma de pagamento
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
    </Box>
  );
}
