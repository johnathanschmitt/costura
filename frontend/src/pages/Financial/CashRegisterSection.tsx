import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  Paper, FormControl, InputLabel, Select, MenuItem, Divider, Alert,
} from '@mui/material';
import { Add, LockOpen, Lock, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import api from '../../services/api';
import ConfirmDialog from '../../components/common/ConfirmDialog';

const METHODS = ['PIX', 'CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'TRANSFER', 'CHECK', 'OTHER'];
const METHOD_LABELS: Record<string, string> = {
  PIX: 'Pix', CASH: 'Dinheiro', CREDIT_CARD: 'Crédito', DEBIT_CARD: 'Débito',
  TRANSFER: 'Transferência', CHECK: 'Cheque', OTHER: 'Outro',
};

function OpenRegisterDialog({ open, onClose, onConfirm }: any) {
  const [balance, setBalance] = useState('0');
  const [notes, setNotes] = useState('');
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Abrir Caixa</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <TextField
          label="Saldo de abertura (R$)"
          type="number"
          value={balance}
          onChange={e => setBalance(e.target.value)}
          inputProps={{ min: 0, step: 0.01 }}
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
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={() => onConfirm(parseFloat(balance) || 0, notes)}>
          Abrir Caixa
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AddTransactionDialog({ open, onClose, onConfirm, registerId }: any) {
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [category, setCategory] = useState('');

  const handleConfirm = () => {
    onConfirm({ type, description, amount: parseFloat(amount), paymentMethod: method, category: category || null });
    setDescription(''); setAmount(''); setCategory('');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Lançar Transação</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
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
        <TextField label="Categoria" value={category} onChange={e => setCategory(e.target.value)} fullWidth placeholder="Ex: aluguel, material…" />
        <TextField
          label="Valor (R$)"
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          inputProps={{ min: 0.01, step: 0.01 }}
          fullWidth
          required
        />
        <FormControl fullWidth>
          <InputLabel>Forma</InputLabel>
          <Select value={method} label="Forma" onChange={e => setMethod(e.target.value)}>
            {METHODS.map(m => <MenuItem key={m} value={m}>{METHOD_LABELS[m]}</MenuItem>)}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleConfirm} disabled={!description || !amount}>
          Lançar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function CashRegisterSection() {
  const qc = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const [txDialog, setTxDialog] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);

  const { data: current, isLoading } = useQuery({
    queryKey: ['cash-register-current'],
    queryFn: () => api.get('/financial/cash-register/current').then(r => r.data),
    refetchInterval: 30_000,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['cash-transactions', current?.id],
    queryFn: () => api.get(`/financial/cash-register/${current.id}/transactions`).then(r => r.data),
    enabled: Boolean(current?.id),
  });

  const openMutation = useMutation({
    mutationFn: ({ openingBalance, notes }: any) => api.post('/financial/cash-register/open', { openingBalance, notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash-register-current'] }); setOpenDialog(false); },
  });

  const closeMutation = useMutation({
    mutationFn: () => api.patch(`/financial/cash-register/${current?.id}/close`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash-register-current'] }); setCloseConfirm(false); },
  });

  const txMutation = useMutation({
    mutationFn: (data: any) => api.post(`/financial/cash-register/${current?.id}/transaction`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-transactions', current?.id] });
      qc.invalidateQueries({ queryKey: ['cash-register-current'] });
      setTxDialog(false);
    },
  });

  const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n ?? 0);

  const income = transactions.filter((t: any) => t.type === 'INCOME').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const expense = transactions.filter((t: any) => t.type === 'EXPENSE').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const balance = Number(current?.openingBalance ?? 0) + income - expense;

  return (
    <Box>
      {!current ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="h6" color="text.secondary" mb={2}>Nenhum caixa aberto</Typography>
          <Button variant="contained" startIcon={<LockOpen />} onClick={() => setOpenDialog(true)} size="large">
            Abrir Caixa
          </Button>
        </Box>
      ) : (
        <>
          {/* Resumo do caixa */}
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
                  <Typography variant="caption" color="text.secondary">Entradas</Typography>
                  <Typography variant="h5" fontWeight={700} color="success.main">{fmt(income)}</Typography>
                  <Typography variant="caption" color="text.secondary">{transactions.filter((t: any) => t.type === 'INCOME').length} transações</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">Saídas</Typography>
                  <Typography variant="h5" fontWeight={700} color="error.main">{fmt(expense)}</Typography>
                  <Typography variant="caption" color="text.secondary">{transactions.filter((t: any) => t.type === 'EXPENSE').length} transações</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
                <CardContent>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>Saldo atual</Typography>
                  <Typography variant="h5" fontWeight={700}>{fmt(balance)}</Typography>
                  <Chip label="Aberto" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', mt: 0.5 }} />
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Ações */}
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
            <Button variant="contained" startIcon={<Add />} onClick={() => setTxDialog(true)}>
              Lançar Transação
            </Button>
            <Button variant="outlined" color="error" startIcon={<Lock />} onClick={() => setCloseConfirm(true)}>
              Fechar Caixa
            </Button>
          </Box>

          {/* Transações */}
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Hora</TableCell>
                  <TableCell>Descrição</TableCell>
                  <TableCell>Categoria</TableCell>
                  <TableCell>Forma</TableCell>
                  <TableCell align="right">Valor</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="text.secondary" py={2}>Nenhuma transação ainda</Typography>
                    </TableCell>
                  </TableRow>
                )}
                {[...transactions].reverse().map((t: any) => (
                  <TableRow key={t.id} hover>
                    <TableCell>{dayjs(t.createdAt).format('HH:mm')}</TableCell>
                    <TableCell>{t.description}</TableCell>
                    <TableCell>{t.category ?? '—'}</TableCell>
                    <TableCell>{METHOD_LABELS[t.paymentMethod] ?? t.paymentMethod}</TableCell>
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
        </>
      )}

      <OpenRegisterDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onConfirm={(balance: number, notes: string) => openMutation.mutate({ openingBalance: balance, notes })}
      />

      <AddTransactionDialog
        open={txDialog}
        onClose={() => setTxDialog(false)}
        onConfirm={(data: any) => txMutation.mutate(data)}
        registerId={current?.id}
      />

      <ConfirmDialog
        open={closeConfirm}
        onClose={() => setCloseConfirm(false)}
        onConfirm={() => closeMutation.mutate()}
        title="Fechar Caixa"
        message={`Fechar o caixa com saldo de ${fmt(balance)}? Esta ação não pode ser desfeita.`}
        confirmLabel="Fechar Caixa"
        confirmColor="error"
        loading={closeMutation.isPending}
      />
    </Box>
  );
}
