import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Alert, Box, Typography, Divider, FormControl, InputLabel, Select, MenuItem,
  FormControlLabel, Switch,
} from '@mui/material';
import MoneyField from '../../components/common/fields/MoneyField';
import { Assignment } from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useToast } from '../../store/toast.store';

const METHODS = [
  { value: 'PIX', label: 'Pix' },
  { value: 'CASH', label: 'Dinheiro' },
  { value: 'CREDIT_CARD', label: 'Cartão de Crédito' },
  { value: 'DEBIT_CARD', label: 'Cartão de Débito' },
  { value: 'TRANSFER', label: 'Transferência' },
  { value: 'CHECK', label: 'Cheque' },
];

const fmt = (v: unknown) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v ?? 0));

const apiError = (e: any, fallback: string) => {
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m.join('. ') : m ?? fallback;
};

interface Props {
  quote: any | null;
  onClose: () => void;
}

export default function ConvertDialog({ quote, onClose }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [withDownPayment, setWithDownPayment] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState('PIX');
  const [balanceDueInDays, setBalanceDueInDays] = useState('30');
  const [error, setError] = useState('');

  const open = Boolean(quote);
  const total = Number(quote?.total ?? 0);

  useEffect(() => {
    if (open) {
      setWithDownPayment(false);
      // Metade do valor é o sinal mais comum; fica como sugestão editável.
      setAmount(Number((total / 2).toFixed(2)));
      setMethod('PIX');
      setBalanceDueInDays('30');
      setError('');
    }
  }, [open, total]);

  const mutation = useMutation({
    mutationFn: () => api.post(`/quotes/${quote.id}/convert`, {
      downPayment: withDownPayment && amount ? { amount, method } : undefined,
      balanceDueInDays: parseInt(balanceDueInDays) || 30,
    }),
    onSuccess: res => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['work-orders'] });
      qc.invalidateQueries({ queryKey: ['receivables'] });
      toast(`OS ${res.data.number} criada`);
      onClose();
      navigate(`/work-orders/${res.data.id}/edit`);
    },
    onError: (e: any) => setError(apiError(e, 'Erro ao converter o orçamento')),
  });

  const signal = amount ?? NaN;
  const validSignal = !withDownPayment || (signal > 0 && signal <= total + 0.005);
  const balance = withDownPayment && signal > 0 ? total - signal : total;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Aprovar e criar OS — {quote?.number}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}

        <Box sx={{ bgcolor: 'background.default', p: 1.5, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">Total do orçamento</Typography>
          <Typography variant="h5" fontWeight={700}>{fmt(total)}</Typography>
          <Typography variant="caption" color="text.secondary">{quote?.customer?.name}</Typography>
        </Box>

        <FormControlLabel
          control={<Switch checked={withDownPayment} onChange={e => setWithDownPayment(e.target.checked)} />}
          label="A cliente está pagando um sinal agora"
        />

        {withDownPayment && (
          <>
            <MoneyField
              label="Valor do sinal"
              value={amount}
              onChange={setAmount}
              error={!validSignal}
              helperText={!validSignal ? `O sinal não pode passar de ${fmt(total)}` : ' '}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Forma de pagamento</InputLabel>
              <Select value={method} label="Forma de pagamento" onChange={e => setMethod(e.target.value)}>
                {METHODS.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
              </Select>
            </FormControl>
            {method === 'CASH' && (
              <Alert severity="info">
                Em dinheiro, o sinal entra no caixa — é preciso ter um caixa aberto.
              </Alert>
            )}
          </>
        )}

        <TextField
          label="Vencimento do saldo (dias)"
          type="number"
          value={balanceDueInDays}
          onChange={e => setBalanceDueInDays(e.target.value)}
          inputProps={{ min: 0, max: 365 }}
          fullWidth
        />

        <Divider />
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">Sinal recebido agora</Typography>
            <Typography variant="body2" color="success.main">
              {withDownPayment && signal > 0 ? fmt(signal) : fmt(0)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" fontWeight={700}>Saldo a receber</Typography>
            <Typography variant="body2" fontWeight={700}>{fmt(balance)}</Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button
          variant="contained"
          startIcon={<Assignment />}
          onClick={() => mutation.mutate()}
          disabled={!validSignal || mutation.isPending}
        >
          Aprovar e criar OS
        </Button>
      </DialogActions>
    </Dialog>
  );
}
