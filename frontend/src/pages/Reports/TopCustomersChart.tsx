import { Box, Typography, useTheme } from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, LabelList,
} from 'recharts';

interface CustomerData { name: string; total: number; orders: number }

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

function truncate(name: string, max = 22) {
  return name.length > max ? name.slice(0, max - 1) + '…' : name;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: CustomerData = payload[0].payload;
  return (
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, minWidth: 160 }}>
      <Typography variant="caption" fontWeight={700} display="block">{d.name}</Typography>
      <Typography variant="body2">{fmtBRL(d.total)}</Typography>
      <Typography variant="caption" color="text.secondary">{d.orders} pedidos</Typography>
    </Box>
  );
}

export default function TopCustomersChart({ data }: { data: CustomerData[] }) {
  const theme = useTheme();
  const displayed = data.slice(0, 10).map(d => ({ ...d, _label: truncate(d.name) }));

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" mb={1}>
        Top clientes por receita
      </Typography>
      <ResponsiveContainer width="100%" height={Math.max(displayed.length * 44 + 32, 180)}>
        <BarChart
          data={displayed}
          layout="vertical"
          margin={{ top: 4, right: 64, left: 0, bottom: 4 }}
          barCategoryGap="25%"
        >
          <CartesianGrid horizontal={false} stroke={GRID} strokeWidth={1} />
          <XAxis
            type="number"
            tickFormatter={fmtK}
            tick={{ fill: TEXT_SEC, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="_label"
            width={140}
            tick={{ fill: TEXT_SEC, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <RTooltip content={<CustomTooltip />} cursor={{ fill: theme.palette.action.hover }} />
          <Bar dataKey="total" fill={BLUE} radius={[0, 4, 4, 0]} maxBarSize={24}>
            <LabelList
              dataKey="total"
              position="right"
              formatter={(v: number) => fmtK(v)}
              style={{ fill: TEXT_SEC, fontSize: 11, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
