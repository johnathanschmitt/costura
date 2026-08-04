import { useEffect, useState } from 'react';
import {
  Box, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Select, MenuItem, FormControl, InputLabel, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid, Skeleton,
  Alert, TablePagination, IconButton, Tooltip,
} from '@mui/material';
import MoneyField from '../../components/common/fields/MoneyField';
import { Add, Payment, Block, Edit, History, AttachFile } from '@mui/icons-material';
import AttachmentsCard from '../../components/common/AttachmentsCard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs, { Dayjs } from 'dayjs';
import api from '../../services/api';
import PaymentDialog from '../../components/common/PaymentDialog';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import CategorySelect from './CategorySelect';
import MonthNavigator, { monthRange, isFromAnotherMonth, monthOf } from './MonthNavigator';
import EditAccountDialog from './EditAccountDialog';
import PaymentsHistoryDialog from './PaymentsHistoryDialog';
import { useToast } from '../../store/toast.store';
import { apiError, fmt, STATUS_MAP, toNumber } from './format';

// A lista de categorias vem do cadastro (CategorySelect). A lista fixa que
// existia aqui usava nomes próprios ("Material", "Energia") que não batiam com
// os do cadastro ("Materiais", "Luz"), e o DRE agrupa pelo nome — o mesmo gasto
// aparecia em duas linhas.

