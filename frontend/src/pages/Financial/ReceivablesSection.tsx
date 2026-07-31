import { useState } from 'react';
import {
  Box, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Select, MenuItem, FormControl, InputLabel, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid,
  Alert, Skeleton,
} from '@mui/material';
import { Add, AttachMoney } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs, { Dayjs } from 'dayjs';
import api from '../../services/api';
import PaymentDialog from '../../components/common/PaymentDialog';
import CustomerAutocomplete from '../../components/common/CustomerAutocomplete';

const STATUS_MAP: Record<string, { label: string; color: any }> = {
  PENDING: { label: 'Pendente', color: 'warning' },
  PARTIAL: { label: 'Parcial', color: 'info' },
  PAID: { label: 'Pago', color: 'success' },
  OVERDUE: { label: 'Vencido', color: 'error' },
  CANCELLED: { label: 'Cancelado', color: 'default' },
};

function NewReceivableDialog({ open, onClose, onSuccess }: any) {
  const [form, setForm] = useState({ description: '', amount: '', customer: null as any, dueDate: null as Dayjs | null, notes: '' });
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/financial/receivables', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receivables'] });
      onSuccess();
      setForm({ description: '', amount: '', customer: null, dueDate: null, notes: '' });
    },
  });

  const handleSave = () => {
    mutation.mutate({
      description: form.description,
      amount: parseFloat(form.amount),
      customerId: form.customer?.id ?? null,
      dueDate: form.dueDate?.toISOString(),
      notes: form.notes || null,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Nova Conta a Receber</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <TextField label="Descrição" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} fullWidth required autoFocus />
        <CustomerAutocomplete value={form.customer} onChange={c => setForm(f => ({ ...f, customer: c }))} />
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <TextField
              label="Valor (R$)"
              type="number"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              fullWidth
              required
              inputProps={{ min: 0.01, step: 0.01 }}
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
        </Grid>
        <TextField label="Observações" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} fullWidth multiline rows={2} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} loading={mutation.isPending} disabled={!form.description || !form.amount}>
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function ReceivablesSection() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [payTarget, setPayTarget] = useState<any>(null);
  const [newDialog, setNewDialog] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ['receivables', status],
    queryFn: () => api.get('/financial/receivables', { params: { status: status || undefined } }).then(r => r.data),
  });

  const payMutation = useMutation({
    mutationFn: ({ id, amount, method }: any) => api.patch(`/financial/receivables/${id}/pay`, { amount, method }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['receivables'] }); setPayTarget(null); },
  });

  const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n ?? 0);

  const totalPending = (data as any[]).filter(r => r.status !== 'PAID' && r.status !== 'CANCELLED')
    .reduce((s: number, r: any) => s + Number(r.amount) - Number(r.paidAmount), 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="body2" color="text.secondary">Total a receber</Typography>
          <Typography variant="h5" fontWeight={700} color="success.main">{fmt(totalPending)}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select value={status} label="Status" onChange={e => setStatus(e.target.value)}>
              <MenuItem value="">Todos</MenuItem>
              {Object.entries(STATUS_MAP).map(([v, { label }]) => <MenuItem key={v} value={v}>{label}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={<Add />} onClick={() => setNewDialog(true)}>Nova Conta</Button>
        </Box>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Descrição</TableCell>
              <TableCell>Cliente</TableCell>
              <TableCell align="right">Valor</TableCell>
              <TableCell align="right">Recebido</TableCell>
              <TableCell align="right">Saldo</TableCell>
              <TableCell>Vencimento</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ação</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>{[1,2,3,4,5,6,7,8].map(j => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
            )) : (data as any[]).map((r: any) => {
              const { label, color } = STATUS_MAP[r.status] ?? { label: r.status, color: 'default' };
              const saldo = Number(r.amount) - Number(r.paidAmount);
              const overdue = r.status === 'PENDING' && dayjs(r.dueDate).isBefore(dayjs(), 'day');
              return (
                <TableRow key={r.id} hover sx={{ bgcolor: overdue ? 'error.50' : undefined }}>
                  <TableCell>{r.description}</TableCell>
                  <TableCell>{r.customer?.name ?? '—'}</TableCell>
                  <TableCell align="right">{fmt(r.amount)}</TableCell>
                  <TableCell align="right" sx={{ color: 'success.main' }}>{fmt(r.paidAmount)}</TableCell>
                  <TableCell align="right" sx={{ color: saldo > 0 ? 'error.main' : 'success.main', fontWeight: 600 }}>
                    {fmt(saldo)}
                  </TableCell>
                  <TableCell sx={{ color: overdue ? 'error.main' : undefined }}>
                    {dayjs(r.dueDate).format('DD/MM/YYYY')}
                  </TableCell>
                  <TableCell><Chip label={label} size="small" color={color} /></TableCell>
                  <TableCell align="right">
                    {r.status !== 'PAID' && r.status !== 'CANCELLED' && (
                      <Button size="small" variant="outlined" color="success" startIcon={<AttachMoney />}
                        onClick={() => setPayTarget(r)}>
                        Receber
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {!isLoading && data.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="text.secondary" py={2}>Nenhuma conta encontrada</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <PaymentDialog
        open={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
        onConfirm={(amount, method) => payMutation.mutate({ id: payTarget?.id, amount, method })}
        title={`Receber: ${payTarget?.description ?? ''}`}
        maxAmount={payTarget ? Number(payTarget.amount) - Number(payTarget.paidAmount) : undefined}
        loading={payMutation.isPending}
      />

      <NewReceivableDialog
        open={newDialog}
        onClose={() => setNewDialog(false)}
        onSuccess={() => setNewDialog(false)}
      />
    </Box>
  );
}
