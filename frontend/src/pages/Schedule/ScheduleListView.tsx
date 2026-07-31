import {
  Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, IconButton, Typography, Skeleton, Button,
} from '@mui/material';
import { Edit, Add, OpenInNew } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';
import api from '../../services/api';
import { TYPE_CONFIG } from './ScheduleFormDialog';

const STATUS_MAP: Record<string, { label: string; color: any }> = {
  SCHEDULED: { label: 'Agendado', color: 'default' },
  CONFIRMED:  { label: 'Confirmado', color: 'info' },
  DONE:       { label: 'Realizado', color: 'success' },
  CANCELLED:  { label: 'Cancelado', color: 'error' },
  NO_SHOW:    { label: 'Não compareceu', color: 'warning' },
};

const WO_STATUS_MAP: Record<string, { label: string; color: any }> = {
  PENDING:          { label: 'Pendente',       color: 'default' },
  IN_PROGRESS:      { label: 'Em Andamento',   color: 'info' },
  WAITING_MATERIAL: { label: 'Aguard. Mat.',   color: 'warning' },
  FITTING:          { label: 'Prova',          color: 'secondary' },
  DONE:             { label: 'Concluída',      color: 'success' },
  DELIVERED:        { label: 'Entregue',       color: 'success' },
  CANCELLED:        { label: 'Cancelada',      color: 'error' },
};

interface Props {
  weekStart: Dayjs;
  onEdit: (schedule: any) => void;
  onCreate: () => void;
}

export default function ScheduleListView({ weekStart, onEdit, onCreate }: Props) {
  const navigate = useNavigate();
  const weekEnd = weekStart.endOf('week');

  const { data: schedules = [], isLoading: loadingSch } = useQuery({
    queryKey: ['schedules', weekStart.toISOString()],
    queryFn: () =>
      api.get('/schedules', {
        params: {
          startDate: weekStart.toISOString(),
          endDate: weekEnd.toISOString(),
        },
      }).then(r => r.data),
  });

  const { data: dueOrders = [], isLoading: loadingWo } = useQuery({
    queryKey: ['work-orders-due', weekStart.toISOString()],
    queryFn: () =>
      api.get('/work-orders', {
        params: { dueStart: weekStart.toISOString(), dueEnd: weekEnd.toISOString(), limit: 100 },
      }).then(r => r.data?.data ?? []),
  });

  const isLoading = loadingSch || loadingWo;

  const woEvents = (dueOrders as any[]).map(wo => ({
    _woId: wo.id,
    _woStatus: wo.status,
    startAt: dayjs(wo.dueDate).hour(8).minute(0).toISOString(),
    endAt:   dayjs(wo.dueDate).hour(9).minute(0).toISOString(),
    type: 'DELIVERY',
    title: `Entrega OS ${wo.number}`,
    customer: wo.customer,
    allDay: false,
  }));

  const sorted = [...(schedules as any[]), ...woEvents].sort(
    (a, b) => dayjs(a.startAt).diff(dayjs(b.startAt)),
  );

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Data/Hora</TableCell>
            <TableCell>Tipo</TableCell>
            <TableCell>Título</TableCell>
            <TableCell>Cliente</TableCell>
            <TableCell>OS</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">
              <Button size="small" startIcon={<Add />} onClick={onCreate}>Agendar</Button>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>{[1,2,3,4,5,6,7].map(j => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
          )) : sorted.map((s: any, idx: number) => {
            const cfg = TYPE_CONFIG[s.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.OTHER;
            const start = dayjs(s.startAt);
            const end = dayjs(s.endAt);
            const isToday = start.isSame(dayjs(), 'day');
            const isWo = Boolean(s._woId);

            const statusChip = isWo
              ? (() => { const m = WO_STATUS_MAP[s._woStatus] ?? { label: s._woStatus, color: 'default' }; return <Chip label={m.label} size="small" color={m.color} />; })()
              : (() => { const m = STATUS_MAP[s.status] ?? { label: s.status, color: 'default' }; return <Chip label={m.label} size="small" color={m.color} />; })();

            return (
              <TableRow key={s._woId ?? s.id ?? idx} hover sx={{ bgcolor: isToday ? 'action.hover' : undefined }}>
                <TableCell>
                  <Typography variant="body2" fontWeight={isToday ? 700 : 400}>
                    {start.format('ddd DD/MM')}
                  </Typography>
                  {!s.allDay && (
                    <Typography variant="caption" color="text.secondary">
                      {start.format('HH:mm')} – {end.format('HH:mm')}
                    </Typography>
                  )}
                  {s.allDay && <Chip label="Dia inteiro" size="small" variant="outlined" />}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: cfg.color }}>
                    {cfg.icon}
                    <Typography variant="caption" fontWeight={600}>{cfg.label}</Typography>
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 500 }}>{s.title}</TableCell>
                <TableCell>{s.customer?.name ?? '—'}</TableCell>
                <TableCell>
                  {isWo ? (
                    <Chip
                      label={s.title.replace('Entrega OS ', '')}
                      size="small"
                      variant="outlined"
                      onClick={() => navigate(`/work-orders/${s._woId}/edit`)}
                      sx={{ cursor: 'pointer' }}
                    />
                  ) : s.workOrder ? (
                    <Chip label={s.workOrder.number} size="small" variant="outlined" />
                  ) : '—'}
                </TableCell>
                <TableCell>{statusChip}</TableCell>
                <TableCell align="right">
                  {isWo ? (
                    <IconButton size="small" onClick={() => navigate(`/work-orders/${s._woId}/edit`)}>
                      <OpenInNew fontSize="small" />
                    </IconButton>
                  ) : (
                    <IconButton size="small" onClick={() => onEdit(s)}>
                      <Edit fontSize="small" />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {!isLoading && sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} align="center">
                <Typography variant="body2" color="text.secondary" py={3}>
                  Nenhum agendamento nesta semana
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
