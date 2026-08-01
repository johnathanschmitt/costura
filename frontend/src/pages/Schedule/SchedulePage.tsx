import { useState } from 'react';
import {
  Box, Typography, Button, Chip, ButtonGroup, IconButton,
  FormControlLabel, Switch,
} from '@mui/material';
import {
  ChevronLeft, ChevronRight, Add, ViewWeek, ViewList,
  CalendarViewMonth, CalendarViewDay, FiberManualRecord,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/pt-br';
import api from '../../services/api';
import ScheduleFormDialog, { TYPE_CONFIG } from './ScheduleFormDialog';
import ScheduleListView from './ScheduleListView';
import TimeGridView from './TimeGridView';
import MonthView from './MonthView';

type View = 'month' | 'week' | 'day' | 'list';

/** Unidade de navegação e intervalo carregado, por visão. */
const VIEW_UNIT: Record<Exclude<View, 'list'>, dayjs.ManipulateType> = {
  month: 'month',
  week: 'week',
  day: 'day',
};

export default function SchedulePage() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState<Dayjs>(dayjs());
  const [showDeadlines, setShowDeadlines] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitialDate, setDialogInitialDate] = useState<Dayjs | undefined>();
  const [dialogInitialHour, setDialogInitialHour] = useState<number | undefined>();
  const [editTarget, setEditTarget] = useState<any>(null);

  const today = dayjs();
  const unit = VIEW_UNIT[view === 'list' ? 'week' : view];

  // O mês precisa da grade inteira (6 semanas), senão faltam os dias das bordas.
  const rangeStart = view === 'month'
    ? anchor.startOf('month').startOf('week')
    : anchor.startOf(unit);
  const rangeEnd = view === 'month'
    ? rangeStart.add(41, 'day').endOf('day')
    : anchor.endOf(unit);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['schedules', rangeStart.toISOString(), rangeEnd.toISOString(), showDeadlines],
    queryFn: () => api.get('/schedules', {
      params: {
        startDate: rangeStart.toISOString(),
        endDate: rangeEnd.toISOString(),
        includeDeadlines: showDeadlines ? 'true' : undefined,
      },
    }).then(r => r.data),
  });

  const openCreate = (date: Dayjs, hour?: number) => {
    setEditTarget(null);
    setDialogInitialDate(date);
    setDialogInitialHour(hour);
    setDialogOpen(true);
  };

  const openEvent = (event: any) => {
    // Prazo de OS não é agendamento — abre a própria OS.
    if (event.kind === 'WORK_ORDER_DEADLINE') {
      navigate(`/work-orders/${event.workOrderId}/edit`);
      return;
    }
    setEditTarget(event);
    setDialogInitialDate(undefined);
    setDialogInitialHour(undefined);
    setDialogOpen(true);
  };

  const openDay = (date: Dayjs) => { setAnchor(date); setView('day'); };

  const periodLabel = view === 'month'
    ? anchor.format('MMMM [de] YYYY')
    : view === 'day'
      ? anchor.format('dddd, DD [de] MMMM')
      : `${anchor.startOf('week').format('DD MMM')} – ${anchor.endOf('week').format('DD MMM YYYY')}`;

  const days = view === 'day'
    ? [anchor]
    : Array.from({ length: 7 }, (_, i) => anchor.startOf('week').add(i, 'day'));

  const deadlineCount = (events as any[]).filter(e => e.kind === 'WORK_ORDER_DEADLINE').length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexShrink: 0, gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={() => setAnchor(d => d.subtract(1, unit))}>
            <ChevronLeft />
          </IconButton>
          <Typography variant="h6" sx={{ minWidth: 240, textAlign: 'center', textTransform: 'capitalize' }}>
            {periodLabel}
          </Typography>
          <IconButton size="small" onClick={() => setAnchor(d => d.add(1, unit))}>
            <ChevronRight />
          </IconButton>
          <Button size="small" variant="outlined" onClick={() => setAnchor(today)}>Hoje</Button>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 1.5, mr: 1 }}>
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                <FiberManualRecord sx={{ fontSize: 10, color: cfg.color }} />
                <Typography variant="caption" color="text.secondary">{cfg.label}</Typography>
              </Box>
            ))}
          </Box>

          <FormControlLabel
            control={<Switch size="small" checked={showDeadlines} onChange={e => setShowDeadlines(e.target.checked)} />}
            label={
              <Typography variant="caption">
                Prazos das OS{deadlineCount > 0 && ` (${deadlineCount})`}
              </Typography>
            }
          />

          <ButtonGroup size="small">
            <Button variant={view === 'month' ? 'contained' : 'outlined'} onClick={() => setView('month')} startIcon={<CalendarViewMonth />}>
              Mês
            </Button>
            <Button variant={view === 'week' ? 'contained' : 'outlined'} onClick={() => setView('week')} startIcon={<ViewWeek />}>
              Semana
            </Button>
            <Button variant={view === 'day' ? 'contained' : 'outlined'} onClick={() => setView('day')} startIcon={<CalendarViewDay />}>
              Dia
            </Button>
            <Button variant={view === 'list' ? 'contained' : 'outlined'} onClick={() => setView('list')} startIcon={<ViewList />}>
              Lista
            </Button>
          </ButtonGroup>

          <Button variant="contained" startIcon={<Add />} onClick={() => openCreate(view === 'day' ? anchor : today)}>
            Agendar
          </Button>
        </Box>
      </Box>

      {view === 'month' && (
        <MonthView
          month={anchor}
          events={events as any[]}
          isLoading={isLoading}
          onCreate={openCreate}
          onOpen={openEvent}
          onOpenDay={openDay}
        />
      )}

      {(view === 'week' || view === 'day') && (
        <TimeGridView
          days={days}
          events={events as any[]}
          isLoading={isLoading}
          onCreate={openCreate}
          onOpen={openEvent}
        />
      )}

      {view === 'list' && (
        <ScheduleListView
          weekStart={anchor.startOf('week')}
          onEdit={openEvent}
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
