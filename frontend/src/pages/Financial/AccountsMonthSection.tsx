import { useState } from 'react';
import {
  Box, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Select, MenuItem, FormControl, InputLabel, Typography, Skeleton,
  TablePagination, IconButton, Tooltip, ToggleButton, ToggleButtonGroup, Menu,
  Dialog, DialogTitle, DialogContent, DialogActions, Stack,
} from '@mui/material';
import { Add, MoreHoriz, WhatsApp, Edit, Block, History, AttachFile } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';
import PaymentDialog from '../../components/common/PaymentDialog';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import AttachmentsCard from '../../components/common/AttachmentsCard';
import { useToast } from '../../store/toast.store';
import { useFinancialPeriod } from '../../store/financialPeriod.store';
import CategorySelect from './CategorySelect';
import MonthNavigator, { monthRange, isFromAnotherMonth } from './MonthNavigator';
import EditAccountDialog from './EditAccountDialog';
import PaymentsHistoryDialog from './PaymentsHistoryDialog';
import NewReceivableDialog from './NewReceivableDialog';
import NewPayableDialog from './NewPayableDialog';
import ReimbursementsBlock from './ReimbursementsBlock';
import { useUndoPayment } from './useUndoPayment';
import { useCompact } from '../../hooks/useCompact';
import { receiptLink } from './receiptMessage';
import { apiError, fmt, STATUS_MAP, toNumber } from './format';

type Side = 'receivable' | 'payable';

/**
 * Link de cobrança pelo WhatsApp, com a mensagem já escrita.
 *
 * O sistema não envia nada sozinho: abre a conversa com o texto pronto, e quem
 * decide mandar é a usuária.
 */
function chargeLink(r: any) {
  const phone = String(r.customer?.phone ?? '').replace(/\D/g, '');
  const saldo = toNumber(r.amount) - toNumber(r.paidAmount);
  const dias = dayjs().diff(dayjs(r.dueDate), 'day');
  const texto =
    `Oi, ${r.customer?.name?.split(' ')[0] ?? ''}! Tudo bem? ` +
    `Passando para lembrar do pagamento de ${fmt(saldo)} referente a "${r.description}", ` +
    `que venceu em ${dayjs(r.dueDate).format('DD/MM')}${dias > 0 ? ` (há ${dias} dias)` : ''}. ` +
    'Qualquer coisa é só me chamar!';
  return `https://wa.me/55${phone}?text=${encodeURIComponent(texto)}`;
}

/**
 * Estado vazio que ensina, no padrão do Caixa: diz o que a tela guarda e
 * oferece o botão que a preenche. "Nenhuma conta encontrada" faz a tela parecer
 * quebrada — e esta é das primeiras telas que um usuário novo abre.
 */
function EmptyState({ side, month, onNew }: { side: Side; month: string; onNew: () => void }) {
  const label = dayjs(`${month}-01`).format('MMMM');
  return (
    <Box sx={{ textAlign: 'center', py: 5, px: 2 }}>
      <Typography variant="body1" fontWeight={600} gutterBottom>
        Nenhuma conta {side === 'receivable' ? 'a receber' : 'a pagar'} em {label}.
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460, mx: 'auto' }}>
        {side === 'receivable'
          ? 'As cobranças aparecem aqui quando você aprova um orçamento com saldo a pagar, '
            + 'entrega uma OS com valor em aberto, ou cria uma cobrança à mão.'
          : 'As contas aparecem aqui quando você lança uma despesa — aluguel, tecido, energia. '
            + 'As que se repetem todo mês só precisam ser cadastradas uma vez.'}
      </Typography>
      <Button variant="outlined" startIcon={<Add />} sx={{ mt: 2 }} onClick={onNew}>
        {side === 'receivable' ? 'Criar uma cobrança' : 'Lançar uma conta'}
      </Button>
    </Box>
  );
}

