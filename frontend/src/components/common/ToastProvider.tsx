import { Snackbar, Alert, Button } from '@mui/material';
import { useToastStore } from '../../store/toast.store';

export default function ToastProvider() {
  const { open, message, severity, actions, close } = useToastStore();

  // Com desfazer à mão o aviso fica mais tempo na tela: quatro segundos é
  // pouco para ler a frase, perceber o erro e decidir voltar atrás.
  const duration = actions.length ? 10_000 : 4000;

  return (
    <Snackbar
      open={open}
      autoHideDuration={duration}
      onClose={close}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        onClose={close}
        severity={severity}
        variant="filled"
        sx={{ minWidth: 280, alignItems: 'center' }}
        action={actions.length > 0 && (
          <>
            {actions.map(a => (
              <Button
                key={a.label}
                size="small"
                color="inherit"
                sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                onClick={() => { a.onClick(); close(); }}
              >
                {a.label}
              </Button>
            ))}
          </>
        )}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
