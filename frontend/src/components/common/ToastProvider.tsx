import { Snackbar, Alert } from '@mui/material';
import { useToastStore } from '../../store/toast.store';

export default function ToastProvider() {
  const { open, message, severity, close } = useToastStore();
  return (
    <Snackbar
      open={open}
      autoHideDuration={4000}
      onClose={close}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert onClose={close} severity={severity} variant="filled" sx={{ minWidth: 280 }}>
        {message}
      </Alert>
    </Snackbar>
  );
}