/** As sete ações que disputavam o mesmo peso agora moram atrás de um "⋯". */
function RowMenu({ row, side, settled, onEdit, onCancel, onHistory, onAttach }: any) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const close = () => setAnchor(null);
  const act = (fn: () => void) => () => { close(); fn(); };

  const hasPayments = (row.payments?.length ?? 0) > 0;
  if (settled && !hasPayments && side === 'receivable') return null;

  return (
    <>
      <IconButton size="small" onClick={e => setAnchor(e.currentTarget)}>
        <MoreHoriz fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={close}>
        {hasPayments && (
          <MenuItem onClick={act(() => onHistory(row))}>
            <History fontSize="small" sx={{ mr: 1 }} /> Baixas e estorno
          </MenuItem>
        )}
        {side === 'payable' && (
          <MenuItem onClick={act(() => onAttach(row))}>
            <AttachFile fontSize="small" sx={{ mr: 1 }} /> Comprovante ou nota
          </MenuItem>
        )}
        {!settled && [
          <MenuItem key="edit" onClick={act(() => onEdit(row))}>
            <Edit fontSize="small" sx={{ mr: 1 }} /> Editar a conta
          </MenuItem>,
          <MenuItem key="cancel" onClick={act(() => onCancel(row))}>
            <Block fontSize="small" sx={{ mr: 1 }} /> Cancelar a conta
          </MenuItem>,
        ]}
      </Menu>
    </>
  );
}

/**
 * Contas do mês — uma tela, dois lados.
 *
 * "A Receber" e "A Pagar" eram duas telas com a mesma estrutura, o mesmo
 * navegador de mês e os mesmos botões; separadas, custavam duas entradas na
 * barra e duas escolhas de período. Aqui o mês é um só e o botão troca o lado.
 */
