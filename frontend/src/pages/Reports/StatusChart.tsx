import { Box, Typography, useTheme } from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts';

interface StatusData { status: string; label: string; count: number }

const STATUS_COLORS: Record<string, string> = {
  PENDING:          '#eda100',
  IN_PROGRESS:      '#2a78d6',
  WAITING_MATERIAL: '#eb6834',
  FITTING:          '#e87ba4',
  DONE:             '#1baf7a',
  DELIVERED:        '#1baf7a',
  CANCELLED:        '#e34948',
};

const GRID = '#e1e0d9';
const TEXT_SEC = '#52514e';

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: StatusData = payload[0].payload;
  return (
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
      <Typography variant="caption" fontWeight={700} display="block">{d.label}</Typography>
      <Typography variant="body2">{d.count} OS</Typography>
    </Box>
  );
}

export default function StatusChart({ data }: { data: StatusData[] }) {
  const theme = useTheme();
  const filtered = data.filter(d => d.count > 0);

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" mb={1}>
        Ordens de Serviço por status
      </Typography>
      <ResponsiveContainer width="100%" height={Math.max(filtered.length * 44 + 32, 180)}>
        <BarChart
          data={filtered}
          layout="vertical"
          margin={{ top: 4, right: 48, left: 0, bottom: 4 }}
          barCategoryGap="25%"
        >
          <CartesianGrid horizontal={false} stroke={GRID} strokeWidth={1} />
          <XAxis
            type="number"
            tick={{ fill: TEXT_SEC, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={120}
            tick={{ fill: TEXT_SEC, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <RTooltip content={<CustomTooltip />} cursor={{ fill: theme.palette.action.hover }} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
            {filtered.map(d => (
              <Cell key={d.status} fill={STATUS_COLORS[d.status] ?? '#898781'} />
            ))}
            <LabelList
              dataKey="count"
              position="right"
              style={{ fill: TEXT_SEC, fontSize: 12, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
