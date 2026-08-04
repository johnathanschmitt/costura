import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Chip, Button, Alert, Skeleton,
  Table, TableBody, TableCell, TableRow, Collapse, Divider, LinearProgress, Tooltip,
} from '@mui/material';
import {
  TrendingUp, TrendingDown, WarningAmber, CheckCircleOutline, Savings,
  ArrowForward, InfoOutlined,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';
import { fmt, toNumber } from './format';

/** Bloco do painel: título discreto e conteúdo em destaque. */
function Panel({ title, action, children }: any) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="overline" color="text.secondary" letterSpacing={0.8}>
            {title}
          </Typography>
          {action}
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

function Figure({ label, value, color, caption }: any) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h5" fontWeight={700} color={color}>{value}</Typography>
      {caption && <Typography variant="caption" color="text.secondary">{caption}</Typography>}
    </Box>
  );
}

/**
 * Tela de abertura do financeiro. Existe para responder, sem clique nenhum:
 * quanto tem, quanto desse dinheiro ainda não é do ateliê, como está o mês, se
 * dá para pagar as contas até o fim dele, se o faturamento cobre o custo fixo e
 * quem está devendo.
 */
export default function OverviewSection() {
  const navigate = useNavigate();
  const [showCommitted, setShowCommitted] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['financial-overview'],
    queryFn: () => api.get('/financial/overview').then(r => r.data),
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <Grid container spacing={2}>
        {[0, 1, 2, 3].map(i => (
          <Grid item xs={12} md={6} key={i}><Skeleton variant="rounded" height={150} /></Grid>
        ))}
      </Grid>
    );
  }

  const { money, month, untilEndOfMonth: ahead, health, overdue, cashRegister } = data;
  const variation = month.resultVariation === null ? null : toNumber(month.resultVariation);
  const rate = health.hourlyRate === null ? null : toNumber(health.hourlyRate);
  const target = health.targetHourlyRate === null ? null : toNumber(health.targetHourlyRate);

  return (
    <Grid container spacing={2}>
      {/* ── Dinheiro hoje ───────────────────────────────────────────────── */}
      <Grid item xs={12} md={6}>
        <Panel
          title="Dinheiro hoje"
          action={
            cashRegister
              ? <Chip size="small" color="success" label={`caixa aberto ${dayjs(cashRegister.openedAt).format('HH:mm')}`} />
              : <Chip size="small" label="caixa fechado" />
          }
        >
          <Figure label="Total disponível" value={fmt(money.total)} />

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
            {(money.accounts ?? []).map((a: any) => (
              <Box key={a.id} sx={{ bgcolor: 'background.default', px: 1.5, py: 1, borderRadius: 1, minWidth: 110 }}>
                <Typography variant="caption" color="text.secondary" display="block">{a.name}</Typography>
                <Typography variant="body2" fontWeight={700}>{fmt(a.balance)}</Typography>
              </Box>
            ))}
            {toNumber(money.reserve) > 0 && (
              <Box sx={{ bgcolor: 'background.default', px: 1.5, py: 1, borderRadius: 1, minWidth: 110 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Reserva do ateliê
                </Typography>
                <Typography variant="body2" fontWeight={700} color="text.secondary">
                  {fmt(money.reserve)}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Cartão que ainda não caiu: já é do ateliê, mas não dá para contar
              com ele hoje. */}
          {toNumber(money.pendingCard) > 0 && (
            <Alert severity="info" sx={{ mt: 1.5, py: 0.5 }}>
              <strong>{fmt(money.pendingCard)}</strong> em vendas no cartão ainda não caíram na
              conta — já descontada a taxa da maquininha.
            </Alert>
          )}

          {toNumber(money.committed) > 0 && (
            <Alert
              severity="warning"
              icon={<WarningAmber fontSize="small" />}
              sx={{ mt: 1.5, py: 0.5 }}
              action={
                <Button size="small" onClick={() => setShowCommitted(s => !s)}>
                  {showCommitted ? 'ocultar' : 'ver quais'}
                </Button>
              }
            >
              <strong>{fmt(money.committed)}</strong> são sinais de {money.committedCount} peça(s)
              ainda não entregues — esse dinheiro ainda tem trabalho e material pela frente.
            </Alert>
          )}

          <Collapse in={showCommitted}>
            <Table size="small" sx={{ mt: 1 }}>
              <TableBody>
                {money.committedItems.map((i: any) => (
                  <TableRow
                    key={i.id}
                    hover
                    sx={{ cursor: i.workOrderId ? 'pointer' : 'default' }}
                    onClick={() => i.workOrderId && navigate(`/work-orders/${i.workOrderId}/edit`)}
                  >
                    <TableCell sx={{ border: 0, py: 0.5 }}>{i.workOrderNumber ?? '—'}</TableCell>
                    <TableCell sx={{ border: 0, py: 0.5 }}>{i.customer ?? '—'}</TableCell>
                    <TableCell align="right" sx={{ border: 0, py: 0.5 }}>{fmt(i.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Collapse>

          <Typography variant="caption" color="text.secondary" display="block" mt={1.5}>
            A reserva do ateliê fica fora do disponível — é dinheiro guardado, não caixa do mês.
          </Typography>
        </Panel>
      </Grid>

      {/* ── Mês atual ───────────────────────────────────────────────────── */}
      <Grid item xs={12} md={6}>
        <Panel title={dayjs(`${month.key}-01`).format('MMMM [de] YYYY')}>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Figure label="Entrou" value={fmt(month.income)} color="success.main" />
            <Figure label="Saiu" value={fmt(month.expense)} color="error.main" />
            <Figure
              label="Sobrou"
              value={fmt(month.result)}
              color={toNumber(month.result) >= 0 ? 'text.primary' : 'error.main'}
            />
          </Box>
          <Divider sx={{ my: 1.5 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {variation !== null && (
              variation >= 0
                ? <TrendingUp fontSize="small" color="success" />
                : <TrendingDown fontSize="small" color="error" />
            )}
            <Typography variant="body2" color="text.secondary">
              Mês passado sobrou <strong>{fmt(month.previousResult)}</strong>
              {variation !== null && ` · ${variation >= 0 ? '+' : ''}${variation}%`}
            </Typography>
          </Box>
        </Panel>
      </Grid>

      {/* ── Até o fim do mês ────────────────────────────────────────────── */}
      <Grid item xs={12} md={6}>
        <Panel title="Até o fim do mês">
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 1.5 }}>
            <Figure
              label="A receber"
              value={fmt(ahead.toReceive)}
              color="success.main"
              caption={`${ahead.toReceiveCount} conta(s)`}
            />
            <Figure
              label="A pagar"
              value={fmt(ahead.toPay)}
              color="error.main"
              caption={`${ahead.toPayCount} conta(s)`}
            />
            <Figure label="Fecha em" value={fmt(ahead.projectedBalance)} />
          </Box>

          {ahead.coversPayables ? (
            <Alert severity="success" icon={<CheckCircleOutline fontSize="small" />} sx={{ py: 0.5 }}>
              Dá para pagar tudo sem o saldo ficar negativo.
            </Alert>
          ) : (
            <Alert severity="error" icon={<WarningAmber fontSize="small" />} sx={{ py: 0.5 }}>
              Em <strong>{dayjs(ahead.lowest.date).format('DD/MM')}</strong> o saldo fica em{' '}
              <strong>{fmt(ahead.lowest.balance)}</strong> — falta dinheiro para as contas do mês.
            </Alert>
          )}

          <Typography variant="caption" color="text.secondary" display="block" mt={1}>
            Parte do dinheiro em caixa e aplica os vencimentos em aberto, dia a dia.
          </Typography>
        </Panel>
      </Grid>

      {/* ── Saúde do ateliê ─────────────────────────────────────────────── */}
      <Grid item xs={12} md={6}>
        <Panel
          title="Saúde do ateliê"
          action={
            <Button size="small" endIcon={<ArrowForward />} onClick={() => navigate('/settings')}>
              ajustar
            </Button>
          }
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Typography variant="body2" color="text.secondary">
              Custo fixo mensal
              <Tooltip title="Soma das categorias marcadas como fixas em Configurações → Financeiro.">
                <InfoOutlined sx={{ fontSize: 14, ml: 0.5, verticalAlign: 'middle' }} />
              </Tooltip>
            </Typography>
            <Typography variant="body2" fontWeight={700}>{fmt(health.fixedCost)}</Typography>
          </Box>

          <Box sx={{ mt: 1.5, mb: 0.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Preciso faturar</Typography>
              <Typography variant="body2">
                {fmt(health.invoiced)} de {fmt(health.fixedCost)}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(
                100,
                toNumber(health.fixedCost) === 0
                  ? 100
                  : (toNumber(health.invoiced) / toNumber(health.fixedCost)) * 100,
              )}
              color={health.breakEvenReached ? 'success' : 'warning'}
              sx={{ height: 8, borderRadius: 4, mt: 0.5 }}
            />
            <Typography variant="caption" color={health.breakEvenReached ? 'success.main' : 'warning.main'}>
              {health.breakEvenReached
                ? 'O faturamento do mês já cobre o custo fixo.'
                : `Faltam ${fmt(health.missingToBreakEven)} para cobrir o custo fixo.`}
            </Typography>
          </Box>

          <Divider sx={{ my: 1.5 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Savings fontSize="small" color="action" />
            {rate === null ? (
              <Typography variant="body2" color="text.secondary">
                Ganho por hora indisponível — nenhuma peça entregue com tempo estimado neste mês.
              </Typography>
            ) : (
              <Typography variant="body2">
                Ganho por hora <strong>{fmt(rate)}/h</strong>
                {target ? (
                  <Typography component="span" variant="body2" color={rate >= target ? 'success.main' : 'error.main'}>
                    {' '}· meta {fmt(target)}/h ({rate >= target ? '+' : ''}
                    {Math.round(((rate - target) / target) * 100)}%)
                  </Typography>
                ) : (
                  <Typography component="span" variant="body2" color="text.secondary">
                    {' '}· sem meta definida
                  </Typography>
                )}
              </Typography>
            )}
          </Box>
          {health.deliveredWithoutHours > 0 && (
            <Typography variant="caption" color="text.secondary">
              {health.deliveredWithoutHours} peça(s) entregues sem tempo estimado ficaram de fora da conta.
            </Typography>
          )}
        </Panel>
      </Grid>

      {/* ── Atrasados ───────────────────────────────────────────────────── */}
      <Grid item xs={12}>
        <Panel
          title={`Atrasados · ${fmt(overdue.total)}`}
          action={
            <Button size="small" endIcon={<ArrowForward />} onClick={() => navigate('/financial/a-receber')}>
              ver contas
            </Button>
          }
        >
          {overdue.count === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nenhuma conta vencida. 🎉
            </Typography>
          ) : (
            <Table size="small">
              <TableBody>
                {overdue.items.map((r: any) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ border: 0 }}>{r.customer}</TableCell>
                    <TableCell sx={{ border: 0 }}>
                      <Typography variant="caption" color="text.secondary">{r.description}</Typography>
                    </TableCell>
                    <TableCell sx={{ border: 0 }}>
                      <Chip
                        size="small"
                        color={r.daysOverdue > 30 ? 'error' : 'warning'}
                        label={`${r.daysOverdue} dia${r.daysOverdue === 1 ? '' : 's'}`}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ border: 0 }}>
                      <Typography variant="body2" fontWeight={600}>{fmt(r.amount)}</Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ border: 0, width: 110 }}>
                      {r.phone && (
                        <Button
                          size="small"
                          href={`https://wa.me/55${String(r.phone).replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener"
                        >
                          cobrar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      </Grid>
    </Grid>
  );
}
