import { Box, IconButton, Typography, Button, FormControlLabel, Switch, Tooltip } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import dayjs, { Dayjs } from 'dayjs';

type Props = {
  /** Mês exibido, no formato AAAA-MM. */
  month: string;
  onChange: (month: string) => void;
  includeOverdue: boolean;
  onIncludeOverdueChange: (value: boolean) => void;
};

export const monthRange = (month: string) => ({
  startDate: dayjs(`${month}-01`).startOf('month').toISOString(),
  endDate: dayjs(`${month}-01`).endOf('month').toISOString(),
});

/**
 * Navegação por mês das listas de contas.
 *
 * O mês é o recorte natural de quem cobra e de quem paga — a lista inteira, com
 * tudo que já venceu e tudo que ainda vai vencer, não se lê.
 *
 * O interruptor dos vencidos existe porque o recorte tem um risco: uma conta que
 * venceu em junho não aparece em agosto, e some justamente a que precisa de
 * atenção. Por isso ela vem junto por padrão, marcada como de outro mês.
 */
export default function MonthNavigator({
  month, onChange, includeOverdue, onIncludeOverdueChange,
}: Props) {
  const current = dayjs().format('YYYY-MM');
  const shift = (delta: number) =>
    onChange(dayjs(`${month}-01`).add(delta, 'month').format('YYYY-MM'));

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <IconButton size="small" onClick={() => shift(-1)}><ChevronLeft /></IconButton>
      <Typography
        variant="subtitle1"
        fontWeight={600}
        sx={{ minWidth: 190, textAlign: 'center', textTransform: 'capitalize' }}
      >
        {dayjs(`${month}-01`).format('MMMM [de] YYYY')}
      </Typography>
      <IconButton size="small" onClick={() => shift(1)}><ChevronRight /></IconButton>

      {month !== current && (
        <Button size="small" onClick={() => onChange(current)}>Mês atual</Button>
      )}

      <Box sx={{ flexGrow: 1 }} />

      <Tooltip title="Contas que venceram antes deste mês e continuam em aberto">
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={includeOverdue}
              onChange={e => onIncludeOverdueChange(e.target.checked)}
            />
          }
          label={<Typography variant="body2">Trazer vencidos de meses anteriores</Typography>}
        />
      </Tooltip>
    </Box>
  );
}

/** Mês de referência de uma conta, para marcar o que veio de fora do período. */
export const isFromAnotherMonth = (dueDate: string, month: string) =>
  !dayjs(dueDate).isSame(dayjs(`${month}-01`), 'month');

export const monthOf = (date: Dayjs = dayjs()) => date.format('YYYY-MM');
