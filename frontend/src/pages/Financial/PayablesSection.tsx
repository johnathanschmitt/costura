import { useState } from 'react';
import {
  Box, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Select, MenuItem, FormControl, InputLabel, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid, Skeleton,
} from '@mui/material';
import { Add, Payment } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs, { Dayjs } from 'dayjs';
import api from '../../services/api';
import PaymentDialog from '../../components/common/PaymentDialog';

const STATUS_MAP: Record<string, { label: string; color: any }> = {
  PENDING: { label: 'Pendente', color: 'warning' },
  PARTIAL: { label: 'Parcial', color: 'info' },
  PAID: { label: 'Pago', color: 'success' },
  OVERDUE: { label: 'Vencido', color: 'error' },
  CANCELLED: { label: 'Cancelado', color: 'default' },
};

const CATEGORIES = ['Aluguel', 'Material', 'Mão de obra', 'Energia', 'Água', 'Internet', 'Impostos', 'Marketing', 'Outros'];

function NewPayableDialog({ open, onClose, onSuccess }: any) {
  const [form, setForm] = useState({
    description: '', supplier: '', category: '', amount: '',
    dueDate: null as Dayjs | null, notes: '',
  });
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/financial/payables', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payables'] });
      onSuccess();
      setForm({ description: '', supplier: '', category: '', amount: '', dueDate: null, notes: '' });
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Nova Conta a Pagar</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <TextField label="Descrição" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} fullWidth required autoFocus />
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <TextField label="Fornecedor" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} fullWidth />
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Categoria</InputLabel>
              <Select value={form.category} label="Categoria" onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Valor (R$)"
              type="number"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              fullWidth required
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
        <Button variant="contained" onClick={() => mutation.mutate({ ...form, amount: parseFloat(form.amount), dueDate: form.dueDate?.toISOString(), supplier: form.supplier || null, category: form.category || null, notes: form.notes || null })}
          loading={mutation.isPending} disabled={!form.description || !form.amount}>
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function PayablesSection() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [payTarget, setPayTarget] = useState<any>(null);
  const [newDialog, setNewDialog] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ['payables', status],
    queryFn: () => api.get('/financial/payables', { params: { status: status || undefined } }).then(r => r.data),
  });

  const payMutation = useMutation({
    mutationFn: ({ id, amount, method }: any) => api.patch(`/financial/payables/${id}/pay`, { amount, method }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payables'] }); setPayTarget(null); },
  });

  const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n ?? 0);

  const totalPending = (data as any[]).filter(r => r.status !== 'PAID' && r.status !== 'CANCELLED')
    .reduce((s: number, r: any) => s + Number(r.amount) - Number(r.paidAmount), 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="body2" color="text.secondary">Total a pagar</Typography>
          <Typography variant="h5" fontWeight={700} color="error.main">{fmt(totalPending)}</Typography>
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
              <TableCell>Fornecedor</TableCell>
              <TableCell>Categoria</TableCell>
              <TableCell align="right">Valor</TableCell>
              <TableCell align="right">Pago</TableCell>
              <TableCell align="right">Saldo</TableCell>
              <TableCell>Vencimento</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ação</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>{[1,2,3,4,5,6,7,8,9].map(j => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
            )) : (data as any[]).map((r: any) => {
              const { label, color } = STATUS_MAP[r.status] ?? { label: r.status, color: 'default' };
              const saldo = Number(r.amount) - Number(r.paidAmount);
              const overdue = r.status === 'PENDING' && dayjs(r.dueDate).isBefore(dayjs(), 'day');
              return (
                <TableRow key={r.id} hover sx={{ bgcolor: overdue ? 'error.50' : undefined }}>
                  <TableCell>{r.description}</TableCell>
                  <TableCell>{r.supplier ?? '—'}</TableCell>
                  <TableCell>{r.category ?? '—'}</TableCell>
                  <TableCell align="right">{fmt(r.amount)}</TableCell>
                  <TableCell align="right" sx={{ color: 'success.main' }}>{fmt(r.paidAmount)}</TableCell>
                  <TableCell align="right" sx={{ color: saldo > 0 ? 'error.main' : 'text.primary', fontWeight: 600 }}>
                    {fmt(saldo)}
                  </TableCell>
                  <TableCell sx={{ color: overdue ? 'error.main' : undefined }}>
                    {dayjs(r.dueDate).format('DD/MM/YYYY')}
                  </TableCell>
                  <TableCell><Chip label={label} size="small" color={color} /></TableCell>
                  <TableCell align="right">
                    {r.status !== 'PAID' && r.status !== 'CANCELLED' && (
                      <Button size="small" variant="outlined" color="error" startIcon={<Payment />}
                        onClick={() => setPayTarget(r)}>
                        Pagar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {!isLoading && data.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} align="center">
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
        title={`Pagar: ${payTarget?.description ?? ''}`}
        maxAmount={payTarget ? Number(payTarget.amount) - Number(payTarget.paidAmount) : undefined}
        loading={payMutation.isPending}
      />

      <NewPayableDialog open={newDialog} onClose={() => setNewDialog(false)} onSuccess={() => setNewDialog(false)} />
    </Box>
  );
}
