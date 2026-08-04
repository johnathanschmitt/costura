import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Alert, Typography, Box,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useToast } from '../../store/toast.store';
import { apiError, fmt } from './format';

type Props = {
  /** Pagamento a estornar; null fecha o diálogo. */
  payment: any | null;
  onClose: () => void;
};

/**
 * Estorno de uma baixa lançada errado.
 *
 * A linha não é apagada: fica marcada como estornada, com motivo e autor, e sai
 * de todas as somas. O valor volta ao saldo em aberto da conta e, se a baixa foi
 * em dinheiro, o caixa recebe o lançamento contrário.
 */
export default function ReversePaymentDialog({ payment, onClose }: Props) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const qc = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (payment) { setReason(''); setError(''); }
  }, [payment]);

  const mutation = useMutation({
    mutationFn: () => api.post(`/financial/payments/${payment.id}/reverse`, { reason }),
    onSuccess: () => {
      ['receivables', 'payables', 'cash-transactions', 'cash-register-current',
        'financial-summary', 'financial-overview', 'cash-flow', 'dre', 'monthly-result',
      ].forEach(key => qc.invalidateQueries({ queryKey: [key] }));
      toast('Baixa estornada');
      onClose();
    },
    onError: (e: any) => setError(apiError(e, 'Erro ao estornar a baixa')),
  });

  return (
    <Dialog open={Boolean(payment)} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Estornar baixa</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}

        {payment?.amount !== undefined && (
          <Box sx={{ bgcolor: 'background.default', p: 1.5, borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary">Valor da baixa</Typography>
            <Typography variant="h6" fontWeight={700}>{fmt(payment.amount)}</Typography>
          </Box>
        )}

        <Alert severity="info">
          A baixa não é apagada: fica registrada como estornada e sai das somas. O valor volta para
          o saldo em aberto da conta. Se foi em dinheiro, o caixa aberto recebe o lançamento
          contrário.
        </Alert>

        <TextField
          label="Motivo do estorno"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Ex.: recebi R$ 20 e lancei R$ 200"
          required
          autoFocus
          fullWidth
          multiline
          rows={2}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button
          variant="contained"
          color="warning"
          onClick={() => mutation.mutate()}
          disabled={!reason.trim() || mutation.isPending}
        >
          Estornar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
