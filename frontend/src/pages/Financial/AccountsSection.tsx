import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Button, Skeleton, IconButton, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel,
  Select, MenuItem, Alert, Grid, FormControlLabel, Switch, Checkbox, TablePagination,
  Stack,
} from '@mui/material';
import {
  Add, SwapHoriz, Edit, Delete, Receipt, Search, Download, ArrowUpward, ArrowDownward,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import MoneyField from '../../components/common/fields/MoneyField';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import api from '../../services/api';
import { useToast } from '../../store/toast.store';
import { useFinancialPeriod } from '../../store/financialPeriod.store';
import { useCompact } from '../../hooks/useCompact';
import { apiError, fmt, METHOD_LABELS, toNumber } from './format';

const KINDS = [
  { value: 'BANK', label: 'Banco' },
  { value: 'WALLET', label: 'Carteira / Pix' },
  { value: 'SAFE', label: 'Cofre' },
  { value: 'RESERVE', label: 'Reserva' },
];

const KIND_LABEL: Record<string, string> = {
  CASH_DRAWER: 'Gaveta', BANK: 'Banco', WALLET: 'Carteira / Pix', SAFE: 'Cofre', RESERVE: 'Reserva',
};

function AccountDialog({ account, open, onClose }: any) {
  const editing = Boolean(account);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('BANK');
  const [openingBalance, setOpeningBalance] = useState<number | null>(0);
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState('');
  const qc = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setName(account?.name ?? '');
    setKind(account?.kind ?? 'BANK');
    setOpeningBalance(account ? toNumber(account.openingBalance) : 0);
    setIsDefault(Boolean(account?.isDefault));
    setError('');
  }, [open, account]);

  const mutation = useMutation({
    mutationFn: async () => (editing
      ? api.patch(`/financial/accounts/${account.id}`, { name, isDefault, openingBalance })
      : api.post('/financial/accounts', { name, kind, openingBalance, isDefault })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-accounts'] });
      qc.invalidateQueries({ queryKey: ['financial-overview'] });
      toast(editing ? 'Conta atualizada' : 'Conta criada');
      onClose();
    },
    onError: (e: any) => setError(apiError(e, 'Erro ao salvar a conta')),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{editing ? 'Editar conta' : 'Nova conta'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="Nome"
          value={name}
          onChange={e => setName(e.target.value)}
          fullWidth
          required
          autoFocus
          disabled={account?.isSystem}
          helperText={account?.isSystem ? 'Conta do sistema — o nome não muda' : ' '}
        />
        {!editing && (
          <FormControl fullWidth>
            <InputLabel>Tipo</InputLabel>
            <Select value={kind} label="Tipo" onChange={e => setKind(e.target.value)}>
              {KINDS.map(k => <MenuItem key={k.value} value={k.value}>{k.label}</MenuItem>)}
            </Select>
          </FormControl>
        )}
        <MoneyField
          label="Saldo já existente"
          value={openingBalance}
          onChange={setOpeningBalance}
          fullWidth
        />
        <FormControlLabel
          control={<Switch checked={isDefault} onChange={e => setIsDefault(e.target.checked)} />}
          label="Conta padrão para Pix, cartão e transferência"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() => mutation.mutate()}
          disabled={!name.trim() || mutation.isPending}
        >
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function TransferDialog({ open, onClose, accounts }: any) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const qc = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (open) { setFrom(''); setTo(''); setAmount(null); setReason(''); setError(''); }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => api.post('/financial/accounts/transfer', {
      fromAccountId: from, toAccountId: to, amount, reason,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-accounts'] });
      qc.invalidateQueries({ queryKey: ['financial-overview'] });
      toast('Transferência registrada');
      onClose();
    },
    onError: (e: any) => setError(apiError(e, 'Erro ao transferir')),
  });

  // A gaveta entra e sai pelo caixa (sangria/suprimento), para o fechamento
  // continuar batendo com o dinheiro contado.
  const selectable = (accounts ?? []).filter((a: any) => a.kind !== 'CASH_DRAWER' && a.active);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Transferir entre contas</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <Alert severity="info">
          Para tirar ou colocar dinheiro na gaveta, use sangria e suprimento na tela do Caixa.
        </Alert>
        <FormControl fullWidth required>
          <InputLabel>De</InputLabel>
          <Select value={from} label="De" onChange={e => setFrom(e.target.value)}>
            {selectable.map((a: any) => (
              <MenuItem key={a.id} value={a.id}>{a.name} — {fmt(a.balance)}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth required>
          <InputLabel>Para</InputLabel>
          <Select value={to} label="Para" onChange={e => setTo(e.target.value)}>
            {selectable.filter((a: any) => a.id !== from).map((a: any) => (
              <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <MoneyField label="Valor" value={amount} onChange={setAmount} fullWidth />
        <TextField
          label="Motivo"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Ex.: aporte para a reserva"
          fullWidth
          required
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() => mutation.mutate()}
          disabled={!from || !to || !amount || !reason.trim() || mutation.isPending}
        >
          Transferir
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Extrato da conta, com a conferência contra o extrato do banco.
 *
 * Conciliar é o que separa "o sistema acha que tem" de "o banco confirma que
 * tem": sem isso, um Pix que não caiu ou uma tarifa não lançada só aparecem
 * quando o dinheiro falta.
 */
function StatementDialog({ account, onClose }: any) {
  const qc = useQueryClient();
  const toast = useToast();
  const [until, setUntil] = useState('');
  const isDrawer = account?.kind === 'CASH_DRAWER';

  const { data, isLoading } = useQuery({
    queryKey: ['account-statement', account?.id],
    queryFn: () => api.get(`/financial/accounts/${account.id}/statement`).then(r => r.data),
    enabled: Boolean(account),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['account-statement'] });
    qc.invalidateQueries({ queryKey: ['financial-accounts'] });
  };

  const toggle = useMutation({
    mutationFn: ({ e, reconciled }: any) =>
      api.patch(`/financial/accounts/reconcile/${e.source === 'TRANSFER' ? 'TRANSFER' : 'PAYMENT'}/${e.id}`,
        { reconciled }),
    onSuccess: refresh,
    onError: (err: any) => toast(apiError(err, 'Erro ao conferir'), 'error'),
  });

  const reconcileUntil = useMutation({
    mutationFn: () => api.post(`/financial/accounts/${account.id}/reconcile`, { until }),
    onSuccess: (res: any) => {
      refresh();
      toast(`${res.data.reconciled} lançamento(s) conferidos`);
      setUntil('');
    },
    onError: (err: any) => toast(apiError(err, 'Erro ao conferir'), 'error'),
  });

  return (
    <Dialog open={Boolean(account)} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Extrato — {account?.name}
        <Typography variant="caption" color="text.secondary" display="block">
          saldo atual {fmt(account?.balance)}
          {account?.reconciledUntil && ` · conferido até ${dayjs(account.reconciledUntil).format('DD/MM/YYYY')}`}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {!isDrawer && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
            <TextField
              label="Conferi até"
              type="date"
              size="small"
              value={until}
              onChange={e => setUntil(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Button
              variant="outlined"
              onClick={() => reconcileUntil.mutate()}
              disabled={!until || reconcileUntil.isPending}
            >
              Marcar como conferido
            </Button>
          </Box>
        )}
        {isDrawer && (
          <Alert severity="info" sx={{ mb: 2 }}>
            A gaveta é conferida no fechamento do caixa, contando o dinheiro.
          </Alert>
        )}

        {isLoading ? <Skeleton height={200} /> : (
          <Table size="small">
            <TableBody>
              {(data?.entries ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Box sx={{ py: 3 }}>
                      <Typography variant="body2" fontWeight={600} gutterBottom>
                        Nenhuma movimentação nesta conta ainda.
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {isDrawer
                          ? 'A gaveta se move quando você lança dinheiro no caixa, recebe em espécie ou faz uma sangria.'
                          : 'Esta conta se move quando você recebe por Pix, cartão ou transferência escolhendo-a, ou transfere dinheiro para ela.'}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
              {(data?.entries ?? []).map((e: any) => (
                <TableRow key={`${e.source}-${e.id}`} hover>
                  {!isDrawer && (
                    <TableCell padding="checkbox">
                      <Tooltip title={e.reconciledAt ? 'Conferido' : 'Marcar como conferido'}>
                        <span>
                          <Checkbox
                            size="small"
                            checked={Boolean(e.reconciledAt)}
                            onChange={ev => toggle.mutate({ e, reconciled: ev.target.checked })}
                            disabled={toggle.isPending}
                          />
                        </span>
                      </Tooltip>
                    </TableCell>
                  )}
                  <TableCell width={90}>{dayjs(e.date).format('DD/MM/YY')}</TableCell>
                  <TableCell>{e.description}</TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      color={e.type === 'INCOME' ? 'success.main' : 'error.main'}
                    >
                      {e.type === 'INCOME' ? '+' : '−'} {fmt(e.amount)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Fechar</Button></DialogActions>
    </Dialog>
  );
}

/**
 * Extrato de tudo que passou pelas contas no período.
 *
 * Morava no fim do Fluxo de Caixa, onde disputava a tela com a projeção — duas
 * perguntas diferentes no mesmo lugar. "O que passou pela conta" é exatamente a
 * pergunta desta tela.
 */
function MovementsBlock() {
  const compact = useCompact();
  const { from, to, setRange } = useFinancialPeriod();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);

  const start = dayjs(from);
  const end = dayjs(to);
  const params = {
    startDate: start.startOf('day').toISOString(),
    endDate: end.endOf('day').toISOString(),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['cash-flow', params.startDate, params.endDate, page, limit, search],
    queryFn: () => api.get('/financial/cash-flow', {
      params: { ...params, page: page + 1, limit, search: search || undefined },
    }).then(r => r.data),
  });

  const exportCsv = async () => {
    const res = await api.get('/financial/cash-flow/export', { params, responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `movimentacoes-${start.format('YYYY-MM-DD')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const entries = data?.entries ?? [];
  const total = data?.entriesTotal ?? 0;

  const shiftMonth = (delta: number) => {
    const next = start.add(delta, 'month');
    setRange(next.startOf('month').format('YYYY-MM-DD'), next.endOf('month').format('YYYY-MM-DD'));
  };

  return (
    <Box mt={4}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="subtitle1" fontWeight={600}>Movimentações</Typography>
        <Button size="small" onClick={() => shiftMonth(-1)}>◀</Button>
        <Typography variant="body2" color="text.secondary">
          {start.format('DD/MM/YYYY')} a {end.format('DD/MM/YYYY')}
        </Typography>
        <Button size="small" onClick={() => shiftMonth(1)}>▶</Button>
        <Box sx={{ flexGrow: 1 }} />
        <TextField
          size="small"
          placeholder="Buscar por descrição, cliente ou categoria"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          InputProps={{ startAdornment: <Search fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} /> }}
          sx={{ minWidth: 300 }}
        />
        <Button variant="outlined" size="small" startIcon={<Download />} onClick={exportCsv}>
          Exportar
        </Button>
      </Box>

      {compact ? (
        <Stack spacing={1}>
          {isLoading && [0, 1, 2].map(i => <Skeleton key={i} variant="rounded" height={78} />)}
          {!isLoading && entries.map((t: any) => (
            <Paper key={`${t.source}-${t.id}`} variant="outlined" sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600}>{t.description}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {dayjs(t.date).format('DD/MM HH:mm')}
                    {t.party && ` · ${t.party}`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {[t.category, METHOD_LABELS[t.method] ?? t.method].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                <Typography
                  variant="body1"
                  fontWeight={700}
                  color={t.type === 'INCOME' ? 'success.main' : 'error.main'}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  {t.type === 'INCOME' ? '+' : '−'} {fmt(t.amount)}
                </Typography>
              </Box>
            </Paper>
          ))}
          {!isLoading && entries.length === 0 && (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1" fontWeight={600} gutterBottom>
                {search
                  ? `Nada encontrado para "${search}" neste período.`
                  : `Nenhuma movimentação entre ${start.format('DD/MM')} e ${end.format('DD/MM')}.`}
              </Typography>
              {!search && (
                <Typography variant="body2" color="text.secondary">
                  As entradas aparecem aqui quando você recebe uma conta ou lança uma venda no
                  caixa; as saídas, quando você paga uma conta ou faz uma sangria.
                </Typography>
              )}
            </Paper>
          )}
        </Stack>
      ) : (
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Data</TableCell>
              <TableCell>Descrição</TableCell>
              <TableCell>Cliente / Fornecedor</TableCell>
              <TableCell>Categoria</TableCell>
              <TableCell>Forma</TableCell>
              <TableCell align="right">Valor</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>{[1, 2, 3, 4, 5, 6].map(j => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
            )) : entries.map((t: any) => (
              <TableRow key={`${t.source}-${t.id}`} hover>
                <TableCell>{dayjs(t.date).format('DD/MM HH:mm')}</TableCell>
                <TableCell>
                  {t.description}
                  {t.source === 'CASH' && (
                    <Tooltip title="Lançamento avulso do caixa, sem conta vinculada">
                      <Chip label="avulso" size="small" variant="outlined" sx={{ ml: 1, height: 18, fontSize: 11 }} />
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell>{t.party ?? '—'}</TableCell>
                <TableCell>{t.category ?? '—'}</TableCell>
                <TableCell>{METHOD_LABELS[t.method] ?? t.method}</TableCell>
                <TableCell align="right">
                  {/* O sinal e a cor já dizem entrada ou saída; a coluna "Tipo"
                      com um chip era a terceira vez que a mesma coisa aparecia. */}
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    color={t.type === 'INCOME' ? 'success.main' : 'error.main'}
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.3 }}
                  >
                    {t.type === 'INCOME'
                      ? <ArrowUpward sx={{ fontSize: 14 }} />
                      : <ArrowDownward sx={{ fontSize: 14 }} />}
                    {fmt(t.amount)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
                    <Typography variant="body1" fontWeight={600} gutterBottom>
                      {search
                        ? `Nada encontrado para "${search}" neste período.`
                        : `Nenhuma movimentação entre ${start.format('DD/MM')} e ${end.format('DD/MM')}.`}
                    </Typography>
                    {!search && (
                      <Typography variant="body2" color="text.secondary">
                        As entradas aparecem aqui quando você recebe uma conta ou lança uma venda no
                        caixa; as saídas, quando você paga uma conta ou faz uma sangria.
                      </Typography>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {/* Paginação para dez lançamentos é ruído; ela aparece quando a lista
            realmente passa de uma página. */}
        {total > limit && (
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={limit}
            onRowsPerPageChange={e => { setLimit(Number(e.target.value)); setPage(0); }}
            rowsPerPageOptions={[20, 50, 100, 200]}
            labelRowsPerPage="Por página"
            labelDisplayedRows={({ from: f, to: t, count }) => `${f}–${t} de ${count}`}
          />
        )}
      </TableContainer>
      )}
    </Box>
  );
}

/**
 * Onde o dinheiro está.
 *
 * Antes só a gaveta tinha saldo: o que entrava por Pix ou cartão virava um
 * pagamento e não somava em lugar nenhum, e a sangria tirava da gaveta sem o
 * dinheiro chegar em conta alguma.
 */
export default function AccountsSection() {
  const qc = useQueryClient();
  const toast = useToast();
  const compact = useCompact();
  const [dialog, setDialog] = useState<{ open: boolean; account: any }>({ open: false, account: null });
  const [transferOpen, setTransferOpen] = useState(false);
  const [statement, setStatement] = useState<any>(null);
  const [removeTarget, setRemoveTarget] = useState<any>(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['financial-accounts'],
    queryFn: () => api.get('/financial/accounts').then(r => r.data),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/financial/accounts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-accounts'] });
      setRemoveTarget(null);
      toast('Conta removida');
    },
    onError: (e: any) => { setRemoveTarget(null); toast(apiError(e, 'Erro ao remover'), 'error'); },
  });

  const rows = accounts as any[];
  const operational = rows.filter(a => a.active && a.kind !== 'RESERVE');
  const total = operational.reduce((s, a) => s + toNumber(a.balance), 0);
  const reserve = rows.find(a => a.kind === 'RESERVE');

  const pendingReconcile = rows.reduce((s, a) => s + (a.unreconciled ?? 0), 0);
  const toReconcile = rows.filter(a => a.unreconciled > 0)
    .sort((a, b) => b.unreconciled - a.unreconciled)[0];

  return (
    <Box>
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6}>
          <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
            <CardContent>
              <Typography variant="body2" sx={{ opacity: 0.85 }}>Disponível hoje</Typography>
              <Typography variant="h4" fontWeight={700}>{fmt(total)}</Typography>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                soma das contas, sem a reserva do ateliê
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary">Reserva do ateliê</Typography>
              <Typography variant="h4" fontWeight={700}>{fmt(reserve?.balance)}</Typography>
              <Typography variant="caption" color="text.secondary">
                dinheiro guardado — não entra na conta do mês
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
        <Button variant="contained" startIcon={<Add />} onClick={() => setDialog({ open: true, account: null })}>
          Nova conta
        </Button>
        <Button variant="outlined" startIcon={<SwapHoriz />} onClick={() => setTransferOpen(true)}>
          Transferir
        </Button>
      </Box>

      {compact ? (
        <Stack spacing={1}>
          {isLoading && [0, 1].map(i => <Skeleton key={i} variant="rounded" height={96} />)}
          {rows.map(a => (
            <Paper key={a.id} variant="outlined" sx={{ p: 1.5, opacity: a.active ? 1 : 0.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {a.name}
                    {a.isDefault && <Chip size="small" label="padrão" sx={{ ml: 1 }} />}
                    {!a.active && <Chip size="small" label="inativa" sx={{ ml: 1 }} />}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {KIND_LABEL[a.kind] ?? a.kind}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h6" fontWeight={700}>{fmt(a.balance)}</Typography>
                  {toNumber(a.pending) > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      + {fmt(a.pending)} a caminho
                    </Typography>
                  )}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                {a.kind === 'CASH_DRAWER' ? (
                  <Typography variant="caption" color="text.secondary">
                    conferida no fechamento do caixa
                  </Typography>
                ) : a.unreconciled > 0 ? (
                  <Button size="small" color="warning" onClick={() => setStatement(a)}>
                    {a.unreconciled} por conferir
                  </Button>
                ) : (
                  <Typography variant="caption" color="text.secondary">tudo conferido</Typography>
                )}
                <Box sx={{ flexGrow: 1 }} />
                <IconButton size="small" onClick={() => setStatement(a)}><Receipt fontSize="small" /></IconButton>
                <IconButton size="small" onClick={() => setDialog({ open: true, account: a })}><Edit fontSize="small" /></IconButton>
                {!a.isSystem && (
                  <IconButton size="small" onClick={() => setRemoveTarget(a)}><Delete fontSize="small" /></IconButton>
                )}
              </Box>
            </Paper>
          ))}
        </Stack>
      ) : (
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Conta</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell align="right">Saldo</TableCell>
              <TableCell>Confere com o banco?</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>{[1, 2, 3, 4, 5].map(j => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
            ))}
            {rows.map(a => (
              <TableRow key={a.id} hover sx={{ opacity: a.active ? 1 : 0.5 }}>
                <TableCell>
                  {a.name}
                  {a.isDefault && <Chip size="small" label="padrão" sx={{ ml: 1 }} />}
                  {!a.active && <Chip size="small" label="inativa" sx={{ ml: 1 }} />}
                </TableCell>
                <TableCell>{KIND_LABEL[a.kind] ?? a.kind}</TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={700}>{fmt(a.balance)}</Typography>
                  {toNumber(a.pending) > 0 && (
                    <Tooltip title="Vendas no cartão que ainda não caíram, já com a taxa descontada">
                      <Typography variant="caption" color="text.secondary" sx={{ cursor: 'help' }}>
                        + {fmt(a.pending)} a caminho
                      </Typography>
                    </Tooltip>
                  )}
                </TableCell>
                {/* A conferência vivia escondida em letra pequena dentro da
                    coluna "Tipo", a dois cliques — o lugar errado para o que
                    separa "o sistema acha que tem" de "o banco confirma". */}
                <TableCell>
                  {a.kind === 'CASH_DRAWER' ? (
                    <Typography variant="caption" color="text.secondary">
                      conferida contando o dinheiro, no fechamento
                    </Typography>
                  ) : a.unreconciled > 0 ? (
                    <Button size="small" color="warning" onClick={() => setStatement(a)}>
                      {a.unreconciled} por conferir
                    </Button>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      tudo conferido
                      {a.reconciledUntil && ` até ${dayjs(a.reconciledUntil).format('DD/MM/YY')}`}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Extrato">
                    <IconButton size="small" onClick={() => setStatement(a)}>
                      <Receipt fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Editar">
                    <IconButton size="small" onClick={() => setDialog({ open: true, account: a })}>
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {!a.isSystem && (
                    <Tooltip title="Remover">
                      <IconButton size="small" onClick={() => setRemoveTarget(a)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      )}

      <Typography variant="caption" color="text.secondary" display="block" mt={2}>
        A gaveta é calculada pelos lançamentos do caixa — é o mesmo valor conferido no fechamento.
      </Typography>

      {/* Frase de fecho: a tela responde "onde está" e termina apontando o
          próximo passo, em vez de deixar a usuária decidir sozinha o que fazer
          com o que acabou de ler. */}
      {pendingReconcile > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2">
            <strong>{pendingReconcile}</strong> lançamento(s) ainda não foram conferidos com o banco.
          </Typography>
          <Button size="small" onClick={() => setStatement(toReconcile)}>
            Conferir {toReconcile?.name} →
          </Button>
        </Box>
      )}

      <MovementsBlock />

      <AccountDialog
        open={dialog.open}
        account={dialog.account}
        onClose={() => setDialog({ open: false, account: null })}
      />
      <TransferDialog open={transferOpen} onClose={() => setTransferOpen(false)} accounts={rows} />
      <StatementDialog account={statement} onClose={() => setStatement(null)} />
      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => removeMutation.mutate(removeTarget.id)}
        title="Remover conta"
        message={`Remover "${removeTarget?.name}"? Só é possível se ela nunca teve movimentação.`}
        confirmLabel="Remover"
        confirmColor="error"
        loading={removeMutation.isPending}
      />
    </Box>
  );
}
