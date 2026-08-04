import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  Paper, Divider, Alert, Tooltip, FormControl, InputLabel, Select, MenuItem,
  Collapse, Stepper, Step, StepLabel, Stack,
} from '@mui/material';
import MoneyField from '../../components/common/fields/MoneyField';
import {
  Add, LockOpen, Lock, ArrowUpward, ArrowDownward, InfoOutlined,
  CallMade, CallReceived, Undo,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';
import { useToast } from '../../store/toast.store';
import CategorySelect from './CategorySelect';
import ReversePaymentDialog from './ReversePaymentDialog';
import { useCompact } from '../../hooks/useCompact';
import { apiError, fmt, toNumber } from './format';

/** Destinos padronizados — precisam bater com CASH_COUNTERPARTS do backend. */
const COUNTERPARTS = ['Banco', 'Cofre', 'Fornecedor', 'Retirada de sócia', 'Outro'];

/** Cédulas e moedas em circulação, da maior para a menor. */
const NOTES = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.25, 0.1, 0.05];

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
          Abrir o caixa com {fmt(balance ?? 0)}
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
          em Contas do mês.
        </Alert>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant={type === 'INCOME' ? 'contained' : 'outlined'}
            color="success"
            fullWidth
            startIcon={<ArrowUpward />}
            // Trocar o tipo troca a lista de categorias: a que estava escolhida
            // não existe do outro lado.
            onClick={() => { setType('INCOME'); setCategory(''); }}
          >Entrada</Button>
          <Button
            variant={type === 'EXPENSE' ? 'contained' : 'outlined'}
            color="error"
            fullWidth
            startIcon={<ArrowDownward />}
            onClick={() => { setType('EXPENSE'); setCategory(''); }}
          >Saída</Button>
        </Box>
        <TextField label="Descrição" value={description} onChange={e => setDescription(e.target.value)} fullWidth autoFocus required />
        {/* Categoria da lista, não texto livre: o DRE agrupa pelo nome, então
            "material" digitado à mão virava uma linha separada de "Materiais". */}
        <CategorySelect type={type} value={category} onChange={setCategory} size="medium" />
        <MoneyField label="Valor" value={amount} onChange={setAmount} fullWidth required />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() => onConfirm({ type, description, amount, category: category || undefined })}
          disabled={!description || !amount || loading}
        >
          {amount
            ? `Lançar ${fmt(amount)} ${type === 'INCOME' ? 'na' : 'da'} gaveta`
            : 'Lançar na gaveta'}
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
  const [counterpart, setCounterpart] = useState('Banco');
  const [accountId, setAccountId] = useState('');

  const { data: accounts = [] } = useQuery({
    queryKey: ['financial-accounts'],
    queryFn: () => api.get('/financial/accounts').then(r => r.data),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (open) {
      setAmount(null);
      setReason('');
      setCounterpart(kind === 'WITHDRAWAL' ? 'Banco' : 'Cofre');
      // Sugere a conta padrão: é para lá que o depósito costuma ir.
      setAccountId((accounts as any[]).find(a => a.isDefault)?.id ?? '');
    }
  }, [open, kind, accounts]);

  const isWithdrawal = kind === 'WITHDRAWAL';
  const value = amount ?? NaN;
  const exceeds = isWithdrawal && value > balance + 0.005;
  const valid = value > 0 && reason.trim() && counterpart && !exceeds;

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
        {/* Sem destino o dinheiro sai da gaveta e some do sistema. Lista fixa
            porque texto livre não vira relatório. */}
        <FormControl fullWidth required>
          <InputLabel>{isWithdrawal ? 'Para onde vai' : 'De onde veio'}</InputLabel>
          <Select
            value={counterpart}
            label={isWithdrawal ? 'Para onde vai' : 'De onde veio'}
            onChange={e => { setCounterpart(e.target.value); setAccountId(''); }}
          >
            {COUNTERPARTS.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>

        {/* Escolhendo a conta, o dinheiro que sai da gaveta entra no saldo dela
            em vez de simplesmente sumir. */}
        {['Banco', 'Cofre'].includes(counterpart) && (
          <FormControl fullWidth>
            <InputLabel>Conta</InputLabel>
            <Select value={accountId} label="Conta" onChange={e => setAccountId(e.target.value)}>
              <MenuItem value="">Não registrar em conta</MenuItem>
              {(accounts as any[])
                .filter(a => a.active && a.kind !== 'CASH_DRAWER')
                .map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
            </Select>
          </FormControl>
        )}

        <TextField
          label="Motivo"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder={isWithdrawal ? 'Ex: depósito da semana' : 'Ex: troco para o dia'}
          required
          fullWidth
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button
          variant="contained"
          color={isWithdrawal ? 'warning' : 'primary'}
          onClick={() => onConfirm({ kind, amount: value, reason, counterpart, accountId: accountId || undefined })}
          disabled={!valid || loading}
        >
          {valid
            ? isWithdrawal
              ? `Tirar ${fmt(value)} da gaveta`
              : `Colocar ${fmt(value)} na gaveta`
            : isWithdrawal ? 'Tirar da gaveta' : 'Colocar na gaveta'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Fechamento com conferência, em três passos: conte o dinheiro → confira a
 * diferença → assine.
 *
 * Tudo isto já funcionava numa tela só, e é justamente por caber numa tela só
 * que a contagem por cédula ficava escondida atrás de um link e a diferença
 * aparecia no meio do formulário. Separado em passos, cada momento tem uma
 * pergunta e uma resposta — e o fechamento é feito de pé, no fim do dia, por
 * quem está com pressa.
 */
function CloseRegisterDialog({ open, onClose, onConfirm, expected, loading, error, blind }: any) {
  const [step, setStep] = useState(0);
  const [counted, setCounted] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [notesCount, setNotesCount] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) { setStep(0); setCounted(null); setNotes(''); setNotesCount({}); setShowNotes(false); }
  }, [open]);

  // Soma da contagem por cédula. Quando a usuária usa esse caminho, ela manda no
  // valor contado — digitar duas vezes só criaria divergência.
  const breakdownTotal = NOTES.reduce(
    (s, note) => s + note * (Number(notesCount[String(note)]) || 0), 0,
  );
  const usingBreakdown = showNotes && breakdownTotal > 0;
  const countedValue = usingBreakdown ? breakdownTotal : (counted ?? NaN);

  const hasCount = !Number.isNaN(countedValue) && (usingBreakdown || counted !== null);
  const difference = hasCount ? countedValue - expected : 0;
  const diverges = hasCount && Math.abs(difference) >= 0.005;
  const needsNotes = diverges && !notes.trim();
  // Na conferência às cegas o esperado só aparece depois da contagem — mostrar
  // antes transforma o número da tela na resposta.
  const revealExpected = !blind || hasCount;

  const breakdownPayload = usingBreakdown
    ? Object.fromEntries(
        NOTES
          .filter(n => Number(notesCount[String(n)]) > 0)
          .map(n => [String(n), Number(notesCount[String(n)])]),
      )
    : undefined;

  const STEPS = ['Conte o dinheiro', 'Confira a diferença', 'Assine'];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 0 }}>Fechar o caixa</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <Stepper activeStep={step} alternativeLabel sx={{ mb: 1 }}>
          {STEPS.map(s => <Step key={s}><StepLabel>{s}</StepLabel></Step>)}
        </Stepper>

        {error && <Alert severity="error">{error}</Alert>}

        {/* 1 — Conte. Na conferência às cegas o esperado nem aparece: mostrar
            antes transforma o número da tela na resposta. */}
        {step === 0 && (
          <>
            <MoneyField
              label="Dinheiro contado"
              value={usingBreakdown ? breakdownTotal : counted}
              onChange={setCounted}
              disabled={usingBreakdown}
              helperText={
                usingBreakdown
                  ? 'Somado a partir da contagem por cédula'
                  : 'Conte o dinheiro da gaveta e informe o valor real'
              }
              autoFocus
              fullWidth
            />

            <Box>
              <Button size="small" onClick={() => setShowNotes(s => !s)}>
                {showNotes ? 'ocultar contagem por cédula' : 'contar por cédula'}
              </Button>
              <Collapse in={showNotes}>
                <Grid container spacing={1} sx={{ mt: 0.5 }}>
                  {NOTES.map(note => (
                    <Grid item xs={4} key={note}>
                      <TextField
                        label={note >= 1 ? `R$ ${note}` : `${(note * 100).toFixed(0)} centavos`}
                        value={notesCount[String(note)] ?? ''}
                        onChange={e => setNotesCount(c => ({ ...c, [String(note)]: e.target.value.replace(/\D/g, '') }))}
                        size="small"
                        fullWidth
                        inputProps={{ inputMode: 'numeric' }}
                      />
                    </Grid>
                  ))}
                  <Grid item xs={12}>
                    <Typography variant="body2" fontWeight={600}>
                      Total contado: {fmt(breakdownTotal)}
                    </Typography>
                  </Grid>
                </Grid>
              </Collapse>
            </Box>

            {!blind && (
              <Typography variant="caption" color="text.secondary">
                O sistema espera {fmt(expected)} na gaveta.
              </Typography>
            )}
          </>
        )}

        {/* 2 — Confira. A frase que interessa, em vez de três números. */}
        {step === 1 && (
          <>
            <Box sx={{ bgcolor: 'background.default', p: 2, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
                <Typography variant="body2" color="text.secondary">O sistema esperava</Typography>
                <Typography variant="body2">{fmt(expected)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
                <Typography variant="body2" color="text.secondary">Você contou</Typography>
                <Typography variant="body2">{fmt(countedValue)}</Typography>
              </Box>
            </Box>

            {diverges ? (
              <Alert severity="warning">
                <strong>{difference < 0 ? 'Faltam' : 'Sobram'} {fmt(Math.abs(difference))}</strong>{' '}
                na gaveta. Quer registrar uma justificativa?
              </Alert>
            ) : (
              <Alert severity="success">Fechou certinho — o contado bate com o esperado.</Alert>
            )}

            <TextField
              label={diverges ? 'Justificativa da diferença *' : 'Observações (opcional)'}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={diverges ? 'Ex.: dei troco a mais numa venda de manhã' : ''}
              fullWidth
              multiline
              rows={2}
              autoFocus={diverges}
              required={diverges}
              error={needsNotes}
              helperText={needsNotes ? 'Sem a justificativa a diferença fica sem explicação no histórico' : ' '}
            />

            {revealExpected && !diverges && (
              <Button size="small" onClick={() => setStep(0)}>contar de novo</Button>
            )}
          </>
        )}

        {/* 3 — Assine. A última tela repete o que vai ser gravado. */}
        {step === 2 && (
          <Box sx={{ py: 1 }}>
            <Typography variant="body1" gutterBottom>
              Vou fechar o caixa com <strong>{fmt(countedValue)}</strong> contados na gaveta.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {diverges
                ? `Fica registrada uma ${difference < 0 ? 'falta' : 'sobra'} de ${fmt(Math.abs(difference))}, com a justificativa acima.`
                : 'O valor bate com o esperado — nenhuma diferença a explicar.'}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" mt={2}>
              Depois de fechar, o relatório do dia abre para impressão. O caixa fechado não aceita
              lançamentos novos.
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={step === 0 ? onClose : () => setStep(s => s - 1)} disabled={loading}>
          {step === 0 ? 'Cancelar' : 'Voltar'}
        </Button>
        {step < 2 ? (
          <Button
            variant="contained"
            onClick={() => setStep(s => s + 1)}
            disabled={step === 0 ? !hasCount : needsNotes}
          >
            {step === 0 ? 'Conferir' : 'Continuar'}
          </Button>
        ) : (
          <Button
            variant="contained"
            color="error"
            onClick={() => onConfirm({
              countedBalance: countedValue,
              countBreakdown: breakdownPayload,
              notes: notes || undefined,
            })}
            disabled={loading}
          >
            Fechar o caixa com {fmt(countedValue)}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default function CashRegisterSection() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const compact = useCompact();
  const [openDialog, setOpenDialog] = useState(false);
  const [txDialog, setTxDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [transferKind, setTransferKind] = useState<'WITHDRAWAL' | 'SUPPLY' | null>(null);
  const [reversing, setReversing] = useState<any | null>(null);
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
      // O relatório fica a um clique, não no caminho: fechar o caixa é o fim do
      // dia, e a maioria dos dias não precisa de papel nenhum. Quem quiser o
      // registro pede aqui — ou depois, em "ver caixas anteriores".
      toast(
        Math.abs(diff) < 0.005
          ? 'Caixa fechado — valores conferem'
          : `Caixa fechado com ${diff < 0 ? 'falta' : 'sobra'} de ${fmt(Math.abs(diff))}`,
        Math.abs(diff) < 0.005 ? 'success' : 'warning',
        {
          label: 'Ver relatório',
          onClick: () => navigate(`/financial/cash-register/${res.data.id}/report`),
        },
      );
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

  // A coluna de autoria só ganha o seu espaço quando há mais de um nome nela.
  const showWho = new Set(
    (transactions as any[]).map(t => t.user?.name).filter(Boolean),
  ).size > 1;

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
            Abrir o caixa
          </Button>
          <Box mt={2}>
            <Button size="small" onClick={() => navigate('/financial/caixas')}>
              ver caixas anteriores
            </Button>
          </Box>
        </Box>
      ) : (
        <>
          {/* Dos quatro números do topo, só um decide alguma coisa: quanto
              deveria haver na gaveta. Abertura, entradas e saídas são o
              detalhe de como se chegou nele. */}
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} md={5}>
              <Card sx={{ bgcolor: 'primary.main', color: 'white', height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>Esperado na gaveta</Typography>
                    <Tooltip title="Quanto deveria haver em espécie. Confira no fechamento.">
                      <InfoOutlined sx={{ fontSize: 14, opacity: 0.8 }} />
                    </Tooltip>
                  </Box>
                  <Typography variant="h3" fontWeight={700}>{fmt(expected)}</Typography>
                  <Chip label="Caixa aberto" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', mt: 0.5 }} />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={7}>
              <Grid container spacing={2} sx={{ height: '100%' }}>
                <Grid item xs={12} sm={4}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">Abertura</Typography>
                      <Typography variant="h6" fontWeight={700}>{fmt(current.openingBalance)}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {dayjs(current.openedAt).format('DD/MM HH:mm')}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">Entrou em dinheiro</Typography>
                      <Typography variant="h6" fontWeight={700} color="success.main">{fmt(income)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {transactions.filter((t: any) => t.type === 'INCOME').length} lançamentos
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">Saiu em dinheiro</Typography>
                      <Typography variant="h6" fontWeight={700} color="error.main">{fmt(expense)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {transactions.filter((t: any) => t.type === 'EXPENSE').length} lançamentos
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
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
              Conferir e fechar o caixa
            </Button>
          </Box>

          {/* No telefone as sete colunas viram rolagem de lado; cada lançamento
              vira um cartão, que é como ela lê de pé no balcão. */}
          {compact ? (
            <Stack spacing={1}>
              {transactions.length === 0 && (
                <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body1" fontWeight={600} gutterBottom>
                    Nenhum dinheiro entrou ou saiu da gaveta hoje.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    As linhas aparecem aqui quando você recebe uma conta em dinheiro, lança uma
                    venda avulsa ou faz uma sangria.
                  </Typography>
                </Paper>
              )}
              {transactions.map((t: any) => (
                <Paper key={t.id} variant="outlined" sx={{ p: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600}>{t.description}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {dayjs(t.createdAt).format('HH:mm')}
                        {t.category && ` · ${t.category}`}
                        {showWho && t.user?.name && ` · ${t.user.name}`}
                      </Typography>
                    </Box>
                    <Typography
                      variant="body1"
                      fontWeight={700}
                      color={t.type === 'INCOME' ? 'success.main' : 'error.main'}
                      sx={{ textDecoration: t.payment?.reversedAt ? 'line-through' : undefined, whiteSpace: 'nowrap' }}
                    >
                      {t.type === 'INCOME' ? '+' : '-'} {fmt(t.amount)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <Chip
                      label={t.kind === 'REVERSAL' ? 'Estorno' : t.payment ? 'Baixa de conta' : 'Avulso'}
                      size="small"
                      variant="outlined"
                      color={t.kind === 'REVERSAL' ? 'warning' : t.payment ? 'primary' : 'default'}
                    />
                    <Box sx={{ flexGrow: 1 }} />
                    {t.payment && !t.payment.reversedAt && (
                      <Button size="small" startIcon={<Undo />} onClick={() => setReversing(t.payment)}>
                        Desfazer
                      </Button>
                    )}
                    {t.payment?.reversedAt && (
                      <Chip size="small" label="estornada" color="warning" variant="outlined" />
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
                  <TableCell>Hora</TableCell>
                  <TableCell>Descrição</TableCell>
                  <TableCell>Categoria</TableCell>
                  {/* Com uma pessoa só operando, esta coluna repete o mesmo nome
                      em toda linha. Ela volta sozinha no dia da contratação — a
                      autoria continua gravada, é só a tela que não a mostra. */}
                  {showWho && <TableCell>Quem</TableCell>}
                  <TableCell>Origem</TableCell>
                  <TableCell align="right">Valor</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={showWho ? 7 : 6}>
                      <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
                        <Typography variant="body1" fontWeight={600} gutterBottom>
                          Nenhum dinheiro entrou ou saiu da gaveta hoje.
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          As linhas aparecem aqui quando você recebe uma conta em dinheiro, lança
                          uma venda avulsa ou faz uma sangria.
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
                {transactions.map((t: any) => (
                  <TableRow key={t.id} hover>
                    <TableCell>{dayjs(t.createdAt).format('HH:mm')}</TableCell>
                    <TableCell>{t.description}</TableCell>
                    <TableCell>{t.category ?? '—'}</TableCell>
                    {showWho && (
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {t.user?.name ?? '—'}
                        </Typography>
                      </TableCell>
                    )}
                    <TableCell>
                      <Chip
                        label={
                          t.kind === 'REVERSAL' ? 'Estorno'
                            : t.payment ? 'Baixa de conta' : 'Avulso'
                        }
                        size="small"
                        variant="outlined"
                        color={t.kind === 'REVERSAL' ? 'warning' : t.payment ? 'primary' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        color={t.type === 'INCOME' ? 'success.main' : 'error.main'}
                        sx={{ textDecoration: t.payment?.reversedAt ? 'line-through' : undefined }}
                      >
                        {t.type === 'INCOME' ? '+' : '-'} {fmt(t.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {/* Estorno só faz sentido para baixa de conta: lançamento
                          avulso errado se resolve com um lançamento contrário.
                          É a correção mais importante do módulo, e um ícone sem
                          rótulo na última coluna esconde justamente isso. */}
                      {t.payment && !t.payment.reversedAt && (
                        <Button size="small" startIcon={<Undo />} onClick={() => setReversing(t.payment)}>
                          Desfazer
                        </Button>
                      )}
                      {t.payment?.reversedAt && (
                        <Chip size="small" label="estornada" color="warning" variant="outlined" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          )}

          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
              Apenas movimentações em espécie aparecem aqui. Recebimentos em Pix, cartão ou
              transferência ficam em Contas do mês e em Onde está o dinheiro.
            </Typography>
            {/* Consulta esporádica: um link daqui basta, e a barra fica com uma
                aba a menos para lembrar. */}
            <Button size="small" onClick={() => navigate('/financial/caixas')}>
              ver caixas anteriores
            </Button>
          </Box>
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
        blind={Boolean(current?.blindCashCount)}
        loading={closeMutation.isPending}
        error={dialogError}
      />

      <ReversePaymentDialog payment={reversing} onClose={() => setReversing(null)} />

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
