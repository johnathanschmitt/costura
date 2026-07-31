import { Box, Typography, CircularProgress } from '@mui/material';
import { CheckCircle, Error, CloudDone } from '@mui/icons-material';

type Status = 'idle' | 'saving' | 'saved' | 'error';

const MESSAGES: Record<Status, string> = {
  idle: '',
  saving: 'Salvando…',
  saved: 'Salvo automaticamente',
  error: 'Erro ao salvar',
};

export default function AutosaveIndicator({ status }: { status: Status }) {
  if (status === 'idle') return null;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: status === 'error' ? 'error.main' : 'text.secondary' }}>
      {status === 'saving' && <CircularProgress size={14} />}
      {status === 'saved' && <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />}
      {status === 'error' && <Error sx={{ fontSize: 16 }} />}
      <Typography variant="caption">{MESSAGES[status]}</Typography>
    </Box>
  );
}
