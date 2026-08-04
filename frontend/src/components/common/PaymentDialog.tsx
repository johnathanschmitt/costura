import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, FormControl, InputLabel, Select, MenuItem, Typography, Box, Alert,
} from '@mui/material';
import MoneyField from './fields/MoneyField';

export const METHODS = [
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
  onConfirm: (amount: number, method: string, amountTendered?: number) => void;
  title: string;
  /** Saldo em aberto — a baixa não pode excedê-lo. */
  maxAmount?: number;
  loading?: boolean;
  error?: string;
  confirmColor?: 'success' | 'error' | 'primary';
  amountLabel?: string;
  /**
   * Verbo do botão. O botão é a última coisa lida antes da ação, e é ali que a
   * frase precisa estar inteira — "Receber R$ 480,00 no Pix" diz o que vai
   * acontecer; "Confirmar" obriga a lembrar o que estava sendo confirmado.
   */
  verb?: string;
  /**
   * Valor fechado, sem edição. Serve para a baixa que é sempre integral — o
   * ressarcimento de uma sócia paga todas as notas dela de uma vez, e um campo
   * editável ali prometeria um pagamento parcial que não vai acontecer.
   */
  lockAmount?: boolean;
}

export default function PaymentDialog({
  open, onClose, onConfirm, title, maxAmount, loading, error,
  confirmColor = 'success', amountLabel = 'Valor recebido (R$)', verb = 'Receber',
  lockAmount = false,
}: Props) {
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState('PIX');
  const [tendered, setTendered] = useState<number | null>(null);

  // Pré-preenche com o saldo em aberto: quitar por inteiro é o caso comum.
  useEffect(() => {
    if (open) {
      setAmount(maxAmount ?? null);
      setMethod('PIX');
      setTendered(null);
    }
  }, [open, maxAmount]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

  const value = amount ?? NaN;
  const valid = !Number.isNaN(value) && value > 0;
  const exceeds = valid && maxAmount !== undefined && value > maxAmount + 0.005;
  const partial = valid && !exceeds && maxAmount !== undefined && value < maxAmount - 0.005;

  // Troco só existe em dinheiro, e só quando o valor entregue cobre a baixa.
  const tenderedValue = tendered ?? NaN;
  const hasTendered = method === 'CASH' && !Number.isNaN(tenderedValue) && tenderedValue > 0;
  const tenderedShort = hasTendered && valid && tenderedValue < value - 0.005;
  const change = hasTendered && valid && !tenderedShort ? tenderedValue - value : null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
        {maxAmount !== undefined && (
          <Box sx={{ bgcolor: 'background.default', p: 1.5, borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary">Saldo em aberto</Typography>
            <Typography variant="h6" fontWeight={700}>{fmt(maxAmount)}</Typography>
          </Box>
        )}
        <MoneyField
          label={amountLabel}
          value={amount}
          onChange={setAmount}
          disabled={lockAmount}
          error={exceeds}
          helperText={
            lockAmount
              ? 'Valor fechado — a baixa é sempre integral'
              : exceeds
                ? `Não pode passar do saldo em aberto de ${fmt(maxAmount!)}`
                : partial
                  ? `Baixa parcial — restam ${fmt(maxAmount! - value)}`
                  : ' '
          }
          autoFocus={!lockAmount}
          fullWidth
        />
        <FormControl fullWidth>
          <InputLabel>Forma de pagamento</InputLabel>
          <Select value={method} label="Forma de pagamento" onChange={e => setMethod(e.target.value)}>
            {METHODS.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
          </Select>
        </FormControl>
        {method === 'CASH' && (
          <>
            <MoneyField
              label="Valor entregue pela cliente"
              value={tendered}
              onChange={setTendered}
              error={tenderedShort}
              helperText={
                tenderedShort
                  ? `Menor que a baixa de ${fmt(value)}`
                  : 'Opcional — preencha para calcular o troco'
              }
              fullWidth
            />
            {change !== null && (
              <Box sx={{ bgcolor: 'success.light', color: 'success.contrastText', p: 1.5, borderRadius: 2 }}>
                <Typography variant="caption">Troco a devolver</Typography>
                <Typography variant="h5" fontWeight={700}>{fmt(change)}</Typography>
              </Box>
            )}
            <Alert severity="info">
              Em dinheiro, o valor entra no caixa da gaveta — é preciso ter um caixa aberto.
            </Alert>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button
          variant="contained"
          color={confirmColor}
          onClick={() => onConfirm(value, method, hasTendered ? tenderedValue : undefined)}
          disabled={!valid || exceeds || tenderedShort || loading}
        >
          {valid && !exceeds
            ? `${verb} ${fmt(value)} no ${METHODS.find(m => m.value === method)?.label ?? method}`
            : verb}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