function NewPayableDialog({ open, onClose, onSuccess }: any) {
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Nova Conta a Pagar</DialogTitle>
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
              <InputLabel>Recorrência</InputLabel>
              <Select
                value={form.recurrence}
                label="Recorrência"
                onChange={e => setForm(f => ({ ...f, recurrence: e.target.value }))}
              >
                <MenuItem value="NONE">Única</MenuItem>
                <MenuItem value="MONTHLY">Mensal</MenuItem>
                <MenuItem value="YEARLY">Anual</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {form.recurrence !== 'NONE' && (
          <Alert severity="info">
            As próximas ocorrências ({form.recurrence === 'MONTHLY' ? 'mensais' : 'anuais'}) são
            criadas automaticamente para os próximos meses, a partir deste vencimento.
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
          disabled={!form.description || !form.amount || !form.dueDate || mutation.isPending}
        >
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function PayablesSection() {
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [month, setMonth] = useState(monthOf());
  const [includeOverdue, setIncludeOverdue] = useState(true);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);
  const [payTarget, setPayTarget] = useState<any>(null);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [historyTarget, setHistoryTarget] = useState<any>(null);
  const [attachTarget, setAttachTarget] = useState<any>(null);
  const [newDialog, setNewDialog] = useState(false);
  const [payError, setPayError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['payables', status, category, month, includeOverdue, page, limit],
    queryFn: () => api.get('/financial/payables', {
      params: {
        status: status || undefined,
        category: category || undefined,
        ...monthRange(month),
        includeOverdue,
        page: page + 1,
        limit,
      },
    }).then(r => r.data),
  });

  const rows = data?.data ?? [];
  const summary = data?.summary;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['payables'] });
    qc.invalidateQueries({ queryKey: ['financial-summary'] });
    qc.invalidateQueries({ queryKey: ['cash-register-current'] });
    qc.invalidateQueries({ queryKey: ['cash-transactions'] });
  };

  const payMutation = useMutation({
    mutationFn: ({ id, amount, method, amountTendered }: any) => api.patch(`/financial/payables/${id}/pay`, { amount, method, amountTendered }),
    onSuccess: () => { refresh(); setPayTarget(null); toast('Pagamento registrado'); },
    onError: (e: any) => setPayError(apiError(e, 'Erro ao registrar o pagamento')),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/financial/payables/${id}`),
    onSuccess: () => { refresh(); setCancelTarget(null); toast('Conta cancelada', 'info'); },
    onError: (e: any) => { setCancelTarget(null); toast(apiError(e, 'Erro ao cancelar'), 'error'); },
  });

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <MonthNavigator
          month={month}
          onChange={m => { setMonth(m); setPage(0); }}
          includeOverdue={includeOverdue}
          onIncludeOverdueChange={v => { setIncludeOverdue(v); setPage(0); }}
        />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 4 }}>
          <Box>
            <Typography variant="body2" color="text.secondary">Total a pagar</Typography>
            <Typography variant="h5" fontWeight={700} color="error.main">
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
          {/* O custo fixo é o que define quanto o ateliê precisa faturar para
              empatar; separado do variável, dá para ver o que dá para cortar. */}
          {summary && (
            <Box>
              <Typography variant="body2" color="text.secondary">Em aberto</Typography>
              <Typography variant="body2">
                fixas <strong>{fmt(summary.openFixed)}</strong>
                {' · '}
                variáveis <strong>{fmt(summary.openVariable)}</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                fixas: {(summary.fixedCategories ?? []).join(', ') || 'nenhuma marcada'}
              </Typography>
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Box sx={{ minWidth: 160 }}>
            <CategorySelect
              type="EXPENSE"
              value={category}
              onChange={v => { setCategory(v); setPage(0); }}
              emptyLabel="Todas"
            />
          </Box>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select value={status} label="Status" onChange={e => { setStatus(e.target.value); setPage(0); }}>
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
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>{[1,2,3,4,5,6,7,8,9].map(j => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
            )) : rows.map((r: any) => {
              const { label, color } = STATUS_MAP[r.status] ?? { label: r.status, color: 'default' };
              const saldo = toNumber(r.amount) - toNumber(r.paidAmount);
              const overdue = r.status === 'OVERDUE';
              const settled = r.status === 'PAID' || r.status === 'CANCELLED';
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
                  <TableCell sx={{ color: overdue ? 'error.main' : undefined, fontWeight: overdue ? 600 : undefined }}>
                    {dayjs(r.dueDate).format('DD/MM/YYYY')}
                    {isFromAnotherMonth(r.dueDate, month) && (
                      <Chip
                        size="small"
                        variant="outlined"
                        color="warning"
                        label="de outro mês"
                        sx={{ ml: 0.5, height: 18, fontSize: 10 }}
                      />
                    )}
                    {overdue && (
                      <Typography variant="caption" display="block" color="error.main">
                        há {dayjs().diff(dayjs(r.dueDate), 'day')} dia(s)
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell><Chip label={label} size="small" color={color} /></TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                      {!settled && (
                        <Button size="small" variant="outlined" color="error" startIcon={<Payment />}
                          onClick={() => { setPayError(''); setPayTarget(r); }}>
                          Pagar
                        </Button>
                      )}
                      <Tooltip title="Comprovante / nota fiscal">
                        <IconButton size="small" onClick={() => setAttachTarget(r)}>
                          <AttachFile fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {(r.payments?.length ?? 0) > 0 && (
                        <Tooltip title="Baixas e estorno">
                          <IconButton size="small" onClick={() => setHistoryTarget(r)}>
                            <History fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {!settled && (
                        <>
                          <Tooltip title="Editar conta">
                            <IconButton size="small" onClick={() => setEditTarget(r)}>
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Cancelar conta">
                            <IconButton size="small" onClick={() => setCancelTarget(r)}>
                              <Block fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} align="center">
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
        title={`Pagar: ${payTarget?.description ?? ''}`}
        maxAmount={payTarget ? toNumber(payTarget.amount) - toNumber(payTarget.paidAmount) : undefined}
        loading={payMutation.isPending}
        error={payError}
        confirmColor="error"
        amountLabel="Valor pago (R$)"
      />

      <EditAccountDialog
        account={editTarget}
        kind="payable"
        onClose={() => setEditTarget(null)}
      />

      {/* Guardar a nota junto da despesa evita a caça ao papel quando o contador
          pede o comprovante meses depois. */}
      <Dialog open={Boolean(attachTarget)} onClose={() => setAttachTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Comprovantes
          <Typography variant="caption" color="text.secondary" display="block">
            {attachTarget?.description}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {attachTarget && (
            <AttachmentsCard entityType="accountPayable" entityId={attachTarget.id} />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAttachTarget(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      <PaymentsHistoryDialog
        account={historyTarget}
        onClose={() => setHistoryTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelMutation.mutate(cancelTarget.id)}
        title="Cancelar conta"
        message={`Cancelar "${cancelTarget?.description ?? ''}"? A conta deixa de ser paga, mas continua no histórico.`}
        confirmLabel="Cancelar conta"
        confirmColor="error"
        loading={cancelMutation.isPending}
      />

      <NewPayableDialog open={newDialog} onClose={() => setNewDialog(false)} onSuccess={() => setNewDialog(false)} />
    </Box>
  );
}
