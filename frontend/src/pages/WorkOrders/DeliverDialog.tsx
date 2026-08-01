import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Alert, Box, Typography, Checkbox, FormControlLabel, CircularProgress, Divider,
} from '@mui/material';
import { LocalShipping, Print } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useToast } from '../../store/toast.store';
import { apiError, fmt } from './constants';

interface Props {
  workOrder: any | null;
  onClose: () => void;
  onDelivered?: () => void;
}

export default function DeliverDialog({ workOrder, onClose, onDelivered }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [receivedBy, setReceivedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [acknowledgeDebt, setAcknowledgeDebt] = useState(false);
  const [error, setError] = useState('');

  const open = Boolean(workOrder);

  // O saldo devedor real vem do detalhe da OS — o card do quadro não o carrega.
  const { data: detail, isLoading } = useQuery({
    queryKey: ['work-order', workOrder?.id],
    queryFn: () => api.get(`/work-orders/${workOrder.id}`).then(r => r.data),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setReceivedBy(workOrder?.customer?.name ?? '');
      setNotes('');
      setAcknowledgeDebt(false);
      setError('');
    }
  }, [open, workOrder]);

  const mutation = useMutation({
    mutationFn: () => api.post(`/work-orders/${workOrder.id}/deliver`, {
      receivedBy: receivedBy || undefined,
      notes: notes || undefined,
      acknowledgeDebt: acknowledgeDebt || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-orders'] });
      qc.invalidateQueries({ queryKey: ['work-orders-board'] });
      qc.invalidateQueries({ queryKey: ['work-order', workOrder.id] });
      qc.invalidateQueries({ queryKey: ['receivables'] });
      toast('Entrega registrada');
      onDelivered?.();
      const id = workOrder.id;
      onClose();
      navigate(`/work-orders/${id}/receipt`);
    },
    onError: (e: any) => setError(apiError(e, 'Erro ao registrar a entrega')),
  });

  const balance = Number(detail?.financials?.balance ?? 0);
  const hasDebt = balance > 0.005;
  const blocked = hasDebt && !acknowledgeDebt;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Registrar Entrega — {workOrder?.number}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} /></Box>
        ) : (
          <>
            <Box sx={{ bgcolor: 'background.default', p: 1.5, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary">Cliente</Typography>
              <Typography variant="body1" fontWeight={600}>{detail?.customer?.name}</Typography>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Total da OS</Typography>
                <Typography variant="body2">{fmt(detail?.financials?.total)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Já pago</Typography>
                <Typography variant="body2" color="success.main">{fmt(detail?.financials?.paid)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                <Typography variant="body2" fontWeight={700}>Saldo devedor</Typography>
                <Typography variant="body2" fontWeight={700} color={hasDebt ? 'error.main' : 'success.main'}>
                  {fmt(balance)}
                </Typography>
              </Box>
            </Box>

            {hasDebt && (
              <Alert severity="warning">
                A cliente ainda deve <strong>{fmt(balance)}</strong>. Receba o valor em
                Financeiro → Contas a Receber, ou confirme abaixo que a peça sai com saldo em aberto.
              </Alert>
            )}

            <TextField
              label="Quem retirou a peça"
              value={receivedBy}
              onChange={e => setReceivedBy(e.target.value)}
              fullWidth
            />
            <TextField
              label="Observações da entrega"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />

            {hasDebt && (
              <FormControlLabel
                control={<Checkbox checked={acknowledgeDebt} onChange={e => setAcknowledgeDebt(e.target.checked)} />}
                label={`Entregar mesmo com ${fmt(balance)} em aberto`}
              />
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button
          variant="contained"
          startIcon={<LocalShipping />}
          onClick={() => mutation.mutate()}
          disabled={isLoading || blocked || mutation.isPending}
        >
          Registrar Entrega
        </Button>
      </DialogActions>
    </Dialog>
  );
}
