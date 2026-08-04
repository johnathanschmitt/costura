import { useState } from 'react';
import {
  Box, Paper, Typography, Button, Collapse, Stack, Divider, Chip,
} from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import api from '../../services/api';
import PaymentDialog from '../../components/common/PaymentDialog';
import { useToast } from '../../store/toast.store';
import { apiError, fmt, toNumber } from './format';

/**
 * O que o ateliê deve às sócias que pagaram despesa do próprio bolso.
 *
 * Diluído no meio das contas a pagar, isto se responde somando na mão — e nota
 * esquecida vira dinheiro que a sócia nunca viu de volta. Some da tela quando
 * não há nada a ressarcir, que é o caso normal.
 */
export default function ReimbursementsBlock() {
  const qc = useQueryClient();
  const toast = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<any>(null);
  const [payError, setPayError] = useState('');

  const { data } = useQuery({
    queryKey: ['reimbursements'],
    queryFn: () => api.get('/financial/reimbursements').then(r => r.data),
  });

  const mutation = useMutation({
    mutationFn: ({ userId, method }: any) =>
      api.post(`/financial/reimbursements/${userId}/pay`, { method }),
    onSuccess: (res: any) => {
      ['reimbursements', 'payables', 'financial-summary', 'financial-overview',
        'cash-register-current', 'cash-transactions',
      ].forEach(key => qc.invalidateQueries({ queryKey: [key] }));
      const d = res.data;
      setPayTarget(null);
      toast(`${d.partner.name} ressarcida — ${fmt(d.amount)} em ${d.count} nota(s)`);
    },
    onError: (e: any) => setPayError(apiError(e, 'Erro ao ressarcir')),
  });

  const partners = data?.partners ?? [];
  if (partners.length === 0) return null;

  return (
    <>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
          <Typography variant="overline" color="text.secondary" letterSpacing={0.8}>
            A ressarcir às sócias
          </Typography>
          <Typography variant="h6" fontWeight={700} color="warning.main">
            {fmt(data.total)}
          </Typography>
        </Box>

        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
          Despesas do ateliê que elas pagaram do próprio bolso. O gasto já está no resultado; o que
          falta é devolver o dinheiro.
        </Typography>

        <Stack divider={<Divider />}>
          {partners.map((p: any) => (
            <Box key={p.userId} sx={{ py: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1 }}>
                  {p.name}
                </Typography>
                <Typography variant="body2" fontWeight={700}>{fmt(p.amount)}</Typography>
                <Button
                  size="small"
                  endIcon={expanded === p.userId ? <ExpandLess /> : <ExpandMore />}
                  onClick={() => setExpanded(e => (e === p.userId ? null : p.userId))}
                >
                  {p.count} nota{p.count === 1 ? '' : 's'}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  onClick={() => { setPayError(''); setPayTarget(p); }}
                >
                  Ressarcir
                </Button>
              </Box>

              <Collapse in={expanded === p.userId}>
                <Stack spacing={0.5} sx={{ pl: 1, pt: 1 }}>
                  {p.items.map((i: any) => (
                    <Box key={i.id} sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography variant="body2" sx={{ flexGrow: 1 }}>
                        {i.description}
                        {i.supplier && (
                          <Typography component="span" variant="caption" color="text.secondary">
                            {' '}· {i.supplier}
                          </Typography>
                        )}
                      </Typography>
                      {i.category && <Chip size="small" variant="outlined" label={i.category} />}
                      <Typography variant="caption" color="text.secondary">
                        {dayjs(i.dueDate).format('DD/MM')}
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ minWidth: 90, textAlign: 'right' }}>
                        {fmt(i.amount)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Collapse>
            </Box>
          ))}
        </Stack>
      </Paper>

      {/* O valor não é editável: é a soma do que ela adiantou e ainda não
          recebeu. Só falta dizer de onde sai o dinheiro. */}
      <PaymentDialog
        open={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
        onConfirm={(_amount, method) => mutation.mutate({ userId: payTarget?.userId, method })}
        title={`Ressarcir ${payTarget?.name ?? ''}`}
        maxAmount={payTarget ? toNumber(payTarget.amount) : undefined}
        loading={mutation.isPending}
        error={payError}
        verb="Ressarcir"
        lockAmount
        confirmColor="error"
        amountLabel="Valor a ressarcir (R$)"
      />
    </>
  );
}
