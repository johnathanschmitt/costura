import { Box, Typography, useTheme, Paper } from '@mui/material';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import dayjs from 'dayjs';
import { fmt } from './format';

/**
 * Paleta categórica validada para os dois modos (checagens de banda de
 * luminosidade, croma, separação para daltonismo e contraste). Os passos
 * escuros são escolhidos para a superfície escura, não um espelho do claro.
 */
const SERIES = {
  light: { income: '#1baf7a', expense: '#eb6834', projected: '#2a78d6' },
  dark: { income: '#199e70', expense: '#d95926', projected: '#3987e5' },
};

interface Props {
  data: any;
  groupBy: 'week' | 'month';
}

const labelFor = (key: string, groupBy: 'week' | 'month') =>
  groupBy === 'month'
    ? dayjs(`${key}-01`).format('MMM/YY')
    : dayjs(key).format('DD/MM');

export default function CashFlowChart({ data, groupBy }: Props) {
  const theme = useTheme();
  const c = theme.palette.mode === 'dark' ? SERIES.dark : SERIES.light;
  const axis = theme.palette.text.secondary;
  const grid = theme.palette.divider;

  const series = (data?.series ?? []).map((s: any) => ({
    label: labelFor(s.key, groupBy),
    entradas: Number(s.income),
    saidas: Number(s.expense),
    saldoProjetado: Number(s.projectedBalance),
  }));

  if (series.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Sem movimentação no período para montar o gráfico
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={600} mb={0.5}>
        Entradas e saídas por {groupBy === 'month' ? 'mês' : 'semana'}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" mb={2}>
        A linha mostra o saldo acumulado projetado, somando o que ainda está a receber e a pagar.
      </Typography>

      <Box sx={{ width: '100%', height: 320 }}>
        <ResponsiveContainer>
          <ComposedChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barGap={2}>
            {/* Grade recessiva: só horizontais, para não competir com as barras. */}
            <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: grid }} />
            {/* Eixo único: entradas, saídas e saldo estão todos em reais. */}
            <YAxis
              tick={{ fill: axis, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={72}
              tickFormatter={v => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(v)}
            />
            <ReferenceLine y={0} stroke={grid} />
            <Tooltip
              formatter={(value: any, name: string) => [fmt(value), name]}
              labelStyle={{ color: theme.palette.text.primary, fontWeight: 600 }}
              contentStyle={{
                background: theme.palette.background.paper,
                border: `1px solid ${grid}`,
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: axis }} />
            <Bar dataKey="entradas" name="Entradas" fill={c.income} radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="saidas" name="Saídas" fill={c.expense} radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Line
              type="monotone"
              dataKey="saldoProjetado"
              name="Saldo projetado"
              stroke={c.projected}
              strokeWidth={2}
              dot={{ r: 4, strokeWidth: 2, fill: theme.palette.background.paper }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
}
