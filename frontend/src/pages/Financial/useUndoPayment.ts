import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useToast } from '../../store/toast.store';
import { apiError } from './format';

/** Tudo que muda quando uma baixa entra ou volta atrás. */
const AFFECTED = [
  'receivables', 'payables', 'cash-transactions', 'cash-register-current',
  'financial-summary', 'financial-overview', 'cash-flow', 'dre', 'monthly-result',
  'accounts', 'account-statement',
];

/**
 * Desfazer uma baixa recém-lançada, sem perguntar nada.
 *
 * O estorno registra motivo — mas quando o desfazer acontece segundos depois da
 * baixa, o motivo é sempre o mesmo, e parar para digitá-lo é justamente o atrito
 * que faz a pessoa desistir e conviver com o erro. O motivo é escrito por aqui.
 *
 * A confirmação prévia continua existindo para o que não tem volta — cancelar
 * uma conta, fechar o mês.
 */
export function useUndoPayment() {
  const qc = useQueryClient();
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: (paymentId: string) =>
      api.post(`/financial/payments/${paymentId}/reverse`, {
        reason: 'Desfeito logo depois do lançamento',
      }),
    onSuccess: () => {
      AFFECTED.forEach(key => qc.invalidateQueries({ queryKey: [key] }));
      toast('Lançamento desfeito', 'info');
    },
    onError: (e: any) => toast(apiError(e, 'Não deu para desfazer'), 'error'),
  });

  /** Pronto para ir no terceiro parâmetro do `toast`. */
  return (paymentId?: string | null) =>
    (paymentId ? { label: 'Desfazer', onClick: () => mutation.mutate(paymentId) } : undefined);
}
