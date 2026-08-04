import { useState } from 'react';
import {
  Box, Grid, Paper, Typography, CircularProgress, Alert,
  Select, MenuItem, FormControl, InputLabel, Divider,
} from '@mui/material';
import {
  TrendingUp, Group, Assignment, AccountBalance,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import RevenueChart from './RevenueChart';
import StatusChart from './StatusChart';
import TopCustomersChart from './TopCustomersChart';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 4 }, (_, i) => CURRENT_YEAR - i);

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

interface KpiTileProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}

function KpiTile({ label, value, sub, icon, color }: KpiTileProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={500} textTransform="uppercase" letterSpacing={0.5}>
            {label}
          </Typography>
          <Typography variant="h5" fontWeight={700} mt={0.5} sx={{ fontVariantNumeric: 'proportional-nums' }}>
            {value}
          </Typography>
          {sub && (
            <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
              {sub}
            </Typography>
          )}
        </Box>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
          {icon}
        </Box>
      </Box>
    </Paper>
  );
}

function ChartCard({ title, children, loading }: { title: string; children: React.ReactNode; loading?: boolean }) {
  return (
    <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
      <Typography variant="h6" fontWeight={600} mb={2}>{title}</Typography>
      <Divider sx={{ mb: 2 }} />
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      ) : children}
    </Paper>
  );
}

export default function ReportsPage() {
  const [year, setYear] = useState(CURRENT_YEAR);

  const { data: dashboard, isLoading: loadingDash, error: errDash } = useQuery({
    queryKey: ['reports-dashboard'],
    queryFn: () => api.get('/reports/dashboard').then(r => r.data),
    staleTime: 60_000,
  });

  const { data: revenueData = [], isLoading: loadingRevenue } = useQuery({
    queryKey: ['reports-revenue-month', year],
    queryFn: () => api.get('/reports/revenue-by-month', { params: { year } }).then(r => r.data),
    staleTime: 60_000,
  });

  // O gráfico "Receitas vs Despesas" saiu daqui: ele somava só o dinheiro da
  // gaveta (ignorando Pix e cartão) e contava sangria como despesa. Entradas e
  // saídas por período estão em Financeiro → Fluxo de Caixa, com a conta certa.

  const { data: statusData = [], isLoading: loadingStatus } = useQuery({
    queryKey: ['reports-status'],
    queryFn: () => api.get('/reports/work-orders-by-status').then(r => r.data),
    staleTime: 60_000,
  });

  const { data: topCustomers = [], isLoading: loadingTop } = useQuery({
    queryKey: ['reports-top-customers'],
    queryFn: () => api.get('/reports/top-customers').then(r => r.data),
    staleTime: 60_000,
  });

  const totalRevenue = (revenueData as any[]).reduce((s: number, m: any) => s + m.revenue, 0);
  const totalOrders = (revenueData as any[]).reduce((s: number, m: any) => s + m.count, 0);
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  if (errDash) {
    return <Alert severity="error">Erro ao carregar relatórios.</Alert>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Relatórios</Typography>
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>Ano</InputLabel>
          <Select value={year} label="Ano" onChange={e => setYear(Number(e.target.value))}>
            {YEARS.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      {/* KPI tiles */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiTile
            label="Receita no ano"
            value={loadingRevenue ? '…' : fmtBRL(totalRevenue)}
            sub={`${totalOrders} cobranças`}
            icon={<TrendingUp fontSize="small" />}
            color="#2a78d6"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiTile
            label="Ticket médio"
            value={loadingRevenue ? '…' : fmtBRL(avgTicket)}
            sub="receitas pagas"
            icon={<AccountBalance fontSize="small" />}
            color="#1baf7a"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiTile
            label="Clientes ativos"
            value={loadingDash ? '…' : String(dashboard?.totalCustomers ?? 0)}
            sub="total cadastrados"
            icon={<Group fontSize="small" />}
            color="#eb6834"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiTile
            label="OS em aberto"
            value={loadingDash ? '…' : String(dashboard?.openWorkOrders ?? 0)}
            sub="não entregues"
            icon={<Assignment fontSize="small" />}
            color="#eda100"
          />
        </Grid>
      </Grid>

      {/* Charts row 1 */}
      <Grid container spacing={2} mb={2}>
        <Grid item xs={12} lg={8}>
          <ChartCard title={`Receita mensal — ${year}`} loading={loadingRevenue}>
            <RevenueChart data={revenueData} />
          </ChartCard>
        </Grid>
        <Grid item xs={12} lg={4}>
          <ChartCard title="OS por status" loading={loadingStatus}>
            <StatusChart data={statusData} />
          </ChartCard>
        </Grid>
      </Grid>

      {/* Charts row 2 */}
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <ChartCard title="Top 10 clientes" loading={loadingTop}>
            {(topCustomers as any[]).length === 0
              ? <Typography variant="body2" color="text.secondary" py={4} textAlign="center">Sem dados</Typography>
              : <TopCustomersChart data={topCustomers} />}
          </ChartCard>
        </Grid>
      </Grid>
    </Box>
  );
}
