import { useEffect, useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, IconButton, Skeleton, Stack,
  Button, Alert, Avatar, Divider, Accordion, AccordionSummary, AccordionDetails,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tooltip,
  FormControlLabel, Checkbox,
} from '@mui/material';
import {
  ChevronLeft, ChevronRight, ExpandMore, Lock, LockOpen, Storefront, Print,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';
import { useToast } from '../../store/toast.store';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { apiError, fmt, toNumber } from './format';
import { useCompact } from '../../hooks/useCompact';

const monthLabel = (key: string) => dayjs(`${key}-01`).format('MMMM [de] YYYY');

/**
 * Regra de divisão: quanto cabe a cada sócia e quanto fica no ateliê.
 *
 * A soma tem que fechar exatamente 100% — com a regra pela metade, alguém
 * receberia a mais ou a menos sem ninguém ter decidido isso. Mudar a regra não
 * altera meses já fechados, que guardam o percentual usado na época.
 */
function RuleDialog({ open, onClose, data }: any) {
  const qc = useQueryClient();
  const toast = useToast();
  const [atelier, setAtelier] = useState(0);
  const [shares, setShares] = useState<Record<string, string>>({});
  const [monthOnly, setMonthOnly] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !data) return;
    setAtelier(toNumber(data.rule.atelierPercent));
    setShares(Object.fromEntries(
      data.shares.map((s: any) => [s.userId, String(toNumber(s.percent) || '')]),
    ));
    // Mês que já tem regra própria continua marcado, senão salvar aqui
    // devolveria ele para a regra padrão sem querer.
    setMonthOnly(Boolean(data.rule.monthOnly));
    setError('');
  }, [open, data]);

  const total = Object.values(shares).reduce((s, v) => s + (Number(v) || 0), 0) + (Number(atelier) || 0);
  const closed = Math.abs(total - 100) < 0.005;

  const mutation = useMutation({
    mutationFn: () => api.put('/financial/distribution/rule', {
      atelierPercent: Number(atelier) || 0,
      shares: Object.entries(shares).map(([userId, percent]) => ({
        userId,
        percent: Number(percent) || 0,
      })),
      month: monthOnly ? data.month : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['distribution'] });
      toast(monthOnly ? `Regra salva só para ${data.month}` : 'Regra de divisão salva');
      onClose();
    },
    onError: (e: any) => setError(apiError(e, 'Erro ao salvar a regra')),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Como dividir o resultado</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}

        <TextField
          label="Ateliê (reserva)"
          value={atelier}
          onChange={e => setAtelier(Number(e.target.value.replace(',', '.')) || 0)}
          type="number"
          size="small"
          InputProps={{ endAdornment: <Typography variant="caption">%</Typography> }}
          fullWidth
        />

        {(data?.shares ?? []).map((s: any) => (
          <TextField
            key={s.userId}
            label={s.name}
            value={shares[s.userId] ?? ''}
            onChange={e => setShares(v => ({ ...v, [s.userId]: e.target.value.replace(',', '.') }))}
            type="number"
            size="small"
            InputProps={{ endAdornment: <Typography variant="caption">%</Typography> }}
            fullWidth
          />
        ))}

        <Alert severity={closed ? 'success' : 'warning'}>
          Total: <strong>{total.toFixed(2)}%</strong>
          {!closed && (total > 100
            ? ` — passou ${(total - 100).toFixed(2)}%`
            : ` — faltam ${(100 - total).toFixed(2)}%`)}
        </Alert>

        {/* Para o caso pontual — uma sócia afastada num mês — sem mexer na
            regra que vale para os outros meses. */}
        <FormControlLabel
          control={<Checkbox checked={monthOnly} onChange={e => setMonthOnly(e.target.checked)} />}
          label={`Usar estes percentuais só em ${monthLabel(data?.month ?? '')}`}
        />

        <Typography variant="caption" color="text.secondary">
          {monthOnly
            ? 'A regra padrão dos outros meses fica como está.'
            : 'Vale para os próximos meses. Meses já fechados guardam o percentual usado na época e não mudam.'}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() => mutation.mutate()}
          disabled={!closed || mutation.isPending}
        >
          Salvar regra
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function DistributionSection() {
  const compact = useCompact();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [closeOpen, setCloseOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [notes, setNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['distribution', month],
    queryFn: () => api.get('/financial/distribution', { params: { month } }).then(r => r.data),
  });

  const closeMutation = useMutation({
    mutationFn: () => api.post('/financial/distribution/close', { month, notes: notes || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['distribution'] });
      setCloseOpen(false);
      setNotes('');
      toast('Divisão fechada');
    },
    onError: (e: any) => toast(apiError(e, 'Erro ao fechar a divisão'), 'error'),
  });

  const reopenMutation = useMutation({
    mutationFn: () => api.delete(`/financial/distribution/${month}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['distribution'] });
      setReopenOpen(false);
      toast('Divisão reaberta', 'info');
    },
    onError: (e: any) => toast(apiError(e, 'Erro ao reabrir'), 'error'),
  });

  const payoutMutation = useMutation({
    mutationFn: (payoutId: string) => api.patch(`/financial/distribution/payouts/${payoutId}/pay`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['distribution'] });
      qc.invalidateQueries({ queryKey: ['financial-accounts'] });
      toast('Retirada registrada');
    },
    onError: (e: any) => toast(apiError(e, 'Erro ao registrar a retirada'), 'error'),
  });

  const settleLossMutation = useMutation({
    mutationFn: () => api.post(`/financial/distribution/${month}/settle-loss`, {}),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['distribution'] });
      qc.invalidateQueries({ queryKey: ['financial-accounts'] });
      const pending = toNumber(res.data.pending);
      toast(
        pending > 0
          ? `Reserva cobriu ${fmt(res.data.coveredByReserve)}; ${fmt(pending)} passam para o mês seguinte.`
          : 'Prejuízo coberto pela reserva do ateliê.',
        pending > 0 ? 'warning' : 'success',
      );
    },
    onError: (e: any) => toast(apiError(e, 'Erro ao tratar o prejuízo'), 'error'),
  });

  const shift = (d: number) => setMonth(m => dayjs(`${m}-01`).add(d, 'month').format('YYYY-MM'));
  const isCurrent = month === dayjs().format('YYYY-MM');

  if (isLoading) return <Skeleton variant="rounded" height={340} />;

  const result = toNumber(data.result);
  const closed = data.closed;
  const gross = toNumber(data.grossResult);

  // Uma única faixa no topo, escolhida por prioridade. `null` é o caso bom: o
  // topo da tela fica livre e a conta começa logo abaixo do navegador de mês.
  const topAlert = data.shares.length === 0 ? (
    <Alert severity="warning" sx={{ mb: 2 }}>
      Nenhuma sócia cadastrada. Marque quem são as sócias em{' '}
      <strong>Configurações → Usuários</strong> para o sistema calcular a divisão.
    </Alert>
  ) : !data.rule.valid ? (
    <Alert severity="error" sx={{ mb: 2 }} action={
      <Button size="small" onClick={() => setRuleOpen(true)}>Ajustar regra</Button>
    }>
      Os percentuais somam <strong>{toNumber(data.rule.percentTotal).toFixed(2)}%</strong> —
      precisam fechar 100% para dividir.
      {data.rule.partnersWithoutPercent.length > 0 && (
        <> Sem percentual: {data.rule.partnersWithoutPercent.join(', ')}.</>
      )}
    </Alert>
  ) : gross < 0 && !closed ? (
    <Alert
      severity="warning"
      sx={{ mb: 2 }}
      action={
        <Button
          size="small"
          onClick={() => settleLossMutation.mutate()}
          disabled={settleLossMutation.isPending}
        >
          Cobrir com a reserva
        </Button>
      }
    >
      O mês fechou negativo em <strong>{fmt(Math.abs(gross))}</strong>. A reserva do ateliê tem{' '}
      {fmt(data.reserve.balance)} — o que ela não cobrir passa para o mês seguinte.
    </Alert>
  ) : closed ? (
    <Alert severity="success" sx={{ mb: 2 }}>
      Divisão fechada em {dayjs(closed.closedAt).format('DD/MM/YYYY [às] HH:mm')} com os valores
      congelados abaixo. Lançamentos feitos depois disso não alteram estes números.
      {closed.notes && <> — <em>{closed.notes}</em></>}
    </Alert>
  ) : result <= 0 ? (
    <Alert severity="info" sx={{ mb: 2 }}>
      {gross === 0
        ? 'O mês fechou zerado — não há resultado a dividir.'
        : 'Depois de tirar os sinais de peças não entregues e o prejuízo anterior, não sobrou nada para dividir.'}
    </Alert>
  ) : null;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <IconButton size="small" onClick={() => shift(-1)}><ChevronLeft /></IconButton>
        <Typography variant="h6" sx={{ minWidth: 210, textAlign: 'center', textTransform: 'capitalize' }}>
          {monthLabel(data.month)}
        </Typography>
        <IconButton size="small" onClick={() => shift(1)} disabled={isCurrent}><ChevronRight /></IconButton>
        {closed && <Chip icon={<Lock />} label="Fechada" color="success" size="small" />}
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="outlined"
          startIcon={<Print />}
          onClick={() => navigate(`/financial/divisao/${data.month}`)}
        >
          Imprimir
        </Button>
        {closed ? (
          <Button startIcon={<LockOpen />} onClick={() => setReopenOpen(true)}>Reabrir</Button>
        ) : (
          <Button
            variant="contained"
            startIcon={<Lock />}
            onClick={() => setCloseOpen(true)}
            disabled={result <= 0 || data.shares.length === 0}
          >
            Fechar divisão
          </Button>
        )}
      </Box>

      {/*
        Um aviso por vez, por prioridade. Nunca aparecem os quatro juntos, mas
        dois aparecem — e aí o topo da tela vira um muro que ninguém lê. A
        ordem é a de quem bloqueia primeiro: sem sócia não há divisão; regra
        inválida impede a conta; mês negativo tem uma ação própria; e "nada a
        dividir" é só a constatação de que a conta deu zero.
      */}
      {topAlert}

      {/* Como se chega ao valor a dividir — a conta aberta, linha a linha */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} mb={1.5}>
            Quanto sobrou para dividir
          </Typography>

          <Box sx={{ maxWidth: 480 }}>
            {[
              { label: 'Entrou no mês', value: data.income, sign: '' },
              { label: 'Saiu no mês', value: data.expense, sign: '−' },
            ].map(l => (
              <Box key={l.label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                <Typography variant="body2" color="text.secondary">{l.label}</Typography>
                <Typography variant="body2">{l.sign} {fmt(l.value)}</Typography>
              </Box>
            ))}
            <Divider sx={{ my: 0.5 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography variant="body2" fontWeight={600}>Resultado do mês</Typography>
              <Typography variant="body2" fontWeight={600}>{fmt(data.grossResult)}</Typography>
            </Box>

            {toNumber(data.withheldSignals.amount) > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                <Tooltip title={data.withheldSignals.items.map((i: any) => `${i.workOrderNumber ?? ''} ${i.customer ?? ''} — ${fmt(i.amount)}`).join('\n')}>
                  <Typography variant="body2" color="text.secondary" sx={{ cursor: 'help' }}>
                    Sinais de {data.withheldSignals.count} peça(s) não entregues
                  </Typography>
                </Tooltip>
                <Typography variant="body2">− {fmt(data.withheldSignals.amount)}</Typography>
              </Box>
            )}

            {toNumber(data.carryOver.total) > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  Prejuízo de {data.carryOver.months.map((m: any) => m.month).join(', ')}
                </Typography>
                <Typography variant="body2">− {fmt(data.carryOver.total)}</Typography>
              </Box>
            )}

            <Divider sx={{ my: 0.5 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography variant="subtitle1" fontWeight={700}>A DIVIDIR</Typography>
              <Typography
                variant="h6"
                fontWeight={700}
                color={result >= 0 ? 'success.main' : 'error.main'}
              >
                {fmt(closed ? closed.result : data.result)}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Como é dividido */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>Como é dividido</Typography>
            {!closed && (
              <Button size="small" onClick={() => setRuleOpen(true)}>Editar regra</Button>
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* No telefone as quatro colunas viram uma linha por pessoa: quem,
              quanto, e o botão da retirada embaixo. É a leitura que interessa —
              "quanto cabe a cada uma" — sem rolagem de lado. */}
          {compact ? (
            <Stack divider={<Divider />}>
              {[
                {
                  key: 'atelier',
                  icon: <Storefront fontSize="small" color="primary" />,
                  name: 'Ateliê (reserva)',
                  percent: toNumber(closed?.atelierPercent ?? data.rule.atelierPercent),
                  amount: closed ? closed.atelierShare : data.atelierShare,
                  color: 'text.primary',
                  action: <Typography variant="caption" color="text.secondary">vai para a reserva</Typography>,
                },
                ...(closed ? closed.shares : data.shares).map((s: any) => {
                  const payout = closed?.payouts?.find((p: any) => p.userId === s.userId);
                  return {
                    key: s.userId,
                    icon: (
                      <Avatar sx={{ width: 26, height: 26, fontSize: 12, bgcolor: 'secondary.main' }}>
                        {s.name.charAt(0).toUpperCase()}
                      </Avatar>
                    ),
                    name: s.name,
                    percent: toNumber(s.percent),
                    amount: s.amount,
                    color: 'success.main',
                    action: !closed ? (
                      <Typography variant="caption" color="text.secondary">após fechar a divisão</Typography>
                    ) : payout?.paidAt ? (
                      <Chip size="small" color="success" label={`retirado ${dayjs(payout.paidAt).format('DD/MM')}`} />
                    ) : payout ? (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => payoutMutation.mutate(payout.id)}
                        disabled={payoutMutation.isPending}
                      >
                        registrar retirada
                      </Button>
                    ) : null,
                  };
                }),
              ].map(row => (
                <Box key={row.key} sx={{ py: 1.25 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {row.icon}
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap>{row.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.percent.toFixed(2)}%
                      </Typography>
                    </Box>
                    <Typography variant="h6" fontWeight={700} color={row.color}>
                      {fmt(row.amount)}
                    </Typography>
                  </Box>
                  {row.action && <Box sx={{ mt: 0.5, pl: 4.5 }}>{row.action}</Box>}
                </Box>
              ))}
            </Stack>
          ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Quem</TableCell>
                <TableCell align="right">%</TableCell>
                <TableCell align="right">Valor</TableCell>
                <TableCell>Retirada</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Storefront fontSize="small" color="primary" />
                    Ateliê (reserva)
                  </Box>
                </TableCell>
                <TableCell align="right">
                  {toNumber(closed?.atelierPercent ?? data.rule.atelierPercent).toFixed(2)}%
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={700}>
                    {fmt(closed ? closed.atelierShare : data.atelierShare)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    vai para a reserva
                  </Typography>
                </TableCell>
              </TableRow>

              {(closed ? closed.shares : data.shares).map((s: any) => {
                const payout = closed?.payouts?.find((p: any) => p.userId === s.userId);
                return (
                  <TableRow key={s.userId}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 26, height: 26, fontSize: 12, bgcolor: 'secondary.main' }}>
                          {s.name.charAt(0).toUpperCase()}
                        </Avatar>
                        {s.name}
                      </Box>
                    </TableCell>
                    <TableCell align="right">{toNumber(s.percent).toFixed(2)}%</TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={700} color="success.main">
                        {fmt(s.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {!closed ? (
                        <Typography variant="caption" color="text.secondary">
                          após fechar a divisão
                        </Typography>
                      ) : payout?.paidAt ? (
                        <Chip
                          size="small"
                          color="success"
                          label={`retirado ${dayjs(payout.paidAt).format('DD/MM')}`}
                        />
                      ) : payout ? (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => payoutMutation.mutate(payout.id)}
                          disabled={payoutMutation.isPending}
                        >
                          registrar retirada
                        </Button>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          )}

          {closed && (
            <Typography variant="caption" color="text.secondary" display="block" mt={1.5}>
              O que ainda não foi retirado continua devido à sócia e não volta para o bolo do mês
              seguinte.
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Reserva do ateliê */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Typography variant="subtitle1" fontWeight={600}>Reserva do ateliê</Typography>
            <Typography variant="h6" fontWeight={700}>{fmt(data.reserve.balance)}</Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Meta: {data.reserve.targetMonths} meses de custo fixo ({fmt(data.reserve.target)})
            {toNumber(data.reserve.target) > 0 && (
              <> · {Math.min(100, Math.round((toNumber(data.reserve.balance) / toNumber(data.reserve.target)) * 100))}% da meta</>
            )}
          </Typography>
        </CardContent>
      </Card>

      {/* Detalhamento: o que cada sócia produziu */}
      <Typography variant="subtitle1" fontWeight={600} mb={1}>
        O que cada uma produziu no mês
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
        A divisão é igual entre todas, independente da produção — este detalhamento é para
        acompanhamento.
      </Typography>

      {data.shares.map((s: any) => (
        <Accordion key={s.userId} variant="outlined" disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', pr: 2 }}>
              <Avatar sx={{ width: 30, height: 30, fontSize: 13, bgcolor: 'secondary.main' }}>
                {s.name.charAt(0).toUpperCase()}
              </Avatar>
              <Typography sx={{ flexGrow: 1 }}>{s.name}</Typography>
              <Chip size="small" label={`${s.deliveredCount} peça${s.deliveredCount === 1 ? '' : 's'}`} />
              <Typography variant="body2" fontWeight={600} sx={{ minWidth: 100, textAlign: 'right' }}>
                {fmt(s.deliveredValue)}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {s.items.length === 0 ? (
              <Typography variant="body2" color="text.secondary" py={1}>
                Nenhuma peça entregue por ela neste mês.
              </Typography>
            ) : compact ? (
              /* Cinco colunas dentro de um acordeão não cabem no telefone; a
                 peça vira uma linha com cliente, data e valor. */
              <Stack divider={<Divider />}>
                {s.items.map((i: any) => (
                  <Box
                    key={i.id}
                    onClick={() => navigate(`/work-orders/${i.id}/edit`)}
                    sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 1, cursor: 'pointer' }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" noWrap>{i.customer}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {i.number}
                        {i.garment && ` · ${i.garment}`}
                        {` · ${dayjs(i.deliveredAt).format('DD/MM')}`}
                      </Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>
                      {fmt(i.value)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>OS</TableCell>
                    <TableCell>Cliente</TableCell>
                    <TableCell>Peça</TableCell>
                    <TableCell>Entregue em</TableCell>
                    <TableCell align="right">Valor</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {s.items.map((i: any) => (
                    <TableRow
                      key={i.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/work-orders/${i.id}/edit`)}
                    >
                      <TableCell>{i.number}</TableCell>
                      <TableCell>{i.customer}</TableCell>
                      <TableCell>{i.garment ?? '—'}</TableCell>
                      <TableCell>{dayjs(i.deliveredAt).format('DD/MM')}</TableCell>
                      <TableCell align="right">{fmt(i.value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </AccordionDetails>
        </Accordion>
      ))}

      {data.unassigned.count > 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <strong>{data.unassigned.count} peça(s)</strong> entregues no mês ({fmt(data.unassigned.value)})
          não têm costureira atribuída, então não aparecem na produção de ninguém. Atribua a
          responsável na OS para o acompanhamento ficar completo.
        </Alert>
      )}

      {/* Fechar */}
      <Dialog open={closeOpen} onClose={() => setCloseOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Fechar a divisão de {monthLabel(data.month)}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <Alert severity="info">
            Os valores são congelados: cada sócia recebe <strong>{fmt(data.valuePerPart)}</strong> e
            o ateliê fica com <strong>{fmt(data.atelierShare)}</strong>. Lançamentos feitos depois
            não mudam mais estes números.
          </Alert>
          <TextField
            label="Observações"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="Ex: pago em 05/08 por transferência"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseOpen(false)} disabled={closeMutation.isPending}>Cancelar</Button>
          <Button variant="contained" onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending}>
            Fechar divisão
          </Button>
        </DialogActions>
      </Dialog>

      <RuleDialog open={ruleOpen} onClose={() => setRuleOpen(false)} data={data} />

      <ConfirmDialog
        open={reopenOpen}
        onClose={() => setReopenOpen(false)}
        onConfirm={() => reopenMutation.mutate()}
        title="Reabrir divisão"
        message={`Reabrir a divisão de ${monthLabel(data.month)}? Os valores voltam a ser recalculados a partir dos lançamentos atuais.`}
        confirmLabel="Reabrir"
        confirmColor="warning"
        loading={reopenMutation.isPending}
      />
    </Box>
  );
}
