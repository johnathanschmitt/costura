import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Alert, Grid,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import MoneyField from '../../components/common/fields/MoneyField';
import CustomerAutocomplete from '../../components/common/CustomerAutocomplete';
import CategorySelect from './CategorySelect';
import api from '../../services/api';
import { useToast } from '../../store/toast.store';
import { apiError, fmt, toNumber } from './format';

type Props = {
  /** Conta a editar; null fecha o diálogo. */
  account: any | null;
  kind: 'receivable' | 'payable';
  onClose: () => void;
};

/**
 * Edição de conta ainda em aberto.
 *
 * Antes só existia criar, dar baixa e cancelar: um vencimento ou valor digitado
 * errado obrigava a cancelar a conta e criar outra, sujando o histórico.
 */
export default function EditAccountDialog({ account, kind, onClose }: Props) {
  const isReceivable = kind === 'receivable';
  const qc = useQueryClient();
  const toast = useToast();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState<Dayjs | null>(null);
  const [category, setCategory] = useState('');
  const [supplier, setSupplier] = useState('');
  const [customer, setCustomer] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!account) return;
    setDescription(account.description ?? '');
    setAmount(toNumber(account.amount));
    setDueDate(account.dueDate ? dayjs(account.dueDate) : null);
    setCategory(account.category ?? '');
    setSupplier(account.supplier ?? '');
    setCustomer(account.customer ?? null);
    setNotes(account.notes ?? '');
    setError('');
  }, [account]);

  const paid = toNumber(account?.paidAmount);
  // Deixar o valor cair abaixo do que já foi recebido criaria uma conta paga a
  // mais do que vale; o backend recusa e a tela avisa antes.
  const belowPaid = paid > 0 && (amount ?? 0) < paid;

  const mutation = useMutation({
    mutationFn: () => api.patch(`/financial/${isReceivable ? 'receivables' : 'payables'}/${account.id}`, {
      description,
      amount: amount ?? undefined,
      dueDate: dueDate?.toISOString(),
      category: category || undefined,
      ...(isReceivable
        ? { customerId: customer?.id ?? '' }
        : { supplier: supplier || undefined }),
      notes,
    }),
    onSuccess: () => {
      ['receivables', 'payables', 'financial-summary', 'financial-overview', 'reimbursements']
        .forEach(key => qc.invalidateQueries({ queryKey: [key] }));
      toast('Conta atualizada');
      onClose();
    },
    onError: (e: any) => setError(apiError(e, 'Erro ao salvar a conta')),
  });

  return (
    <Dialog open={Boolean(account)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Editar conta {isReceivable ? 'a receber' : 'a pagar'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
        {paid > 0 && (
          <Alert severity="info">
            Esta conta já tem {fmt(paid)} baixados. O valor não pode ficar abaixo disso.
          </Alert>
        )}

        <TextField
          label="Descrição"
          value={description}
          onChange={e => setDescription(e.target.value)}
          fullWidth
          required
          autoFocus
        />

        {isReceivable
          ? <CustomerAutocomplete value={customer} onChange={setCustomer} />
          : (
            <TextField
              label="Fornecedor"
              value={supplier}
              onChange={e => setSupplier(e.target.value)}
              fullWidth
            />
          )}

        <Grid container spacing={2}>
          <Grid item xs={6}>
            <MoneyField
              label="Valor"
              value={amount}
              onChange={setAmount}
              error={belowPaid}
              helperText={belowPaid ? `Mínimo ${fmt(paid)} (já baixado)` : ' '}
              fullWidth
            />
          </Grid>
          <Grid item xs={6}>
            <DatePicker
              label="Vencimento"
              value={dueDate}
              onChange={setDueDate}
              slotProps={{ textField: { fullWidth: true, size: 'small' } }}
            />
          </Grid>
          <Grid item xs={12}>
            <CategorySelect
              type={isReceivable ? 'INCOME' : 'EXPENSE'}
              value={category}
              onChange={setCategory}
            />
          </Grid>
        </Grid>

        <TextField
          label="Observações"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          fullWidth
          multiline
          rows={2}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() => mutation.mutate()}
          disabled={!description.trim() || !amount || belowPaid || mutation.isPending}
        >
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
