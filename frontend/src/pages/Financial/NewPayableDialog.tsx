import { useEffect, useState } from 'react';
import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid,
  Alert, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs, { Dayjs } from 'dayjs';
import MoneyField from '../../components/common/fields/MoneyField';
import api from '../../services/api';
import { useToast } from '../../store/toast.store';
import CategorySelect from './CategorySelect';
import { apiError, fmt } from './format';

export default function NewPayableDialog({ open, onClose, onSuccess }: any) {
  const [form, setForm] = useState({
    description: '', supplier: '', category: '', amount: null as number | null,
    dueDate: null as Dayjs | null, notes: '', recurrence: 'NONE',
  });
  const [error, setError] = useState('');
  const qc = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setForm({
        description: '', supplier: '', category: '', amount: null,
        dueDate: dayjs(), notes: '', recurrence: 'NONE',
      });
      setError('');
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/financial/payables', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payables'] });
      qc.invalidateQueries({ queryKey: ['financial-summary'] });
      toast('Conta a pagar criada');
      // Materializa as próximas ocorrências assim que a conta-mãe existe.
      if (form.recurrence !== 'NONE') {
        api.post('/financial/payables/generate-recurrences')
          .then(() => qc.invalidateQueries({ queryKey: ['payables'] }));
      }
      onSuccess();
    },
    onError: (e: any) => setError(apiError(e, 'Erro ao criar a conta')),
  });

  const ready = Boolean(form.description) && Boolean(form.amount) && Boolean(form.dueDate);
  const repeats = form.recurrence !== 'NONE';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Nova conta a pagar</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField label="Descrição" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} fullWidth required autoFocus />
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <TextField label="Fornecedor" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} fullWidth />
          </Grid>
          <Grid item xs={6}>
            <CategorySelect
              type="EXPENSE"
              value={form.category}
              onChange={v => setForm(f => ({ ...f, category: v }))}
            />
          </Grid>
          <Grid item xs={6}>
            <MoneyField
              label="Valor"
              value={form.amount}
              onChange={v => setForm(f => ({ ...f, amount: v }))}
              fullWidth required
            />
          </Grid>
          <Grid item xs={6}>
            <DatePicker
              label="Vencimento"
              value={form.dueDate}
              onChange={v => setForm(f => ({ ...f, dueDate: v }))}
              slotProps={{ textField: { fullWidth: true, size: 'small' } }}
            />
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Repete todo mês?</InputLabel>
              <Select
                value={form.recurrence}
                label="Repete todo mês?"
                onChange={e => setForm(f => ({ ...f, recurrence: e.target.value }))}
              >
                <MenuItem value="NONE">Não, é só esta vez</MenuItem>
                <MenuItem value="MONTHLY">Sim, todo mês</MenuItem>
                <MenuItem value="YEARLY">Sim, todo ano</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {repeats && (
          <Alert severity="info">
            As contas dos próximos meses são criadas junto com esta, a partir deste vencimento.
          </Alert>
        )}

        <TextField label="Observações" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} fullWidth multiline rows={2} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() => mutation.mutate({
            description: form.description,
            amount: form.amount,
            dueDate: form.dueDate?.toISOString(),
            supplier: form.supplier || undefined,
            category: form.category || undefined,
            recurrence: form.recurrence,
            notes: form.notes || undefined,
          })}
          disabled={!ready || mutation.isPending}
        >
          {ready
            ? repeats
              ? `Criar a conta de ${fmt(form.amount)} e as dos próximos meses`
              : `Criar a conta de ${fmt(form.amount)}`
            : 'Criar a conta'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
