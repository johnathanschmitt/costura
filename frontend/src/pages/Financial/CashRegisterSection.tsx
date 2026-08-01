import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  Paper, Divider, Alert, Tooltip,
} from '@mui/material';
import MoneyField from '../../components/common/fields/MoneyField';
import {
  Add, LockOpen, Lock, ArrowUpward, ArrowDownward, InfoOutlined,
  CallMade, CallReceived, Print,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';
import { useToast } from '../../store/toast.store';
import { apiError, fmt, toNumber } from './format';

function OpenRegisterDialog({ open, onClose, onConfirm, loading, error }: any) {
  const [balance, setBalance] = useState<number | null>(0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) { setBalance(0); setNotes(''); }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Abrir Caixa</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <Alert severity="info" icon={<InfoOutlined />}>
          Informe quanto há de <strong>dinheiro em espécie</strong> na gaveta agora. É esse valor
          que será conferido no fechamento.
        </Alert>
        <MoneyField
          label="Dinheiro na gaveta"
          value={balance}
          onChange={setBalance}
          autoFocus
          fullWidth
        />
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
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() => onConfirm(balance ?? 0, notes)}
          disabled={loading}
        >
          Abrir Caixa
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AddTransactionDialog({ open, onClose, onConfirm, loading, error }: any) {
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [category, setCategory] = useState('');

  useEffect(() => {
    if (open) { setType('INCOME'); setDescription(''); setAmount(null); setCategory(''); }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Lançar Dinheiro no Caixa</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <Alert severity="info" icon={<InfoOutlined />}>
          O caixa registra apenas dinheiro em espécie. Recebimentos em Pix ou cartão são lançados
          em Contas a Receber.
        </Alert>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant={type === 'INCOME' ? 'contained' : 'outlined'}
            color="success"
            fullWidth
            startIcon={<ArrowUpward />}
            onClick={() => setType('INCOME')}
          >Entrada</Button>
          <Button
            variant={type === 'EXPENSE' ? 'contained' : 'outlined'}
            color="error"
            fullWidth
            startIcon={<ArrowDownward />}
            onClick={() => setType('EXPENSE')}
          >Saída</Button>
        </Box>
        <TextField label="Descrição" value={description} onChange={e => setDescription(e.target.value)} fullWidth autoFocus required />
        <TextField label="Categoria" value={category} onChange={e => setCategory(e.target.value)} fullWidth placeholder="Ex: material, troco…" />
        <MoneyField label="Valor" value={amount} onChange={setAmount} fullWidth required />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() => onConfirm({ type, description, amount, category: category || undefined })}
          disabled={!description || !amount || loading}
        >
          Lançar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Sangria retira dinheiro da gaveta (depósito, cofre); suprimento coloca (troco).
 * Nenhuma das duas é receita ou despesa — são transferências, e o fluxo de caixa
 * as ignora no resultado.
 */
function TransferDialog({ open, kind, onClose, onConfirm, loading, error, balance }: any) {
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) { setAmount(null); setReason(''); }
  }, [open]);

  const isWithdrawal = kind === 'WITHDRAWAL';
  const value = amount ?? NaN;
  const exceeds = isWithdrawal && value > balance + 0.005;
  const valid = value > 0 && reason.trim() && !exceeds;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{isWithdrawal ? 'Sangria' : 'Suprimento'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <Alert severity="info" icon={<InfoOutlined />}>
          {isWithdrawal
            ? 'Retirada de dinheiro da gaveta para depósito ou cofre. Diminui o caixa, mas não é despesa do ateliê.'
            : 'Entrada de dinheiro na gaveta para formar troco. Aumenta o caixa, mas não é receita.'}
        </Alert>

        <Box sx={{ bgcolor: 'background.default', p: 1.5, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">Dinheiro em caixa agora</Typography>
          <Typography variant="h6" fontWeight={700}>{fmt(balance)}</Typography>
        </Box>

        <MoneyField
          label="Valor"
          value={amount}
          onChange={setAmount}
          error={exceeds}
          helperText={exceeds ? `Não há tanto dinheiro na gaveta (${fmt(balance)})` : ' '}
          autoFocus
          fullWidth
        />
        <TextField
          label="Motivo"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder={isWithdrawal ? 'Ex: depósito no banco' : 'Ex: troco para o dia'}
          required
          fullWidth
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button
          variant="contained"
          color={isWithdrawal ? 'warning' : 'primary'}
          onClick={() => onConfirm({ kind, amount: value, reason })}
          disabled={!valid || loading}
        >
          Registrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Fechamento com conferência: o sistema mostra quanto deveria haver na gaveta,
 * a usuária conta o dinheiro e informa o valor real. A diferença é o resultado
 * que justifica todo o ritual de abrir e fechar o caixa.
 */
function CloseRegisterDialog({ open, onClose, onConfirm, expected, loading, error }: any) {
  const [counted, setCounted] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) { setCounted(null); setNotes(''); }
  }, [open]);

  const countedValue = counted ?? NaN;
  const hasCount = counted !== null && !Number.isNaN(countedValue);
  const difference = hasCount ? countedValue - expected : 0;
  const diverges = hasCount && Math.abs(difference) >= 0.005;
  const needsNotes = diverges && !notes.trim();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Fechar Caixa</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}

        <Box sx={{ bgcolor: 'background.default', p: 1.5, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Deveria haver na gaveta
          </Typography>
          <Typography variant="h5" fontWeight={700}>{fmt(expected)}</Typography>
        </Box>

        <MoneyField
          label="Dinheiro contado"
          value={counted}
          onChange={setCounted}
          helperText="Conte o dinheiro da gaveta e informe o valor real"
          autoFocus
          fullWidth
        />

        {hasCount && (
          diverges ? (
            <Alert severity="warning">
              <strong>
                {difference < 0 ? 'Falta' : 'Sobra'} {fmt(Math.abs(difference))}
              </strong>
              {' '}na gaveta. Explique a diferença abaixo para fechar o caixa.
            </Alert>
          ) : (
            <Alert severity="success">Conferido — o valor contado bate com o esperado.</Alert>
          )
        )}

        <TextField
          label={diverges ? 'Justificativa da diferença *' : 'Observações'}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          fullWidth
          multiline
          rows={2}
          required={diverges}
          error={needsNotes}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => onConfirm({ countedBalance: countedValue, notes: notes || undefined })}
          disabled={!hasCount || needsNotes || loading}
        >
          Fechar Caixa
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function CashRegisterSection() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [openDialog, setOpenDialog] = useState(false);
  const [txDialog, setTxDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [transferKind, setTransferKind] = useState<'WITHDRAWAL' | 'SUPPLY' | null>(null);
  const [dialogError, setDialogError] = useState('');

  const { data: current } = useQuery({
    queryKey: ['cash-register-current'],
    queryFn: () => api.get('/financial/cash-register/current').then(r => r.data),
    refetchInterval: 30_000,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['cash-transactions', current?.id],
    queryFn: () => api.get(`/financial/cash-register/${current.id}/transactions`).then(r => r.data),
    enabled: Boolean(current?.id),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['cash-register-current'] });
    qc.invalidateQueries({ queryKey: ['cash-transactions'] });
    qc.invalidateQueries({ queryKey: ['financial-summary'] });
  };

  const openMutation = useMutation({
    mutationFn: (body: any) => api.post('/financial/cash-register/open', body),
    onSuccess: () => { refresh(); setOpenDialog(false); toast('Caixa aberto'); },
    onError: (e: any) => setDialogError(apiError(e, 'Erro ao abrir o caixa')),
  });

  const closeMutation = useMutation({
    mutationFn: (body: any) => api.patch(`/financial/cash-register/${current?.id}/close`, body),
    onSuccess: res => {
      refresh();
      setCloseDialog(false);
      const diff = toNumber(res.data.difference);
      toast(
        Math.abs(diff) < 0.005
          ? 'Caixa fechado — valores conferem'
          : `Caixa fechado com ${diff < 0 ? 'falta' : 'sobra'} de ${fmt(Math.abs(diff))}`,
        Math.abs(diff) < 0.005 ? 'success' : 'warning',
      );
      // O relatório de fechamento é o registro do que acabou de ser conferido.
      navigate(`/financial/cash-register/${res.data.id}/report`);
    },
    onError: (e: any) => setDialogError(apiError(e, 'Erro ao fechar o caixa')),
  });

  const txMutation = useMutation({
    mutationFn: (data: any) => api.post(`/financial/cash-register/${current?.id}/transaction`, data),
    onSuccess: () => { refresh(); setTxDialog(false); toast('Lançamento registrado'); },
    onError: (e: any) => setDialogError(apiError(e, 'Erro ao lançar')),
  });

  const transferMutation = useMutation({
    mutationFn: (data: any) => api.post(`/financial/cash-register/${current?.id}/transfer`, data),
    onSuccess: (_res, vars: any) => {
      refresh();
      setTransferKind(null);
      toast(vars.kind === 'WITHDRAWAL' ? 'Sangria registrada' : 'Suprimento registrado');
    },
    onError: (e: any) => setDialogError(apiError(e, 'Erro ao registrar')),
  });

  const openWith = (setter: (v: boolean) => void) => { setDialogError(''); setter(true); };

  // Totais vêm do servidor: não dependem de a lista de transações ter carregado.
  const income = toNumber(current?.income);
  const expense = toNumber(current?.expense);
  const expected = toNumber(current?.expectedBalance);

  return (
    <Box>
      {!current ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="h6" color="text.secondary" mb={1}>Nenhum caixa aberto</Typography>
          <Typography variant="body2" color="text.secondary" mb={3} sx={{ maxWidth: 460, mx: 'auto' }}>
            O caixa controla o dinheiro em espécie da gaveta. Abra informando quanto há agora;
            no fechamento você confere o valor contado com o esperado.
          </Typography>
          <Button variant="contained" startIcon={<LockOpen />} onClick={() => openWith(setOpenDialog)} size="large">
            Abrir Caixa
          </Button>
        </Box>
      ) : (
        <>
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">Abertura</Typography>
                  <Typography variant="h5" fontWeight={700}>{fmt(current.openingBalance)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {dayjs(current.openedAt).format('DD/MM/YYYY HH:mm')}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">Entradas em dinheiro</Typography>
                  <Typography variant="h5" fontWeight={700} color="success.main">{fmt(income)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {transactions.filter((t: any) => t.type === 'INCOME').length} lançamentos
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">Saídas em dinheiro</Typography>
                  <Typography variant="h5" fontWeight={700} color="error.main">{fmt(expense)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {transactions.filter((t: any) => t.type === 'EXPENSE').length} lançamentos
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>Esperado na gaveta</Typography>
                    <Tooltip title="Quanto deveria haver em espécie. Confira no fechamento.">
                      <InfoOutlined sx={{ fontSize: 14, opacity: 0.8 }} />
                    </Tooltip>
                  </Box>
                  <Typography variant="h5" fontWeight={700}>{fmt(expected)}</Typography>
                  <Chip label="Aberto" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', mt: 0.5 }} />
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
            <Button variant="contained" startIcon={<Add />} onClick={() => openWith(setTxDialog)}>
              Lançar Dinheiro
            </Button>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<CallMade />}
              onClick={() => { setDialogError(''); setTransferKind('WITHDRAWAL'); }}
            >
              Sangria
            </Button>
            <Button
              variant="outlined"
              startIcon={<CallReceived />}
              onClick={() => { setDialogError(''); setTransferKind('SUPPLY'); }}
            >
              Suprimento
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button variant="outlined" color="error" startIcon={<Lock />} onClick={() => openWith(setCloseDialog)}>
              Fechar Caixa
            </Button>
          </Box>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Hora</TableCell>
                  <TableCell>Descrição</TableCell>
                  <TableCell>Categoria</TableCell>
                  <TableCell>Origem</TableCell>
                  <TableCell align="right">Valor</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="text.secondary" py={2}>
                        Nenhuma movimentação de dinheiro ainda
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {transactions.map((t: any) => (
                  <TableRow key={t.id} hover>
                    <TableCell>{dayjs(t.createdAt).format('HH:mm')}</TableCell>
                    <TableCell>{t.description}</TableCell>
                    <TableCell>{t.category ?? '—'}</TableCell>
                    <TableCell>
                      <Chip
                        label={t.payment ? 'Baixa de conta' : 'Avulso'}
                        size="small"
                        variant="outlined"
                        color={t.payment ? 'primary' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        color={t.type === 'INCOME' ? 'success.main' : 'error.main'}
                      >
                        {t.type === 'INCOME' ? '+' : '-'} {fmt(t.amount)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" color="text.secondary">
            Apenas movimentações em espécie aparecem aqui. Recebimentos em Pix, cartão ou
            transferência ficam em Contas a Receber e no Fluxo de Caixa.
          </Typography>
        </>
      )}

      <OpenRegisterDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onConfirm={(openingBalance: number, notes: string) => openMutation.mutate({ openingBalance, notes: notes || undefined })}
        loading={openMutation.isPending}
        error={dialogError}
      />

      <AddTransactionDialog
        open={txDialog}
        onClose={() => setTxDialog(false)}
        onConfirm={(data: any) => txMutation.mutate(data)}
        loading={txMutation.isPending}
        error={dialogError}
      />

      <CloseRegisterDialog
        open={closeDialog}
        onClose={() => setCloseDialog(false)}
        onConfirm={(body: any) => closeMutation.mutate(body)}
        expected={expected}
        loading={closeMutation.isPending}
        error={dialogError}
      />

      <TransferDialog
        open={Boolean(transferKind)}
        kind={transferKind}
        onClose={() => setTransferKind(null)}
        onConfirm={(body: any) => transferMutation.mutate(body)}
        loading={transferMutation.isPending}
        error={dialogError}
        balance={expected}
      />
    </Box>
  );
}
