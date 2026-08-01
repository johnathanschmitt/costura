import { useEffect, useState } from 'react';
import {
  Box, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Select, MenuItem, FormControl, InputLabel, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid,
  Alert, Skeleton, TablePagination, IconButton, Tooltip, Divider,
} from '@mui/material';
import MoneyField from '../../components/common/fields/MoneyField';
import { Add, AttachMoney, Block } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs, { Dayjs } from 'dayjs';
import api from '../../services/api';
import PaymentDialog from '../../components/common/PaymentDialog';
import CustomerAutocomplete from '../../components/common/CustomerAutocomplete';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useToast } from '../../store/toast.store';
import { apiError, fmt, STATUS_MAP, toNumber } from './format';

const METHODS = [
  { value: 'PIX', label: 'Pix' },
  { value: 'CASH', label: 'Dinheiro' },
  { value: 'CREDIT_CARD', label: 'Cartão de Crédito' },
  { value: 'DEBIT_CARD', label: 'Cartão de Débito' },
  { value: 'TRANSFER', label: 'Transferência' },
];

function NewReceivableDialog({ open, onClose, onSuccess }: any) {
  const [form, setForm] = useState({ description: '', amount: null as number | null, customer: null as any, dueDate: null as Dayjs | null, notes: '' });
  const [installments, setInstallments] = useState(1);
  const [downPayment, setDownPayment] = useState<number | null>(null);
  const [downMethod, setDownMethod] = useState('PIX');
  const [error, setError] = useState('');
  const qc = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setForm({ description: '', amount: null, customer: null, dueDate: dayjs(), notes: '' });
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
          notes: form.notes || undefined,
        }
      : {
          description: form.description,
          amount: total,
          customerId: form.customer?.id ?? undefined,
          dueDate: form.dueDate?.toISOString(),
          notes: form.notes || undefined,
        },
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Nova Conta a Receber</DialogTitle>
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
        </Grid>

        <Divider textAlign="left">
          <Typography variant="caption" color="text.secondary">Sinal e parcelamento</Typography>
        </Divider>

        <Grid container spacing={2}>
          <Grid item xs={4}>
            <MoneyField
              label="Sinal"
              value={downPayment}
              onChange={setDownPayment}
              helperText="Pago agora"
              fullWidth
            />
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
        <Button
          variant="contained"
          onClick={submit}
          disabled={!form.description || !total || !form.dueDate || down > total || mutation.isPending}
        >
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function ReceivablesSection() {
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);
  const [payTarget, setPayTarget] = useState<any>(null);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [newDialog, setNewDialog] = useState(false);
  const [payError, setPayError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['receivables', status, page, limit],
    queryFn: () => api.get('/financial/receivables', {
      params: { status: status || undefined, page: page + 1, limit },
    }).then(r => r.data),
  });

  const rows = data?.data ?? [];
  const summary = data?.summary;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['receivables'] });
    qc.invalidateQueries({ queryKey: ['financial-summary'] });
    qc.invalidateQueries({ queryKey: ['cash-register-current'] });
    qc.invalidateQueries({ queryKey: ['cash-transactions'] });
  };

  const payMutation = useMutation({
    mutationFn: ({ id, amount, method, amountTendered }: any) => api.patch(`/financial/receivables/${id}/pay`, { amount, method, amountTendered }),
    onSuccess: () => { refresh(); setPayTarget(null); toast('Recebimento registrado'); },
    onError: (e: any) => setPayError(apiError(e, 'Erro ao registrar o recebimento')),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/financial/receivables/${id}`),
    onSuccess: () => { refresh(); setCancelTarget(null); toast('Conta cancelada', 'info'); },
    onError: (e: any) => { setCancelTarget(null); toast(apiError(e, 'Erro ao cancelar'), 'error'); },
  });

  const handleFilter = (value: string) => { setStatus(value); setPage(0); };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 4 }}>
          <Box>
            <Typography variant="body2" color="text.secondary">Total a receber</Typography>
            <Typography variant="h5" fontWeight={700} color="success.main">
              {isLoading ? <Skeleton width={140} /> : fmt(summary?.totalOpen)}
            </Typography>
          </Box>
          {toNumber(summary?.overdueAmount) > 0 && (
            <Box>
              <Typography variant="body2" color="text.secondary">
                Vencido ({summary.overdueCount})
              </Typography>
              <Typography variant="h5" fontWeight={700} color="error.main">
                {fmt(summary.overdueAmount)}
              </Typography>
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select value={status} label="Status" onChange={e => handleFilter(e.target.value)}>
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
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>{[1,2,3,4,5,6,7,8].map(j => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
            )) : rows.map((r: any) => {
              const { label, color } = STATUS_MAP[r.status] ?? { label: r.status, color: 'default' };
              const saldo = toNumber(r.amount) - toNumber(r.paidAmount);
              const overdue = r.status === 'OVERDUE';
              const settled = r.status === 'PAID' || r.status === 'CANCELLED';
              return (
                <TableRow key={r.id} hover sx={{ bgcolor: overdue ? 'error.50' : undefined }}>
                  <TableCell>{r.description}</TableCell>
                  <TableCell>{r.customer?.name ?? '—'}</TableCell>
                  <TableCell align="right">{fmt(r.amount)}</TableCell>
                  <TableCell align="right" sx={{ color: 'success.main' }}>{fmt(r.paidAmount)}</TableCell>
                  <TableCell align="right" sx={{ color: saldo > 0 ? 'error.main' : 'success.main', fontWeight: 600 }}>
                    {fmt(saldo)}
                  </TableCell>
                  <TableCell sx={{ color: overdue ? 'error.main' : undefined, fontWeight: overdue ? 600 : undefined }}>
                    {dayjs(r.dueDate).format('DD/MM/YYYY')}
                    {overdue && (
                      <Typography variant="caption" display="block" color="error.main">
                        há {dayjs().diff(dayjs(r.dueDate), 'day')} dia(s)
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell><Chip label={label} size="small" color={color} /></TableCell>
                  <TableCell align="right">
                    {!settled && (
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        <Button size="small" variant="outlined" color="success" startIcon={<AttachMoney />}
                          onClick={() => { setPayError(''); setPayTarget(r); }}>
                          Receber
                        </Button>
                        <Tooltip title="Cancelar conta">
                          <IconButton size="small" color="default" onClick={() => setCancelTarget(r)}>
                            <Block fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="text.secondary" py={2}>Nenhuma conta encontrada</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={data?.total ?? 0}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={limit}
          onRowsPerPageChange={e => { setLimit(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50, 100]}
          labelRowsPerPage="Por página"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
        />
      </TableContainer>

      <PaymentDialog
        open={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
        onConfirm={(amount, method, amountTendered) => payMutation.mutate({ id: payTarget?.id, amount, method, amountTendered })}
        title={`Receber: ${payTarget?.description ?? ''}`}
        maxAmount={payTarget ? toNumber(payTarget.amount) - toNumber(payTarget.paidAmount) : undefined}
        loading={payMutation.isPending}
        error={payError}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelMutation.mutate(cancelTarget.id)}
        title="Cancelar conta"
        message={`Cancelar "${cancelTarget?.description ?? ''}"? A conta deixa de ser cobrada, mas continua no histórico.`}
        confirmLabel="Cancelar conta"
        confirmColor="error"
        loading={cancelMutation.isPending}
      />

      <NewReceivableDialog
        open={newDialog}
        onClose={() => setNewDialog(false)}
        onSuccess={() => setNewDialog(false)}
      />
    </Box>
  );
}
