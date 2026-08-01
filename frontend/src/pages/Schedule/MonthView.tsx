import { Box, Typography, Paper, CircularProgress, Tooltip, useTheme, alpha } from '@mui/material';
import dayjs, { Dayjs } from 'dayjs';
import { TYPE_CONFIG } from './ScheduleFormDialog';

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MAX_VISIBLE = 3;

interface Props {
  month: Dayjs;
  events: any[];
  isLoading?: boolean;
  onCreate: (date: Dayjs) => void;
  onOpen: (event: any) => void;
  onOpenDay: (date: Dayjs) => void;
}

export default function MonthView({ month, events, isLoading, onCreate, onOpen, onOpenDay }: Props) {
  const theme = useTheme();
  const today = dayjs();

  // A grade sempre começa no domingo da semana em que o mês cai e cobre 6
  // semanas, para não mudar de altura ao trocar de mês.
  const gridStart = month.startOf('month').startOf('week');
  const cells = Array.from({ length: 42 }, (_, i) => gridStart.add(i, 'day'));

  const forDay = (day: Dayjs) =>
    events.filter(s => dayjs(s.startAt).isSame(day, 'day'))
      .sort((a, b) => dayjs(a.startAt).valueOf() - dayjs(b.startAt).valueOf());

  if (isLoading) {
    return (
      <Paper variant="outlined" sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress />
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider' }}>
        {WEEKDAYS.map(d => (
          <Box key={d} sx={{ flex: 1, py: 0.75, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">
              {d}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ flexGrow: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'repeat(6, 1fr)', overflow: 'auto' }}>
        {cells.map(day => {
          const isToday = day.isSame(today, 'day');
          const inMonth = day.isSame(month, 'month');
          const dayEvents = forDay(day);
          const hidden = dayEvents.length - MAX_VISIBLE;

          return (
            <Box
              key={day.format('YYYY-MM-DD')}
              onClick={() => onCreate(day)}
              sx={{
                borderRight: 1, borderBottom: 1, borderColor: 'divider',
                p: 0.5, minHeight: 92, cursor: 'pointer', overflow: 'hidden',
                bgcolor: !inMonth
                  ? alpha(theme.palette.text.disabled, 0.04)
                  : isToday ? alpha(theme.palette.primary.main, 0.06) : undefined,
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography
                  variant="caption"
                  fontWeight={isToday ? 700 : 400}
                  color={isToday ? 'primary' : inMonth ? 'text.primary' : 'text.disabled'}
                  sx={isToday ? {
                    bgcolor: 'primary.main', color: 'white', borderRadius: '50%',
                    width: 20, height: 20, display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center',
                  } : undefined}
                >
                  {day.format('D')}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mt: 0.25 }}>
                {dayEvents.slice(0, MAX_VISIBLE).map(s => {
                  const cfg = TYPE_CONFIG[s.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.OTHER;
                  const isDeadline = s.kind === 'WORK_ORDER_DEADLINE';
                  return (
                    <Tooltip key={s.id} title={`${s.title}${s.customer ? ` — ${s.customer.name}` : ''}`}>
                      <Box
                        onClick={e => { e.stopPropagation(); onOpen(s); }}
                        sx={{
                          bgcolor: alpha(cfg.color, isDeadline ? 0.12 : 0.85),
                          color: isDeadline ? cfg.color : theme.palette.getContrastText(cfg.color),
                          border: isDeadline ? `1px dashed ${cfg.color}` : 'none',
                          borderRadius: 0.5, px: 0.5,
                          fontSize: 10, lineHeight: 1.5,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          '&:hover': { filter: 'brightness(1.1)' },
                        }}
                      >
                        {!s.allDay && `${dayjs(s.startAt).format('HH:mm')} `}{s.title}
                      </Box>
                    </Tooltip>
                  );
                })}
                {hidden > 0 && (
                  <Typography
                    variant="caption"
                    color="primary"
                    sx={{ fontSize: 10, pl: 0.5, '&:hover': { textDecoration: 'underline' } }}
                    onClick={e => { e.stopPropagation(); onOpenDay(day); }}
                  >
                    +{hidden} mais
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}
