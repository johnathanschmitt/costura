import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Alert, Box, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useToast } from '../../store/toast.store';
import MoneyField from '../../components/common/fields/MoneyField';
import { METHODS } from '../../components/common/PaymentDialog';
import { apiError, fmt } from './constants';

interface Props {
  workOrder: any | null;
  onClose: () => void;
  onPaid?: () => void;
}

export default function PaymentDialog({ workOrder, onClose, onPaid }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState('PIX');
  const [tendered, setTendered] = useState<number | null>(null);
  const [error, setError] = useState('');

  const balance = Number(workOrder?.financials?.balance ?? 0);

  const mutation = useMutation({
    mutationFn: () => api.post(`/work-orders/${workOrder.id}/payment`, {
      amount: amount,
      method,
      amountTendered: tendered || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-order', workOrder.id] });
      qc.invalidateQueries({ queryKey: ['receivables'] });
      qc.invalidateQueries({ queryKey: ['financial'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast('Pagamento registrado', 'success');
      onPaid?.();
      onClose();
    },
    onError: (e: any) => setError(apiError(e, 'Erro ao registrar pagamento')),
  });

  return (
    <Dialog open={Boolean(workOrder)} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Registrar pagamento: {workOrder?.number}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
        
        <Box sx={{ bgcolor: 'background.default', p: 1.5, borderRadius: 2 }}>
           <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Box>Saldo em aberto</Box>
              <Box fontWeight={700}>{fmt(balance)}</Box>
           </Box>
        </Box>

        <MoneyField
          label="Valor recebido"
          value={amount}
          onChange={setAmount}
          error={amount !== null && amount > balance}
          helperText={amount !== null && amount > balance ? `Não pode passar do saldo de ${fmt(balance)}` : ''}
          fullWidth
          autoFocus
        />
        <FormControl fullWidth>
          <InputLabel>Forma de pagamento</InputLabel>
          <Select value={method} label="Forma de pagamento" onChange={e => setMethod(e.target.value)}>
            {METHODS.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
          </Select>
        </FormControl>
        {method === 'CASH' && (
           <MoneyField
            label="Valor entregue pela cliente"
            value={tendered}
            onChange={setTendered}
            fullWidth
           />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() => mutation.mutate()}
          disabled={!amount || amount > balance || mutation.isPending}
        >
          Registrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
