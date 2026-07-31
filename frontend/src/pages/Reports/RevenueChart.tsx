import { Box, Typography, useTheme } from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, LabelList,
} from 'recharts';

interface MonthData { month: number; label: string; revenue: number; count: number }

const BLUE = '#2a78d6';
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
  const d: MonthData = payload[0].payload;
  return (
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, minWidth: 140 }}>
      <Typography variant="caption" fontWeight={700} display="block">{label}</Typography>
      <Typography variant="body2" color="text.primary">{fmtBRL(d.revenue)}</Typography>
      <Typography variant="caption" color="text.secondary">{d.count} cobranças</Typography>
    </Box>
  );
}

export default function RevenueChart({ data }: { data: MonthData[] }) {
  const theme = useTheme();
  const max = Math.max(...data.map(d => d.revenue), 1);

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" mb={1}>
        Receita por mês (R$)
      </Typography>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 20, right: 16, left: 0, bottom: 0 }} barCategoryGap="30%">
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
          <Bar dataKey="revenue" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={40}>
            <LabelList
              dataKey="revenue"
              position="top"
              formatter={(v: number) => v > 0 ? fmtK(v) : ''}
              style={{ fill: TEXT_SEC, fontSize: 10 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
