import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Alert, Box, Typography, CircularProgress, Divider, FormControl, InputLabel,
  Select, MenuItem, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { LocalShipping } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useToast } from '../../store/toast.store';
import MoneyField from '../../components/common/fields/MoneyField';
import { METHODS } from '../../components/common/PaymentDialog';
import { receiptLink } from '../Financial/receiptMessage';
import { apiError, fmt } from './constants';

interface Props {
  workOrder: any | null;
  onClose: () => void;
  onDelivered?: () => void;
}

/**
 * Entrega e recebimento no mesmo diálogo. Este é o momento em que o dinheiro
 * troca de mão — a cliente está no balcão com a peça —, e mandar procurar a
 * conta em outro módulo era o que fazia a baixa ficar para depois.
 */
export default function DeliverDialog({ workOrder, onClose, onDelivered }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [receivedBy, setReceivedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<'receive' | 'credit'>('receive');
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState('PIX');
  const [tendered, setTendered] = useState<number | null>(null);
  const [error, setError] = useState('');

  const open = Boolean(workOrder);

  // O saldo devedor real vem do detalhe da OS — o card do quadro não o carrega.
  const { data: detail, isLoading } = useQuery({
    queryKey: ['work-order', workOrder?.id],
    queryFn: () => api.get(`/work-orders/${workOrder.id}`).then(r => r.data),
    enabled: open,
  });

  const balance = Number(detail?.financials?.balance ?? 0);
  const hasDebt = balance > 0.005;

  useEffect(() => {
    if (open) {
      setReceivedBy(workOrder?.customer?.name ?? '');
      setNotes('');
      setMode('receive');
      setMethod('PIX');
      setTendered(null);
      setError('');
    }
  }, [open, workOrder]);

  // Quitar por inteiro é o caso comum: o campo já vem com o saldo.
  useEffect(() => {
    if (open && hasDebt) setAmount(balance);
  }, [open, hasDebt, balance]);

  const receiving = hasDebt && mode === 'receive';
  const value = amount ?? NaN;
  const validAmount = !Number.isNaN(value) && value > 0;
  const exceeds = receiving && validAmount && value > balance + 0.005;
  const leftOver = receiving && validAmount && !exceeds ? balance - value : hasDebt ? balance : 0;
  const partial = receiving && leftOver > 0.005;

  // Troco só existe em dinheiro, e só quando o valor entregue cobre a baixa.
  const tenderedValue = tendered ?? NaN;
  const hasTendered = receiving && method === 'CASH' && !Number.isNaN(tenderedValue) && tenderedValue > 0;
  const tenderedShort = hasTendered && validAmount && tenderedValue < value - 0.005;
  const change = hasTendered && validAmount && !tenderedShort ? tenderedValue - value : null;

  const mutation = useMutation({
    mutationFn: () => api.post(`/work-orders/${workOrder.id}/deliver`, {
      receivedBy: receivedBy || undefined,
      notes: notes || undefined,
      // A peça sai com saldo em aberto tanto no fiado quanto na baixa parcial —
      // nos dois casos o botão já disse, em letras, quanto fica devendo.
      acknowledgeDebt: hasDebt && (mode === 'credit' || partial) ? true : undefined,
      payment: receiving
        ? {
          amount: value,
          method,
          amountTendered: hasTendered ? tenderedValue : undefined,
        }
        : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-orders'] });
      qc.invalidateQueries({ queryKey: ['work-orders-board'] });
      qc.invalidateQueries({ queryKey: ['work-order', workOrder.id] });
      qc.invalidateQueries({ queryKey: ['receivables'] });
      qc.invalidateQueries({ queryKey: ['financial'] });

      // Recebeu no balcão: o recibo vai por mensagem antes de a cliente sair.
      const receipt = receiving && receiptLink({
        phone: detail?.customer?.phone,
        name: detail?.customer?.name,
        amount: value,
        description: `${workOrder.number} — ${detail?.garment?.name ?? 'peça'}`,
        method,
      });

      // Nem toda entrega precisa de papel: o recibo impresso fica a um clique,
      // em vez de a tela pular para ele e abrir a janela de impressão sozinha.
      const id = workOrder.id;
      toast(
        receiving ? `Recebido ${fmt(value)} e entrega registrada` : 'Entrega registrada',
        'success',
        [
          receipt ? { label: 'Mandar recibo', onClick: () => window.open(receipt, '_blank', 'noopener') } : undefined,
          { label: 'Imprimir', onClick: () => navigate(`/work-orders/${id}/receipt`) },
        ].filter(Boolean) as any,
      );
      onDelivered?.();
      onClose();
    },
    onError: (e: any) => setError(apiError(e, 'Erro ao registrar a entrega')),
  });

  const methodLabel = METHODS.find(m => m.value === method)?.label ?? method;

  // O botão é a última coisa lida antes da ação: a frase inteira mora aqui.
  const actionLabel = !hasDebt
    ? 'Registrar entrega'
    : mode === 'credit'
      ? `Entregar com ${fmt(balance)} em aberto`
      : partial
        ? `Receber ${fmt(value)} e entregar com ${fmt(leftOver)} em aberto`
        : `Receber ${fmt(value)} no ${methodLabel} e entregar`;

  const blocked = receiving && (!validAmount || exceeds || tenderedShort);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Entregar {workOrder?.number}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} /></Box>
        ) : (
          <>
            <Box sx={{ bgcolor: 'background.default', p: 1.5, borderRadius: 2 }}>
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
                <Typography variant="body2" fontWeight={700}>Saldo em aberto</Typography>
                <Typography variant="body2" fontWeight={700} color={hasDebt ? 'error.main' : 'success.main'}>
                  {fmt(balance)}
                </Typography>
              </Box>
            </Box>

            {hasDebt && (
              <>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  size="small"
                  value={mode}
                  onChange={(_, v) => v && setMode(v)}
                >
                  <ToggleButton value="receive">Receber agora</ToggleButton>
                  <ToggleButton value="credit">Entregar fiado</ToggleButton>
                </ToggleButtonGroup>

                {receiving ? (
                  <>
                    <MoneyField
                      label="Valor recebido"
                      value={amount}
                      onChange={setAmount}
                      error={exceeds}
                      helperText={
                        exceeds
                          ? `Não pode passar do saldo em aberto de ${fmt(balance)}`
                          : partial
                            ? `Fica ${fmt(leftOver)} em aberto`
                            : ' '
                      }
                      autoFocus
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
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    A peça sai e {fmt(balance)} continuam em aberto na conta da cliente.
                  </Typography>
                )}
              </>
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
          {actionLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
