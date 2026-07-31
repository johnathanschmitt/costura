import { Box, Typography, useTheme } from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

interface MonthData { month: number; label: string; income: number; expense: number }

const BLUE = '#2a78d6';
const ORANGE = '#eb6834';
const GRID = '#e1e0d9';
const TEXT_SEC = '#52514e';

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function fmtK(v: number) {
  if (v >= 1000) return `R$${(v / 1000).toFixed(0)}k`;
  return `R$${v.toFixed(0)}`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, minWidth: 160 }}>
      <Typography variant="caption" fontWeight={700} display="block" mb={0.5}>{label}</Typography>
      {payload.map((p: any) => (
        <Box key={p.dataKey} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p.fill }} />
            <Typography variant="caption" color="text.secondary">{p.name}</Typography>
          </Box>
          <Typography variant="caption" fontWeight={600}>{fmtBRL(p.value)}</Typography>
        </Box>
      ))}
    </Box>
  );
}

function renderLegend({ payload }: any) {
  return (
    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 0.5 }}>
      {payload.map((entry: any) => (
        <Box key={entry.value} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: 1, bgcolor: entry.color }} />
          <Typography variant="caption" color="text.secondary">{entry.value}</Typography>
        </Box>
      ))}
    </Box>
  );
}

export default function CashFlowChart({ data }: { data: MonthData[] }) {
  const theme = useTheme();
  const max = Math.max(...data.flatMap(d => [d.income, d.expense]), 1);

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" mb={1}>
        Receitas vs Despesas por mês
      </Typography>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barCategoryGap="25%" barGap={2}>
          <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
          <XAxis
            dataKey="label"
            tick={{ fill: TEXT_SEC, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={fmtK}
            tick={{ fill: TEXT_SEC, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            domain={[0, max * 1.15]}
            width={52}
          />
          <RTooltip content={<CustomTooltip />} cursor={{ fill: theme.palette.action.hover }} />
          <Legend content={renderLegend} />
          <Bar dataKey="income" name="Receitas" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={20} />
          <Bar dataKey="expense" name="Despesas" fill={ORANGE} radius={[4, 4, 0, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