export default function AccountsMonthSection() {
  const qc = useQueryClient();
  const toast = useToast();
  const compact = useCompact();
  const undoAction = useUndoPayment();

  const { month, includeOverdue, setMonth, setIncludeOverdue } = useFinancialPeriod();
  // Quem chega pela fila do painel ("2 contas a pagar vencidas") já cai no lado
  // certo: chegar na tela e ter de trocar de lado é um passo a mais por nada.
  const [params, setParams] = useSearchParams();
  const side: Side = params.get('lado') === 'pagar' ? 'payable' : 'receivable';
  const [status, setStatus] = useState('');
  // A frase de fecho do Resultado ("o que mais subiu foi Tecidos") traz a
  // categoria junto — chegar aqui e ter de filtrar de novo é o passo que faz o
  // link não valer nada.
  const [category, setCategory] = useState(params.get('categoria') ?? '');
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);
  const [payTarget, setPayTarget] = useState<any>(null);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [historyTarget, setHistoryTarget] = useState<any>(null);
  const [attachTarget, setAttachTarget] = useState<any>(null);
  const [newDialog, setNewDialog] = useState(false);
  const [payError, setPayError] = useState('');

  const receiving = side === 'receivable';
  const resource = receiving ? 'receivables' : 'payables';

  const reset = () => setPage(0);
  const switchSide = (next: Side) => {
    setParams(next === 'payable' ? { lado: 'pagar' } : {}, { replace: true });
    setStatus('');
    setCategory('');
    reset();
  };

  const { data, isLoading } = useQuery({
    queryKey: [resource, status, category, month, includeOverdue, page, limit],
    queryFn: () => api.get(`/financial/${resource}`, {
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
    ['receivables', 'payables', 'financial-summary', 'financial-overview',
      'cash-register-current', 'cash-transactions', 'reimbursements',
    ].forEach(key => qc.invalidateQueries({ queryKey: [key] }));
  };

  const payMutation = useMutation({
    mutationFn: ({ id, amount, method, amountTendered }: any) =>
      api.patch(`/financial/${resource}/${id}/pay`, { amount, method, amountTendered }),
    onSuccess: (res, vars: any) => {
      refresh();
      const target = payTarget;
      const who = target?.customer?.name ?? target?.supplier ?? target?.description;
      setPayTarget(null);

      const receipt = receiving && receiptLink({
        phone: target?.customer?.phone,
        name: target?.customer?.name,
        amount: vars.amount,
        description: target?.description,
        method: vars.method,
      });

      // Desfazer à mão, no lugar de perguntar antes: quem erra aqui é a mesma
      // pessoa que confere, e o estorno já existia — faltava ficar à vista.
      toast(
        `${receiving ? 'Recebido' : 'Pago'} ${fmt(vars.amount)}${who ? ` — ${who}` : ''}`,
        'success',
        [
          undoAction(res?.data?.paymentId),
          receipt ? { label: 'Mandar recibo', onClick: () => window.open(receipt, '_blank', 'noopener') } : undefined,
        ].filter(Boolean) as any,
      );
    },
    onError: (e: any) => setPayError(apiError(e, 'Erro ao registrar a baixa')),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/financial/${resource}/${id}`),
    onSuccess: () => { refresh(); setCancelTarget(null); toast('Conta cancelada', 'info'); },
    onError: (e: any) => { setCancelTarget(null); toast(apiError(e, 'Erro ao cancelar'), 'error'); },
  });

  // Idade da dívida em quatro faixas, para oito contas, não é análise: é
  // enfeite. Vira uma frase, e só quando existe dinheiro parado de verdade.
  const stale = data?.aging?.buckets?.[3];
  const staleAmount = toNumber(stale?.amount);

  const total = data?.total ?? 0;
  // Paginação para dez contas é ruído. Só aparece quando a lista passa da página.
  const paginate = total > limit;

  const openLabel = receiving ? 'A receber no mês' : 'A pagar no mês';
  const doneLabel = receiving ? 'Já recebido' : 'Já pago';
  const doneValue = receiving ? summary?.totalReceived : summary?.totalPaid;

  const balanceOf = (r: any) => toNumber(r.amount) - toNumber(r.paidAmount);
  const partOf = (r: any) => toNumber(r.paidAmount) > 0 && balanceOf(r) > 0.005;

  const primaryFor = (r: any) => {
    // Conta adiantada por sócia não tem "Pagar": o fornecedor já foi pago por
    // ela. O que resta é ressarcir, e isso acontece no bloco do topo, de uma
    // vez por sócia — dois caminhos para a mesma dívida na mesma tela só
    // criariam a dúvida de qual é o certo.
    if (!receiving && r.advancedBy) {
      return (
        <Typography variant="caption" color="warning.main" sx={{ whiteSpace: 'nowrap' }}>
          a ressarcir
        </Typography>
      );
    }
    return (
      <Button
        size="small"
        variant="outlined"
        color={receiving ? 'success' : 'error'}
        onClick={() => { setPayError(''); setPayTarget(r); }}
      >
        {receiving ? 'Receber' : 'Pagar'}
      </Button>
    );
  };

  const rowMenu = (r: any, settled: boolean) => (
    <RowMenu
      row={r}
      side={side}
      settled={settled}
      onEdit={setEditTarget}
      onCancel={setCancelTarget}
      onHistory={setHistoryTarget}
      onAttach={setAttachTarget}
    />
  );

  /** Nome que identifica a linha: cliente de um lado, fornecedor do outro. */
  const who = (r: any) => (receiving ? r.customer?.name : r.supplier) ?? '—';

  const dueCell = (r: any, overdue: boolean) => (
    <>
      <Typography
        variant="body2"
        component="span"
        color={overdue ? 'error.main' : undefined}
        fontWeight={overdue ? 700 : undefined}
      >
        {dayjs(r.dueDate).format('DD/MM/YYYY')}
      </Typography>
      {isFromAnotherMonth(r.dueDate, month) && (
        <Chip size="small" variant="outlined" color="warning" label="de outro mês"
          sx={{ ml: 0.5, height: 18, fontSize: 10 }} />
      )}
      {overdue && (
        <Typography variant="caption" display="block" color="error.main">
          há {dayjs().diff(dayjs(r.dueDate), 'day')} dia(s)
        </Typography>
      )}
    </>
  );

  const amountCell = (r: any) => (
    <>
      <Typography variant="body2" fontWeight={700}>{fmt(r.amount)}</Typography>
      {/* Recebido e Saldo eram duas colunas repetindo a terceira: numa conta
          normal a primeira é zero e a segunda é igual ao valor. Só aparecem
          quando há pagamento parcial, que é quando dizem algo. */}
      {partOf(r) && (
        <Typography variant="caption" color="text.secondary">
          {receiving ? 'recebido' : 'pago'} {fmt(r.paidAmount)} de {fmt(r.amount)}
        </Typography>
      )}
    </>
  );

  return (
    <Box>
      <Box sx={{ mb: 0.5 }}>
        <MonthNavigator
          month={month}
          onChange={m => { setMonth(m); reset(); }}
          includeOverdue={includeOverdue}
          onIncludeOverdueChange={v => { setIncludeOverdue(v); reset(); }}
        />
      </Box>

      {/* As duas datas são a origem de quase toda confusão do financeiro; dizer
          qual vale em cada caso custa uma linha. */}
      <Typography variant="caption" color="text.secondary" display="block" mb={2}>
        em aberto pelo vencimento · quitada pelo dia em que o dinheiro entrou
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <ToggleButtonGroup exclusive size="small" value={side} onChange={(_, v) => v && switchSide(v)}>
          <ToggleButton value="receivable" sx={{ px: 2 }}>A receber</ToggleButton>
          <ToggleButton value="payable" sx={{ px: 2 }}>A pagar</ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ minWidth: 160 }}>
            <CategorySelect
              type={receiving ? 'INCOME' : 'EXPENSE'}
              value={category}
              onChange={v => { setCategory(v); reset(); }}
              emptyLabel="Todas"
            />
          </Box>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Status</InputLabel>
            <Select value={status} label="Status" onChange={e => { setStatus(e.target.value); reset(); }}>
              <MenuItem value="">Todos</MenuItem>
              {Object.entries(STATUS_MAP).map(([v, { label }]) => <MenuItem key={v} value={v}>{label}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={<Add />} onClick={() => setNewDialog(true)}>Nova</Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 4, mb: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="body2" color="text.secondary">{openLabel}</Typography>
          <Typography variant="h5" fontWeight={700} color={receiving ? 'success.main' : 'error.main'}>
            {isLoading ? <Skeleton width={140} /> : fmt(summary?.totalOpen)}
          </Typography>
        </Box>
        {toNumber(summary?.overdueAmount) > 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary">Vencido ({summary.overdueCount})</Typography>
            <Typography variant="h5" fontWeight={700} color="error.main">{fmt(summary.overdueAmount)}</Typography>
          </Box>
        )}
        <Box>
          <Typography variant="body2" color="text.secondary">{doneLabel}</Typography>
          <Typography variant="h5" fontWeight={700}>
            {isLoading ? <Skeleton width={140} /> : fmt(doneValue)}
          </Typography>
        </Box>
        {/* Fixas × variáveis é dos poucos blocos do módulo que mudam decisão: é
            o que diz o que dá para cortar. */}
        {!receiving && summary && (
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

      {!receiving && <ReimbursementsBlock />}

      {receiving && staleAmount > 0 && (
        <Typography variant="body2" color="error.main" mb={2}>
          <strong>{fmt(staleAmount)}</strong> {stale.count === 1 ? 'está parado' : 'estão parados'} há
          mais de dois meses.
        </Typography>
      )}

      {/* Abaixo de md a tabela de cinco colunas ainda rola de lado, e o telefone
          é onde ela está: no balcão, de pé. Cada conta vira um cartão. */}
      {compact ? (
        <Stack spacing={1}>
          {isLoading && [0, 1, 2].map(i => <Skeleton key={i} variant="rounded" height={92} />)}
          {!isLoading && rows.map((r: any) => {
            const overdue = r.status === 'OVERDUE';
            const settled = r.status === 'PAID' || r.status === 'CANCELLED';
            const { label, color } = STATUS_MAP[r.status] ?? { label: r.status, color: 'default' };
            return (
              <Paper key={r.id} variant="outlined" sx={{ p: 1.5, bgcolor: overdue ? 'error.50' : undefined }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>{who(r)}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {r.description}
                    </Typography>
                    <Typography variant="caption" color={overdue ? 'error.main' : 'text.secondary'}>
                      vence {dayjs(r.dueDate).format('DD/MM')}
                      {overdue && ` · há ${dayjs().diff(dayjs(r.dueDate), 'day')} dia(s)`}
                    </Typography>
                    {r.advancedBy && (
                      <Typography variant="caption" color="warning.main" display="block">
                        paga por {r.advancedBy.name} · a ressarcir
                      </Typography>
                    )}
                  </Box>
                  {settled && <Chip label={label} size="small" color={color} sx={{ alignSelf: 'flex-start' }} />}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1, gap: 1 }}>
                  <Box>{amountCell(r)}</Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {!settled && primaryFor(r)}
                    {receiving && overdue && r.customer?.phone && (
                      <IconButton size="small" color="success" component="a" target="_blank" rel="noopener" href={chargeLink(r)}>
                        <WhatsApp fontSize="small" />
                      </IconButton>
                    )}
                    {rowMenu(r, settled)}
                  </Box>
                </Box>
              </Paper>
            );
          })}
          {!isLoading && rows.length === 0 && (
            <Paper variant="outlined">
              <EmptyState side={side} month={month} onNew={() => setNewDialog(true)} />
            </Paper>
          )}
        </Stack>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{receiving ? 'Cliente' : 'Fornecedor'}</TableCell>
                <TableCell>Descrição</TableCell>
                <TableCell>Vencimento</TableCell>
                <TableCell align="right">Valor</TableCell>
                <TableCell align="right" sx={{ width: 150 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>{[1, 2, 3, 4, 5].map(j => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
              )) : rows.map((r: any) => {
                const overdue = r.status === 'OVERDUE';
                const settled = r.status === 'PAID' || r.status === 'CANCELLED';
                const { label, color } = STATUS_MAP[r.status] ?? { label: r.status, color: 'default' };
                return (
                  <TableRow key={r.id} hover sx={{ bgcolor: overdue ? 'error.50' : undefined }}>
                    <TableCell>{who(r)}</TableCell>
                    <TableCell>
                      {r.description}
                      {/* Vencimento em vermelho com "há 12 dias" já diz "vencida";
                          o chip só fica onde é a única pista que existe. */}
                      {settled && (
                        <Chip label={label} size="small" color={color} sx={{ ml: 1, height: 18, fontSize: 10 }} />
                      )}
                      {/* Sem isto, a conta adiantada pela sócia some no meio das
                          outras e ninguém lembra que o dinheiro é dela. */}
                      {r.advancedBy && (
                        <Chip
                          label={`paga por ${r.advancedBy.name}`}
                          size="small"
                          variant="outlined"
                          color="warning"
                          sx={{ ml: 1, height: 18, fontSize: 10 }}
                        />
                      )}
                    </TableCell>
                    <TableCell>{dueCell(r, overdue)}</TableCell>
                    <TableCell align="right">{amountCell(r)}</TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', alignItems: 'center' }}>
                        {!settled && primaryFor(r)}
                        {receiving && overdue && r.customer?.phone && (
                          <Tooltip title={`Cobrar ${r.customer.name} no WhatsApp`}>
                            <IconButton size="small" color="success" component="a" target="_blank" rel="noopener" href={chargeLink(r)}>
                              <WhatsApp fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {rowMenu(r, settled)}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <EmptyState side={side} month={month} onNew={() => setNewDialog(true)} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {paginate && (
            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={limit}
              onRowsPerPageChange={e => { setLimit(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[20, 50, 100]}
              labelRowsPerPage="Por página"
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
            />
          )}
        </TableContainer>
      )}

      <PaymentDialog
        open={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
        onConfirm={(amount, method, amountTendered) =>
          payMutation.mutate({ id: payTarget?.id, amount, method, amountTendered })}
        title={`${receiving ? 'Receber' : 'Pagar'}: ${payTarget?.description ?? ''}`}
        maxAmount={payTarget ? toNumber(payTarget.amount) - toNumber(payTarget.paidAmount) : undefined}
        loading={payMutation.isPending}
        error={payError}
        verb={receiving ? 'Receber' : 'Pagar'}
        confirmColor={receiving ? 'success' : 'error'}
        amountLabel={receiving ? 'Valor recebido (R$)' : 'Valor pago (R$)'}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelMutation.mutate(cancelTarget.id)}
        title="Cancelar conta"
        message={`Cancelar "${cancelTarget?.description ?? ''}"? A conta deixa de ser ${
          receiving ? 'cobrada' : 'paga'}, mas continua no histórico.`}
        confirmLabel="Cancelar a conta"
        confirmColor="error"
        loading={cancelMutation.isPending}
      />

      <EditAccountDialog account={editTarget} kind={side} onClose={() => setEditTarget(null)} />
      <PaymentsHistoryDialog account={historyTarget} onClose={() => setHistoryTarget(null)} />

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
          {attachTarget && <AttachmentsCard entityType="accountPayable" entityId={attachTarget.id} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAttachTarget(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      {receiving ? (
        <NewReceivableDialog open={newDialog} onClose={() => setNewDialog(false)} onSuccess={() => setNewDialog(false)} />
      ) : (
        <NewPayableDialog open={newDialog} onClose={() => setNewDialog(false)} onSuccess={() => setNewDialog(false)} />
      )}
    </Box>
  );
}
