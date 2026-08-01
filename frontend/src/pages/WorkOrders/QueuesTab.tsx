import {
  Box, Card, CardContent, Typography, Chip, Avatar, LinearProgress, Skeleton,
  Table, TableBody, TableCell, TableHead, TableRow, Alert, Tooltip, Grid,
} from '@mui/material';
import { Warning, Person, AccessTime } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';
import { PRIORITY_MAP, STATUS_MAP } from './constants';

const hours = (v: unknown) => `${Number(v ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`;

export default function QueuesTab() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['work-order-queues'],
    queryFn: () => api.get('/work-orders/queues').then(r => r.data),
  });

  if (isLoading) {
    return (
      <Grid container spacing={2}>
        {Array.from({ length: 2 }).map((_, i) => (
          <Grid item xs={12} key={i}><Skeleton variant="rounded" height={220} /></Grid>
        ))}
      </Grid>
    );
  }

  const queues = data?.queues ?? [];
  const overloaded = queues.filter((q: any) => q.overloaded);

  return (
    <Box>
      {overloaded.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {overloaded.length === 1
            ? <><strong>{overloaded[0].name}</strong> tem {overloaded[0].queueDays} dias de fila</>
            : <>{overloaded.length} costureiras com mais de {data.alertDays} dias de fila</>}
          {' '}— acima do limite de {data.alertDays} dias configurado.
        </Alert>
      )}

      <Typography variant="caption" color="text.secondary" display="block" mb={2}>
        As OS sem horas estimadas entram na conta com a média das demais ({hours(data?.averageHours)}),
        para a carga não ficar subestimada.
      </Typography>

      <Grid container spacing={2}>
        {queues.map((q: any) => (
          <Grid item xs={12} lg={6} key={q.userId ?? 'none'}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  {q.userId ? (
                    <Avatar sx={{ bgcolor: 'secondary.main', width: 36, height: 36 }}>
                      {q.name.charAt(0).toUpperCase()}
                    </Avatar>
                  ) : (
                    <Avatar sx={{ bgcolor: 'grey.400', width: 36, height: 36 }}><Person /></Avatar>
                  )}
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="subtitle1" fontWeight={600}>{q.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {q.count} OS · {hours(q.estimatedHours)}
                      {q.userId && ` · capacidade ${hours(q.dailyCapacityHours)}/dia`}
                    </Typography>
                  </Box>
                  {q.overdueCount > 0 && (
                    <Tooltip title={`${q.overdueCount} atrasada(s)`}>
                      <Chip size="small" color="error" icon={<Warning sx={{ fontSize: '14px !important' }} />} label={q.overdueCount} />
                    </Tooltip>
                  )}
                  {q.userId && (
                    <Chip
                      size="small"
                      color={q.overloaded ? 'warning' : 'default'}
                      icon={<AccessTime sx={{ fontSize: '14px !important' }} />}
                      label={`${q.queueDays} dias`}
                    />
                  )}
                </Box>

                {q.userId && (
                  <LinearProgress
                    variant="determinate"
                    // A barra enche ao atingir o limite de dias configurado.
                    value={Math.min((Number(q.queueDays) / data.alertDays) * 100, 100)}
                    color={q.overloaded ? 'warning' : 'success'}
                    sx={{ borderRadius: 1, mb: 1.5, height: 6 }}
                  />
                )}

                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>OS</TableCell>
                      <TableCell>Cliente</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Horas</TableCell>
                      <TableCell>Prazo</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {q.items.map((wo: any) => {
                      const s = STATUS_MAP[wo.status] ?? { label: wo.status, color: 'default' };
                      const p = PRIORITY_MAP[wo.priority] ?? PRIORITY_MAP.NORMAL;
                      return (
                        <TableRow
                          key={wo.id}
                          hover
                          onClick={() => navigate(`/work-orders/${wo.id}/edit`)}
                          sx={{
                            cursor: 'pointer',
                            bgcolor: wo.overdue ? 'error.50' : undefined,
                            borderLeft: 3,
                            borderLeftColor: p.bar,
                          }}
                        >
                          <TableCell>{wo.number}</TableCell>
                          <TableCell>{wo.customer?.name}</TableCell>
                          <TableCell><Chip label={s.label} size="small" color={s.color} /></TableCell>
                          <TableCell align="right">
                            <Tooltip title={wo.estimated ? 'Horas informadas' : 'Estimativa pela média'}>
                              <Typography variant="caption" color={wo.estimated ? 'text.primary' : 'text.disabled'}>
                                {hours(wo.hoursUsed)}{!wo.estimated && '*'}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell sx={{ color: wo.overdue ? 'error.main' : undefined }}>
                            {wo.dueDate ? dayjs(wo.dueDate).format('DD/MM') : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {q.items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography variant="body2" color="text.secondary" py={1}>
                            Nenhuma OS na fila
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
