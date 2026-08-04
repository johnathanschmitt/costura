import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Alert,
  Typography, Box, FormControlLabel, Checkbox, RadioGroup, Radio, Skeleton, Divider,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useToast } from '../../store/toast.store';

const fmt = (v: any) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const apiError = (e: any, fallback: string) => {
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m.join('. ') : m ?? fallback;
};

type Props = {
  /** OS a cancelar; null fecha o diálogo. */
  workOrder: any | null;
  onClose: () => void;
  onCancelled?: () => void;
};

/**
 * Cancelamento por desistência da cliente.
 *
 * A OS não é apagada: fica cancelada, com o motivo e quem cancelou. O que muda
 * o dinheiro é decidido aqui, com os números na frente — o que ainda seria
 * cobrado deixa de ser, e o que a cliente já pagou fica com o ateliê ou volta
 * para ela.
 */
export default function CancelDialog({ workOrder, onClose, onCancelled }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [refund, setRefund] = useState('KEEP');
  const [returnMaterials, setReturnMaterials] = useState(false);
  const [error, setError] = useState('');

  const { data: preview, isLoading } = useQuery({
    queryKey: ['work-order-cancel-preview', workOrder?.id],
    queryFn: () => api.get(`/work-orders/${workOrder.id}/cancel-preview`).then(r => r.data),
    enabled: Boolean(workOrder),
  });

  useEffect(() => {
    if (workOrder) { setReason(''); setRefund('KEEP'); setReturnMaterials(false); setError(''); }
  }, [workOrder]);

  const mutation = useMutation({
    mutationFn: () => api.post(`/work-orders/${workOrder.id}/cancel`, {
      reason,
      refundPaid: refund === 'REFUND',
      returnMaterials,
    }),
    onSuccess: (res: any) => {
      ['work-orders', 'work-orders-board', 'receivables', 'payables', 'inventory',
        'financial-summary', 'financial-overview',
      ].forEach(key => qc.invalidateQueries({ queryKey: [key] }));
      const d = res.data;
      toast(
        `OS cancelada${d.cancelledReceivables ? ` · ${d.cancelledReceivables} cobrança(s) encerrada(s)` : ''}` +
        `${d.refunded ? ' · devolução gerada em Contas do mês' : ''}` +
        `${d.materialsReturned ? ` · ${d.materialsReturned} material(is) devolvido(s)` : ''}`,
        'info',
      );
      onCancelled?.();
      onClose();
    },
    onError: (e: any) => setError(apiError(e, 'Erro ao cancelar a OS')),
  });

  const paid = Number(preview?.paidAmount ?? 0);
  const open = Number(preview?.openAmount ?? 0);

  return (
    <Dialog open={Boolean(workOrder)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Cancelar {workOrder?.number}
        <Typography variant="caption" color="text.secondary" display="block">
          a cliente desistiu do serviço
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}

        {isLoading ? <Skeleton height={120} /> : preview && !preview.canCancel ? (
          <Alert severity="warning">
            {preview.workOrder.status === 'DELIVERED'
              ? 'A peça já foi entregue — uma OS entregue não pode ser cancelada.'
              : 'Esta OS já está cancelada.'}
          </Alert>
        ) : preview && (
          <>
            <Box sx={{ bgcolor: 'background.default', p: 1.5, borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={1}>
                O que o cancelamento vai mexer
              </Typography>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
                <Typography variant="body2" color="text.secondary">
                  Cobranças em aberto ({preview.openCount})
                </Typography>
                <Typography variant="body2">{fmt(open)} · deixam de ser cobradas</Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
                <Typography variant="body2" color="text.secondary">Já pago pela cliente</Typography>
                <Typography variant="body2" fontWeight={paid > 0 ? 700 : 400}>{fmt(paid)}</Typography>
              </Box>

              {preview.materials.length > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
                  <Typography variant="body2" color="text.secondary">Material já baixado</Typography>
                  <Typography variant="body2">
                    {preview.materials.map((m: any) => `${m.quantity} ${m.unit} de ${m.name}`).join(' · ')}
                  </Typography>
                </Box>
              )}
            </Box>

            <TextField
              label="Por que a cliente desistiu?"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ex.: a festa foi adiada e ela vai refazer o pedido depois"
              required
              autoFocus
              fullWidth
              multiline
              rows={2}
              helperText="Fica registrado no histórico da OS"
            />

            {paid > 0 && (
              <>
                <Divider />
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    O que fazer com os {fmt(paid)} que a cliente já pagou?
                  </Typography>
                  <RadioGroup value={refund} onChange={e => setRefund(e.target.value)}>
                    <FormControlLabel
                      value="KEEP"
                      control={<Radio size="small" />}
                      label="Fica com o ateliê, como compensação pelo trabalho já feito"
                    />
                    <FormControlLabel
                      value="REFUND"
                      control={<Radio size="small" />}
                      label="Devolver à cliente"
                    />
                  </RadioGroup>
                  {refund === 'REFUND' && (
                    <Alert severity="info" sx={{ mt: 1 }}>
                      Uma conta a pagar de {fmt(paid)} é criada em nome da cliente. O dinheiro sai
                      do caixa quando você der baixa nela.
                    </Alert>
                  )}
                </Box>
              </>
            )}

            {preview.materials.length > 0 && (
              <>
                <Divider />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={returnMaterials}
                      onChange={e => setReturnMaterials(e.target.checked)}
                    />
                  }
                  label="Devolver o material ao estoque"
                />
                <Typography variant="caption" color="text.secondary" sx={{ ml: 4, mt: -1 }}>
                  Só marque se o tecido não foi cortado e volta para a prateleira.
                </Typography>
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>Voltar</Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => mutation.mutate()}
          disabled={!reason.trim() || !preview?.canCancel || mutation.isPending}
        >
          Cancelar OS
        </Button>
      </DialogActions>
    </Dialog>
  );
}
