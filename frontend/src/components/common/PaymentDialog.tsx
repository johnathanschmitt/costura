import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, FormControl, InputLabel, Select, MenuItem, Typography, Box,
} from '@mui/material';

const METHODS = [
  { value: 'PIX', label: 'Pix' },
  { value: 'CASH', label: 'Dinheiro' },
  { value: 'CREDIT_CARD', label: 'Cartão de Crédito' },
  { value: 'DEBIT_CARD', label: 'Cartão de Débito' },
  { value: 'TRANSFER', label: 'Transferência' },
  { value: 'CHECK', label: 'Cheque' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (amount: number, method: string) => void;
  title: string;
  maxAmount?: number;
  loading?: boolean;
}

export default function PaymentDialog({ open, onClose, onConfirm, title, maxAmount, loading }: Props) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('PIX');

  const fmt = (n: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

  const handleConfirm = () => {
    const value = parseFloat(amount.replace(',', '.'));
    if (!value || value <= 0) return;
    onConfirm(value, method);
    setAmount('');
    setMethod('PIX');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {maxAmount !== undefined && (
          <Box sx={{ bgcolor: 'background.default', p: 1.5, borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary">Valor total</Typography>
            <Typography variant="h6" fontWeight={700}>{fmt(maxAmount)}</Typography>
          </Box>
        )}
        <TextField
          label="Valor recebido (R$)"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          type="number"
          inputProps={{ min: 0.01, step: 0.01 }}
          autoFocus
          fullWidth
        />
        <FormControl fullWidth>
          <InputLabel>Forma de pagamento</InputLabel>
          <Select value={method} label="Forma de pagamento" onChange={e => setMethod(e.target.value)}>
            {METHODS.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          color="success"
          onClick={handleConfirm}
          loading={loading}
          disabled={!amount || parseFloat(amount) <= 0}
        >
          Confirmar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
