import { useEffect, useState } from 'react';
import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid,
  Alert, Select, MenuItem, FormControl, InputLabel, Typography, Divider,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs, { Dayjs } from 'dayjs';
import MoneyField from '../../components/common/fields/MoneyField';
import CustomerAutocomplete from '../../components/common/CustomerAutocomplete';
import { METHODS } from '../../components/common/PaymentDialog';
import api from '../../services/api';
import { useToast } from '../../store/toast.store';
import CategorySelect from './CategorySelect';
import { apiError, fmt } from './format';

export default function NewReceivableDialog({ open, onClose, onSuccess }: any) {
  const [form, setForm] = useState({
    description: '', amount: null as number | null, customer: null as any,
    dueDate: null as Dayjs | null, category: 'Costura', notes: '',
  });
  const [installments, setInstallments] = useState(1);
  const [downPayment, setDownPayment] = useState<number | null>(null);
  const [downMethod, setDownMethod] = useState('PIX');
  const [error, setError] = useState('');
  const qc = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setForm({ description: '', amount: null, customer: null, dueDate: dayjs(), category: 'Costura', notes: '' });
      setInstallments(1);
      setDownPayment(null);
      setDownMethod('PIX');
      setError('');
    }
  }, [open]);

  const total = form.amount ?? 0;
  const down = downPayment ?? 0;
  const financed = Math.max(total - down, 0);
  const isInstalled = installments > 1 || down > 0;
  const perInstallment = installments > 0 ? financed / installments : 0;

  const mutation = useMutation({
    mutationFn: (data: any) =>
      // Parcelado e à vista são fluxos distintos no backend.
      isInstalled
        ? api.post('/financial/receivables/installments', data)
        : api.post('/financial/receivables', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receivables'] });
      qc.invalidateQueries({ queryKey: ['financial-summary'] });
      qc.invalidateQueries({ queryKey: ['cash-register-current'] });
      toast(isInstalled ? 'Parcelamento criado' : 'Conta a receber criada');
      onSuccess();
    },
    onError: (e: any) => setError(apiError(e, 'Erro ao criar a conta')),
  });

  const submit = () => mutation.mutate(
    isInstalled
      ? {
        description: form.description,
        amount: total,
        installments,
        firstDueDate: form.dueDate?.toISOString(),
        downPayment: down > 0 ? down : undefined,
        downPaymentMethod: down > 0 ? downMethod : undefined,
        customerId: form.customer?.id ?? undefined,
        category: form.category || undefined,
        notes: form.notes || undefined,
      }
      : {
        description: form.description,
        amount: total,
        customerId: form.customer?.id ?? undefined,
        dueDate: form.dueDate?.toISOString(),
        category: form.category || undefined,
        notes: form.notes || undefined,
      },
  );

  const ready = Boolean(form.description) && total > 0 && Boolean(form.dueDate) && down <= total;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Nova conta a receber</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField label="Descrição" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} fullWidth required autoFocus />
        <CustomerAutocomplete value={form.customer} onChange={c => setForm(f => ({ ...f, customer: c }))} />
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <MoneyField
              label="Valor"
              value={form.amount}
              onChange={v => setForm(f => ({ ...f, amount: v }))}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={6}>
            <DatePicker
              label={installments > 1 ? '1º vencimento' : 'Vencimento'}
              value={form.dueDate}
              onChange={v => setForm(f => ({ ...f, dueDate: v }))}
              slotProps={{ textField: { fullWidth: true, size: 'small' } }}
            />
          </Grid>
          <Grid item xs={12}>
            {/* Sem categoria a receita some do resultado, que passa a mostrar
                tudo como "Sem categoria". */}
            <CategorySelect
              type="INCOME"
              value={form.category}
              onChange={v => setForm(f => ({ ...f, category: v }))}
              label="Categoria da receita"
            />
          </Grid>
        </Grid>

        <Divider textAlign="left">
          <Typography variant="caption" color="text.secondary">Sinal e parcelamento</Typography>
        </Divider>

        <Grid container spacing={2}>
          <Grid item xs={4}>
            <MoneyField label="Sinal" value={downPayment} onChange={setDownPayment} helperText="Pago agora" fullWidth />
          </Grid>
          <Grid item xs={4}>
            <FormControl fullWidth size="small" disabled={down <= 0}>
              <InputLabel>Forma do sinal</InputLabel>
              <Select value={downMethod} label="Forma do sinal" onChange={e => setDownMethod(e.target.value)}>
                {METHODS.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={4}>
            <TextField
              label="Parcelas"
              type="number"
              value={installments}
              onChange={e => setInstallments(Math.max(1, Math.min(36, parseInt(e.target.value) || 1)))}
              inputProps={{ min: 1, max: 36 }}
              helperText="mensais"
              fullWidth
            />
          </Grid>
        </Grid>

        {isInstalled && total > 0 && (
          <Alert severity="info">
            {down > 0 && <>Sinal de <strong>{fmt(down)}</strong> quitado na hora. </>}
            {financed > 0 && (
              <>Restam <strong>{fmt(financed)}</strong> em <strong>{installments}×</strong> de
                aproximadamente <strong>{fmt(perInstallment)}</strong>, a partir de{' '}
                {form.dueDate?.format('DD/MM/YYYY')}.</>
            )}
          </Alert>
        )}

        <TextField label="Observações" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} fullWidth multiline rows={2} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button variant="contained" onClick={submit} disabled={!ready || mutation.isPending}>
          {ready
            ? isInstalled
              ? `Criar ${installments > 1 ? `${installments} parcelas de ${fmt(perInstallment)}` : `a cobrança de ${fmt(financed)}`}`
              : `Criar a cobrança de ${fmt(total)}`
            : 'Criar a cobrança'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
