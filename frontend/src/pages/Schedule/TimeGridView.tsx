import { Box, Typography, Chip, Tooltip, Paper, CircularProgress, useTheme, alpha } from '@mui/material';
import dayjs, { Dayjs } from 'dayjs';
import { TYPE_CONFIG } from './ScheduleFormDialog';

// Grade: 7h às 21h
export const START_HOUR = 7;
export const END_HOUR = 21;
export const TOTAL_HOURS = END_HOUR - START_HOUR;
export const HOUR_HEIGHT = 64;
const TIME_COL_WIDTH = 52;

const STATUS_ALPHA: Record<string, number> = {
  SCHEDULED: 0.85, CONFIRMED: 1, DONE: 0.5, CANCELLED: 0.3, NO_SHOW: 0.3,
};

function timeToY(time: Dayjs) {
  return (time.hour() - START_HOUR + time.minute() / 60) * HOUR_HEIGHT;
}

function durationToH(start: Dayjs, end: Dayjs) {
  return Math.max((end.diff(start, 'minute') / 60) * HOUR_HEIGHT, 30);
}

function AppointmentBlock({ schedule, onClick }: { schedule: any; onClick: (e: React.MouseEvent) => void }) {
  const theme = useTheme();
  const start = dayjs(schedule.startAt);
  const end = dayjs(schedule.endAt);
  const cfg = TYPE_CONFIG[schedule.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.OTHER;
  const opacity = STATUS_ALPHA[schedule.status] ?? 0.85;
  const isDeadline = schedule.kind === 'WORK_ORDER_DEADLINE';

  // Prazo de OS é marco do dia, não compromisso com hora: fica fixo no topo.
  const top = isDeadline ? 0 : timeToY(start);
  const height = schedule.allDay ? 28 : durationToH(start, end);

  return (
    <Tooltip
      title={
        <Box>
          <Typography variant="caption" fontWeight={700}>{schedule.title}</Typography>
          {schedule.customer && (
            <Typography variant="caption" display="block">{schedule.customer.name}</Typography>
          )}
          {!schedule.allDay && (
            <Typography variant="caption" display="block">
              {start.format('HH:mm')} – {end.format('HH:mm')}
            </Typography>
          )}
        </Box>
      }
    >
      <Box
        onClick={onClick}
        sx={{
          position: 'absolute',
          top,
          left: 2,
          right: 2,
          height,
          borderRadius: 1,
          px: 0.75,
          py: 0.25,
          overflow: 'hidden',
          cursor: 'pointer',
          zIndex: 1,
          bgcolor: alpha(cfg.color, isDeadline ? 0.15 : opacity * 0.9),
          color: isDeadline ? cfg.color : theme.palette.getContrastText(cfg.color),
          border: isDeadline ? `1px dashed ${cfg.color}` : 'none',
          fontSize: 11,
          lineHeight: 1.25,
          '&:hover': { filter: 'brightness(1.08)' },
        }}
      >
        <Typography variant="caption" fontWeight={600} noWrap display="block" sx={{ fontSize: 11 }}>
          {!schedule.allDay && `${start.format('HH:mm')} `}{schedule.title}
        </Typography>
        {schedule.customer && height > 40 && (
          <Typography variant="caption" noWrap display="block" sx={{ fontSize: 10, opacity: 0.9 }}>
            {schedule.customer.name}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
}

interface Props {
  days: Dayjs[];
  events: any[];
  isLoading?: boolean;
  onCreate: (date: Dayjs, hour?: number) => void;
  onOpen: (event: any) => void;
}

/** Grade de horários. Serve a semana (7 dias) e o dia (1 dia). */
export default function TimeGridView({ days, events, isLoading, onCreate, onOpen }: Props) {
  const theme = useTheme();
  const today = dayjs();
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);

  const forDay = (day: Dayjs) => events.filter(s => dayjs(s.startAt).isSame(day, 'day'));

  const handleGridClick = (day: Dayjs, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const hour = Math.floor((e.clientY - rect.top) / HOUR_HEIGHT) + START_HOUR;
    onCreate(day, Math.min(hour, END_HOUR - 1));
  };

  return (
    <Paper variant="outlined" sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Box sx={{ width: TIME_COL_WIDTH, flexShrink: 0 }} />
        {days.map(day => {
          const isToday = day.isSame(today, 'day');
          const count = forDay(day).length;
          return (
            <Box
              key={day.format('YYYY-MM-DD')}
              onClick={() => onCreate(day)}
              sx={{
                flex: 1, py: 1, textAlign: 'center', cursor: 'pointer',
                bgcolor: isToday ? alpha(theme.palette.primary.main, 0.06) : undefined,
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                borderLeft: 1, borderColor: 'divider',
              }}
            >
              <Typography
                variant="caption"
                color={isToday ? 'primary' : 'text.secondary'}
                fontWeight={600}
                display="block"
                textTransform="uppercase"
              >
                {days.length === 1 ? day.format('dddd') : day.format('ddd')}
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

      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}><CircularProgress /></Box>
        ) : (
          <Box sx={{ display: 'flex', height: TOTAL_HOURS * HOUR_HEIGHT }}>
            <Box sx={{ width: TIME_COL_WIDTH, flexShrink: 0, position: 'relative' }}>
              {hours.map(h => (
                <Box key={h} sx={{ position: 'absolute', top: (h - START_HOUR) * HOUR_HEIGHT - 8, left: 0, right: 0, textAlign: 'right', pr: 1 }}>
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11 }}>{h}:00</Typography>
                </Box>
              ))}
            </Box>

            {days.map(day => {
              const isToday = day.isSame(today, 'day');
              const daySchedules = forDay(day);
              const nowY = isToday ? (today.hour() - START_HOUR + today.minute() / 60) * HOUR_HEIGHT : null;

              return (
                <Box
                  key={day.format('YYYY-MM-DD')}
                  onClick={e => handleGridClick(day, e)}
                  sx={{
                    flex: 1, position: 'relative', borderLeft: 1, borderColor: 'divider',
                    bgcolor: isToday ? alpha(theme.palette.primary.main, 0.02) : undefined,
                    cursor: 'crosshair',
                    '&:hover': { bgcolor: isToday ? alpha(theme.palette.primary.main, 0.04) : alpha('#000', 0.01) },
                  }}
                >
                  {hours.map(h => (
                    <Box key={h} sx={{ position: 'absolute', top: (h - START_HOUR) * HOUR_HEIGHT, left: 0, right: 0, borderTop: 1, borderColor: 'divider' }} />
                  ))}

                  {nowY !== null && nowY >= 0 && nowY <= TOTAL_HOURS * HOUR_HEIGHT && (
                    <Box sx={{
                      position: 'absolute', top: nowY, left: 0, right: 0, height: 2,
                      bgcolor: 'error.main', zIndex: 2,
                      '&::before': {
                        content: '""', position: 'absolute', left: -4, top: -4,
                        width: 10, height: 10, borderRadius: '50%', bgcolor: 'error.main',
                      },
                    }} />
                  )}

                  {daySchedules.map(s => (
                    <AppointmentBlock
                      key={s.id}
                      schedule={s}
                      onClick={e => { e.stopPropagation(); onOpen(s); }}
                    />
                  ))}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Paper>
  );
}
