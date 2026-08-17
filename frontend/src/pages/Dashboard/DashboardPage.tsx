import { Grid, Card, CardContent, Typography, Box, Chip, Skeleton, List, ListItem, ListItemText, Divider, IconButton } from '@mui/material';
import { People, Assignment, MonetizationOn, Warning, LocalShipping, Refresh } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import dayjs from 'dayjs';

const SCHEDULE_TYPE_LABEL: Record<string, string> = {
  MEASUREMENT: 'Medição', FITTING: 'Prova', DELIVERY: 'Entrega',
  CONSULTATION: 'Consulta', OTHER: 'Outro',
};

const WO_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente', IN_PROGRESS: 'Em Andamento', WAITING_MATERIAL: 'Aguard. Material',
  FITTING: 'Prova', DONE: 'Concluída', DELIVERED: 'Entregue', CANCELLED: 'Cancelada',
};

const WO_PRIORITY_COLOR: Record<string, any> = {
  LOW: 'default', NORMAL: 'default', HIGH: 'warning', URGENT: 'error',
};

function StatCard({ title, value, icon, color }: { title: string; value: any; icon: React.ReactNode; color: string }) {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="body2" color="text.secondary">{title}</Typography>
            <Typography variant="h4" fontWeight={700}>{value}</Typography>
          </Box>
          <Box sx={{ bgcolor: `${color}.light`, p: 1.5, borderRadius: 2, color: `${color}.dark` }}>{icon}</Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/reports/dashboard').then(r => r.data),
    refetchInterval: 60_000,
  });

  const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

  if (isLoading) return (
    <Grid container spacing={2}>
      {[1, 2, 3, 4].map(i => <Grid item xs={12} sm={6} md={3} key={i}><Skeleton variant="rounded" height={100} /></Grid>)}
    </Grid>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">Dashboard</Typography>
        <IconButton onClick={() => refetch()} disabled={isFetching} color="primary">
          <Refresh />
        </IconButton>
      </Box>

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Total de Clientes" value={data?.totalCustomers ?? 0} icon={<People />} color="primary" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="OS Abertas" value={data?.openWorkOrders ?? 0} icon={<Assignment />} color="warning" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Entrou no Mês" value={fmt(data?.monthRevenue ?? 0)} icon={<MonetizationOn />} color="success" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="A Receber" value={fmt(data?.pendingReceivables ?? 0)} icon={<Warning />} color="error" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" mb={2}>Agenda de Hoje</Typography>
              {(data?.todaySchedules?.length ?? 0) === 0 && (data?.todayDueOrders?.length ?? 0) === 0 && (
                <Typography color="text.secondary" fontSize={14}>Nenhum agendamento hoje</Typography>
              )}
              <List dense>
                {data?.todaySchedules?.map((s: any) => (
                  <Box key={s.id}>
                    <ListItem disablePadding>
                      <ListItemText
                        primary={s.title}
                        secondary={`${dayjs(s.startAt).format('HH:mm')} — ${s.customer?.name ?? ''}`}
                      />
                      <Chip label={SCHEDULE_TYPE_LABEL[s.type] ?? s.type} size="small" />
                    </ListItem>
                    <Divider />
                  </Box>
                ))}
                {data?.todayDueOrders?.map((wo: any) => (
                  <Box key={`wo-${wo.id}`}>
                    <ListItem
                      disablePadding
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/work-orders/${wo.id}/edit`)}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <LocalShipping fontSize="small" sx={{ color: '#2E7D32' }} />
                            {`Entrega: OS ${wo.number} — ${wo.customer?.name ?? ''}`}
                          </Box>
                        }
                        secondary={`Prazo: hoje • ${WO_STATUS_LABEL[wo.status] ?? wo.status}`}
                      />
                      <Chip
                        label={WO_STATUS_LABEL[wo.status] ?? wo.status}
                        size="small"
                        color={wo.status === 'DELIVERED' ? 'success' : 'warning'}
                      />
                    </ListItem>
                    <Divider />
                  </Box>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" mb={2}>OS Prioritárias</Typography>
              <List dense>
                {data?.recentWorkOrders?.map((wo: any) => (
                  <Box key={wo.id}>
                    <ListItem disablePadding>
                      <ListItemText
                        primary={`${wo.number} — ${wo.customer?.name}`}
                        secondary={wo.dueDate ? `Prazo: ${dayjs(wo.dueDate).format('DD/MM/YYYY')}` : 'Sem prazo'}
                      />
                      <Chip
                        label={WO_STATUS_LABEL[wo.status] ?? wo.status}
                        size="small"
                        color={WO_PRIORITY_COLOR[wo.priority] ?? 'default'}
                      />
                    </ListItem>
                    <Divider />
                  </Box>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
