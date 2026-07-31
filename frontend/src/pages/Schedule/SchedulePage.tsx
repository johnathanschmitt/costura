import { useState, useRef } from 'react';
import {
  Box, Typography, Button, Paper, Chip, Tooltip, ButtonGroup,
  IconButton, useTheme, alpha, CircularProgress,
} from '@mui/material';
import {
  ChevronLeft, ChevronRight, Add, ViewWeek, ViewList,
  FiberManualRecord,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/pt-br';
import api from '../../services/api';
import ScheduleFormDialog, { TYPE_CONFIG } from './ScheduleFormDialog';
import ScheduleListView from './ScheduleListView';

// Grade: 7h às 21h = 14 horas
const START_HOUR = 7;
const END_HOUR = 21;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const HOUR_HEIGHT = 64; // px por hora
const TIME_COL_WIDTH = 52;

const STATUS_ALPHA: Record<string, number> = {
  SCHEDULED: 0.85, CONFIRMED: 1, DONE: 0.5, CANCELLED: 0.3, NO_SHOW: 0.3,
};

function timeToY(time: Dayjs): number {
  return (time.hour() - START_HOUR + time.minute() / 60) * HOUR_HEIGHT;
}

function durationToH(start: Dayjs, end: Dayjs): number {
  return Math.max(((end.diff(start, 'minute')) / 60) * HOUR_HEIGHT, 30);
}

interface AppointmentBlockProps {
  schedule: any;
  onClick: (e: React.MouseEvent) => void;
}

function AppointmentBlock({ schedule, onClick }: AppointmentBlockProps) {
  const theme = useTheme();
  const start = dayjs(schedule.startAt);
  const end = dayjs(schedule.endAt);
  const cfg = TYPE_CONFIG[schedule.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.OTHER;
  const opacity = STATUS_ALPHA[schedule.status] ?? 0.85;
  const top = timeToY(start);
  const height = schedule.allDay ? TOTAL_HOURS * HOUR_HEIGHT : durationToH(start, end);

  return (
    <Tooltip
      title={
        <Box>
          <Typography variant="caption" fontWeight={700}>{schedule.title}</Typography>
          {schedule.customer && <Typography variant="caption" display="block">{schedule.customer.name}</Typography>}
          {!schedule.allDay && (
            <Typography variant="caption" display="block">
              {start.format('HH:mm')} – {end.format('HH:mm')}
            </Typography>
          )}
          <Typography variant="caption" display="block" sx={{ textTransform: 'capitalize' }}>
            {schedule.status.toLowerCase().replace('_', ' ')}
          </Typography>
        </Box>
      }
      arrow
      placement="top"
    >
      <Box
        onClick={(e: React.MouseEvent) => onClick(e)}
        sx={{
          position: 'absolute',
          top,
          left: 3,
          right: 3,
          height,
          bgcolor: alpha(cfg.color, opacity * 0.18),
          borderLeft: `3px solid ${alpha(cfg.color, opacity)}`,
          borderRadius: '0 6px 6px 0',
          px: 0.75,
          py: 0.5,
          cursor: 'pointer',
          overflow: 'hidden',
          transition: 'filter 0.15s',
          '&:hover': { filter: 'brightness(0.92)' },
          zIndex: 1,
        }}
      >
        <Typography
          variant="caption"
          fontWeight={700}
          display="block"
          noWrap
          sx={{ color: cfg.color, lineHeight: 1.3 }}
        >
          {!schedule.allDay && `${start.format('HH:mm')} `}{schedule.title}
        </Typography>
        {schedule.customer && height > 40 && (
          <Typography variant="caption" display="block" noWrap sx={{ opacity: 0.75, fontSize: 11 }}>
            {schedule.customer.name}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
}

export default function SchedulePage() {
  const theme = useTheme();
  const [weekStart, setWeekStart] = useState<Dayjs>(dayjs().startOf('week'));
  const [view, setView] = useState<'week' | 'list'>('week');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitialDate, setDialogInitialDate] = useState<Dayjs | undefined>();
  const [dialogInitialHour, setDialogInitialHour] = useState<number | undefined>();
  const [editTarget, setEditTarget] = useState<any>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));
  const today = dayjs();

  const weekEnd = weekStart.endOf('week');

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['schedules', weekStart.toISOString()],
    queryFn: () =>
      api.get('/schedules', {
        params: { startDate: weekStart.toISOString(), endDate: weekEnd.toISOString() },
      }).then(r => r.data),
  });

  const { data: dueOrders } = useQuery({
    queryKey: ['work-orders-due', weekStart.toISOString()],
    queryFn: () =>
      api.get('/work-orders', {
        params: {
          dueStart: weekStart.toISOString(),
          dueEnd: weekEnd.toISOString(),
          limit: 100,
        },
      }).then(r => r.data?.data ?? []),
  });

  const dueFakeSchedules = (dueOrders ?? [])
    .filter((wo: any) => wo.status !== 'CANCELLED')
    .map((wo: any) => ({
      id: `due-${wo.id}`,
      _workOrderId: wo.id,
      type: 'DELIVERY',
      title: `Entrega ${wo.number}`,
      status: 'SCHEDULED',
      startAt: dayjs(wo.dueDate).hour(8).minute(0).toISOString(),
      endAt: dayjs(wo.dueDate).hour(9).minute(0).toISOString(),
      allDay: false,
      customer: wo.customer,
    }));

  const allEvents = [...(schedules as any[]), ...dueFakeSchedules];

  const openCreate = (date: Dayjs, hour?: number) => {
    setEditTarget(null);
    setDialogInitialDate(date);
    setDialogInitialHour(hour);
    setDialogOpen(true);
  };

  const openEdit = (schedule: any) => {
    setEditTarget(schedule);
    setDialogInitialDate(undefined);
    setDialogInitialHour(undefined);
    setDialogOpen(true);
  };

  const handleGridClick = (day: Dayjs, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const hour = Math.floor(relY / HOUR_HEIGHT) + START_HOUR;
    openCreate(day, Math.min(hour, END_HOUR - 1));
  };

  const getSchedulesForDay = (day: Dayjs) =>
    allEvents.filter(s => dayjs(s.startAt).isSame(day, 'day'));

  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)' }}>
      {/* Cabeçalho */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={() => setWeekStart(d => d.subtract(1, 'week'))}>
            <ChevronLeft />
          </IconButton>
          <Typography variant="h6" sx={{ minWidth: 220, textAlign: 'center' }}>
            {weekStart.format('DD MMM')} – {weekStart.endOf('week').format('DD MMM YYYY')}
          </Typography>
          <IconButton size="small" onClick={() => setWeekStart(d => d.add(1, 'week'))}>
            <ChevronRight />
          </IconButton>
          <Button size="small" variant="outlined" onClick={() => setWeekStart(dayjs().startOf('week'))}>
            Hoje
          </Button>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {/* Legenda tipos */}
          <Box sx={{ display: 'flex', gap: 1.5, mr: 1 }}>
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                <FiberManualRecord sx={{ fontSize: 10, color: cfg.color }} />
                <Typography variant="caption" color="text.secondary">{cfg.label}</Typography>
              </Box>
            ))}
          </Box>

          <ButtonGroup size="small">
            <Button
              variant={view === 'week' ? 'contained' : 'outlined'}
              onClick={() => setView('week')}
              startIcon={<ViewWeek />}
            >
              Semana
            </Button>
            <Button
              variant={view === 'list' ? 'contained' : 'outlined'}
              onClick={() => setView('list')}
              startIcon={<ViewList />}
            >
              Lista
            </Button>
          </ButtonGroup>

          <Button variant="contained" startIcon={<Add />} onClick={() => openCreate(today)}>
            Agendar
          </Button>
        </Box>
      </Box>

      {/* Vista semanal com grade de horários */}
      {view === 'week' && (
        <Paper variant="outlined" sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Cabeçalho dos dias */}
          <Box sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
            <Box sx={{ width: TIME_COL_WIDTH, flexShrink: 0 }} />
            {days.map(day => {
              const isToday = day.isSame(today, 'day');
              const count = getSchedulesForDay(day).length;
              return (
                <Box
                  key={day.format('YYYY-MM-DD')}
                  sx={{
                    flex: 1,
                    py: 1,
                    textAlign: 'center',
                    cursor: 'pointer',
                    bgcolor: isToday ? alpha(theme.palette.primary.main, 0.06) : undefined,
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                    borderLeft: 1,
                    borderColor: 'divider',
                  }}
                  onClick={() => openCreate(day)}
                >
                  <Typography
                    variant="caption"
                    color={isToday ? 'primary' : 'text.secondary'}
                    fontWeight={600}
                    display="block"
                    textTransform="uppercase"
                  >
                    {day.format('ddd')}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    <Typography
                      variant={isToday ? 'h6' : 'body1'}
                      fontWeight={isToday ? 700 : 400}
                      color={isToday ? 'primary' : 'text.primary'}
                    >
                      {day.format('D')}
                    </Typography>
                    {count > 0 && (
                      <Chip label={count} size="small" sx={{ height: 16, fontSize: 10 }} color={isToday ? 'primary' : 'default'} />
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>

          {/* Grade de horários */}
          <Box sx={{ flexGrow: 1, overflow: 'auto' }} ref={gridRef}>
            {isLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
                <CircularProgress />
              </Box>
            )}
            {!isLoading && (
              <Box sx={{ display: 'flex', height: TOTAL_HOURS * HOUR_HEIGHT }}>
                {/* Coluna de horas */}
                <Box sx={{ width: TIME_COL_WIDTH, flexShrink: 0, position: 'relative' }}>
                  {hours.map(h => (
                    <Box
                      key={h}
                      sx={{
                        position: 'absolute',
                        top: (h - START_HOUR) * HOUR_HEIGHT - 8,
                        left: 0,
                        right: 0,
                        textAlign: 'right',
                        pr: 1,
                      }}
                    >
                      <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11 }}>
                        {h}:00
                      </Typography>
                    </Box>
                  ))}
                </Box>

                {/* Colunas dos dias */}
                {days.map(day => {
                  const isToday = day.isSame(today, 'day');
                  const daySchedules = getSchedulesForDay(day);
                  const currentHourY = isToday
                    ? (today.hour() - START_HOUR + today.minute() / 60) * HOUR_HEIGHT
                    : null;

                  return (
                    <Box
                      key={day.format('YYYY-MM-DD')}
                      onClick={e => handleGridClick(day, e)}
                      sx={{
                        flex: 1,
                        position: 'relative',
                        borderLeft: 1,
                        borderColor: 'divider',
                        bgcolor: isToday ? alpha(theme.palette.primary.main, 0.02) : undefined,
                        cursor: 'crosshair',
                        '&:hover': { bgcolor: isToday ? alpha(theme.palette.primary.main, 0.04) : alpha('#000', 0.01) },
                      }}
                    >
                      {/* Linhas de hora */}
                      {hours.map(h => (
                        <Box
                          key={h}
                          sx={{
                            position: 'absolute',
                            top: (h - START_HOUR) * HOUR_HEIGHT,
                            left: 0, right: 0,
                            borderTop: 1,
                            borderColor: 'divider',
                          }}
                        />
                      ))}

                      {/* Linha do horário atual */}
                      {currentHourY !== null && currentHourY >= 0 && currentHourY <= TOTAL_HOURS * HOUR_HEIGHT && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: currentHourY,
                            left: 0, right: 0,
                            height: 2,
                            bgcolor: 'error.main',
                            zIndex: 2,
                            '&::before': {
                              content: '""',
                              position: 'absolute',
                              left: -4, top: -4,
                              width: 10, height: 10,
                              borderRadius: '50%',
                              bgcolor: 'error.main',
                            },
                          }}
                        />
                      )}

                      {/* Appointments */}
                      {daySchedules.map(s => (
                        <AppointmentBlock
                          key={s.id}
                          schedule={s}
                          onClick={e => {
                            e.stopPropagation();
                            if (s._workOrderId) {
                              window.open(`/work-orders/${s._workOrderId}/edit`, '_self');
                            } else {
                              openEdit(s);
                            }
                          }}
                        />
                      ))}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        </Paper>
      )}

      {/* Vista lista */}
      {view === 'list' && (
        <ScheduleListView
          weekStart={weekStart}
          onEdit={openEdit}
          onCreate={() => openCreate(today)}
        />
      )}

      <ScheduleFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditTarget(null); }}
        initialDate={dialogInitialDate}
        initialHour={dialogInitialHour}
        existing={editTarget}
      />
    </Box>
  );
}
