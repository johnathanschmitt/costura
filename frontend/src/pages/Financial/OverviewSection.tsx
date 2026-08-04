import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Chip, Button, Alert, Skeleton,
  Table, TableBody, TableCell, TableRow, Collapse, Divider, LinearProgress, Tooltip,
  Link as MuiLink,
} from '@mui/material';
import {
  TrendingUp, TrendingDown, WarningAmber, Savings, ArrowForward, InfoOutlined,
  ChevronRight,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';
import { fmt, toNumber } from './format';
import WorkQueue from './WorkQueue';
import { useCompact } from '../../hooks/useCompact';

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
 * Linha de detalhe que abre uma tela. Não é aviso: é informação verdadeira todo
 * dia, e faixa colorida permanente o olho aprende a pular.
 */
function DetailLine({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5,
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? { color: 'primary.main' } : undefined,
      }}
    >
      <ChevronRight sx={{ fontSize: 16, color: 'text.disabled' }} />
      <Typography variant="body2" color="text.secondary">{children}</Typography>
    </Box>
  );
}

/**
 * Tela de abertura do financeiro. A leitura é uma só e nesta ordem: o que
 * precisa de você hoje, quanto você tem, e depois o mês. Cinco blocos de mesmo
 * peso visual não formavam leitura nenhuma — o olho não sabia onde pousar.
 */
export default function OverviewSection() {
  const navigate = useNavigate();
  const compact = useCompact();
  const [showCommitted, setShowCommitted] = useState(false);
  const [showWithdrawMath, setShowWithdrawMath] = useState(false);

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

  const {
    money, month, untilEndOfMonth: ahead, health, overdue, cashRegister, todo = [],
  } = data;
  const variation = month.resultVariation === null ? null : toNumber(month.resultVariation);
  const rate = health.hourlyRate === null ? null : toNumber(health.hourlyRate);
  const target = health.targetHourlyRate === null ? null : toNumber(health.targetHourlyRate);
  const withdraw = money.safeToWithdraw;
  const canWithdraw = toNumber(withdraw?.amount) > 0;

  // Sem custo fixo configurado, dizer "coberto ✓" com R$ 0,00 é responder
  // errado com cara de certo — melhor não responder.
  const hasFixedCost = toNumber(health.fixedCost) > 0;

  return (
    <Box>
      <WorkQueue items={todo} />

      <Grid container spacing={2}>
        {/* ── Você tem hoje — o número que domina a tela ─────────────────── */}
        <Grid item xs={12}>
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="overline" color="text.secondary" letterSpacing={0.8}>
                  Você tem hoje
                </Typography>
                {cashRegister
                  ? <Chip size="small" color="success" label={`caixa aberto ${dayjs(cashRegister.openedAt).format('HH:mm')}`} />
                  : <Chip size="small" label="caixa fechado" />}
              </Box>

              <Typography variant="h3" fontWeight={700} sx={{ my: 0.5 }}>
                {fmt(money.total)}
              </Typography>

              {/* Saldo por conta é assunto de "Onde está o dinheiro": aqui basta
                  uma linha, sem caixinha nenhuma disputando o número grande. */}
              <Typography variant="body2" color="text.secondary">
                {(money.accounts ?? []).map((a: any) => `${a.name} ${fmt(a.balance)}`).join(' · ')}
                {toNumber(money.reserve) > 0 && ` · reserva ${fmt(money.reserve)} (fora do disponível)`}
              </Typography>

              {toNumber(money.pendingCard) > 0 && (
                <DetailLine onClick={() => navigate('/financial/onde-esta-o-dinheiro')}>
                  <strong>{fmt(money.pendingCard)}</strong> em vendas no cartão ainda não caíram na
                  conta — já descontada a taxa da maquininha.
                </DetailLine>
              )}

              {toNumber(money.committed) > 0 && (
                <DetailLine onClick={() => setShowCommitted(s => !s)}>
                  <strong>{fmt(money.committed)}</strong> são sinais de {money.committedCount} peça(s)
                  ainda não entregues — esse dinheiro ainda tem trabalho e material pela frente.
                </DetailLine>
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

              {/* A pergunta que não estava em tela nenhuma. A conta fica visível
                  embaixo: sem ela à mostra ninguém confia no número. */}
              {withdraw && (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2 }}>
                    <Typography variant="body1">Dá para retirar com segurança</Typography>
                    <Typography
                      variant="h6"
                      fontWeight={700}
                      color={canWithdraw ? 'success.main' : 'error.main'}
                    >
                      {fmt(withdraw.amount)}
                    </Typography>
                  </Box>
                  <MuiLink
                    component="button"
                    variant="caption"
                    underline="hover"
                    color="text.secondary"
                    onClick={() => setShowWithdrawMath(s => !s)}
                    sx={{ display: 'block', textAlign: 'left' }}
                  >
                    {fmt(withdraw.available)} disponível − {fmt(withdraw.committed)} de sinais −{' '}
                    {fmt(withdraw.payables)} de contas até{' '}
                    {dayjs(withdraw.payablesUntil).format('DD/MM')}
                    {showWithdrawMath ? '' : ' ⌄'}
                  </MuiLink>
                  <Collapse in={showWithdrawMath}>
                    <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                      A reserva do ateliê não entra na conta porque já fica fora do disponível.
                      {!canWithdraw && ' Hoje as obrigações do mês passam do que há em caixa.'}
                    </Typography>
                  </Collapse>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Mês atual ─────────────────────────────────────────────────── */}
        <Grid item xs={12} md={4}>
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

        {/* ── Até o fim do mês ──────────────────────────────────────────── */}
        <Grid item xs={12} md={4}>
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

            {/* Estado normal é texto cinza. Faixa vermelha só quando há o que
                fazer hoje — senão o olho aprende a pular aquele lugar. */}
            {ahead.coversPayables ? (
              <Typography variant="body2" color="text.secondary">
                Dá para pagar tudo sem o saldo ficar negativo.
              </Typography>
            ) : (
              <Alert severity="error" icon={<WarningAmber fontSize="small" />} sx={{ py: 0.5 }}>
                Em <strong>{dayjs(ahead.lowest.date).format('DD/MM')}</strong> o saldo fica em{' '}
                <strong>{fmt(ahead.lowest.balance)}</strong> — falta dinheiro para as contas do mês.
              </Alert>
            )}
          </Panel>
        </Grid>

        {/* ── Saúde do ateliê ───────────────────────────────────────────── */}
        <Grid item xs={12} md={4}>
          <Panel
            title="Saúde do ateliê"
            action={
              <Button size="small" endIcon={<ArrowForward />} onClick={() => navigate('/settings#financeiro')}>
                ajustar
              </Button>
            }
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Typography variant="body2" color="text.secondary">
                Custo fixo mensal
                <Tooltip title="Soma das categorias marcadas como fixas em Configurações → Categorias.">
                  <InfoOutlined sx={{ fontSize: 14, ml: 0.5, verticalAlign: 'middle' }} />
                </Tooltip>
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {hasFixedCost ? fmt(health.fixedCost) : '—'}
              </Typography>
            </Box>

            {hasFixedCost ? (
              <Box sx={{ mt: 1.5, mb: 0.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Preciso faturar</Typography>
                  <Typography variant="body2">
                    {fmt(health.invoiced)} de {fmt(health.fixedCost)}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, (toNumber(health.invoiced) / toNumber(health.fixedCost)) * 100)}
                  color={health.breakEvenReached ? 'success' : 'warning'}
                  sx={{ height: 8, borderRadius: 4, mt: 0.5 }}
                />
                <Typography variant="caption" color={health.breakEvenReached ? 'success.main' : 'warning.main'}>
                  {health.breakEvenReached
                    ? 'O faturamento do mês já cobre o custo fixo.'
                    : `Faltam ${fmt(health.missingToBreakEven)} para cobrir o custo fixo.`}
                </Typography>
              </Box>
            ) : (
              <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                Sem nenhuma categoria marcada como custo fixo, não dá para dizer se o mês se paga.
              </Typography>
            )}

            <Divider sx={{ my: 1.5 }} />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Savings fontSize="small" color="action" />
              {rate === null ? (
                <Typography variant="body2" color="text.secondary">
                  Ganho por hora indisponível — nenhuma peça entregue com tempo estimado neste mês.
                </Typography>
              ) : (
                <Typography variant="body2">
                  {/* O número na unidade da vida real: quanto rendeu cada hora
                      de costura, não uma variação percentual para interpretar. */}
                  Cada hora de costura rendeu <strong>{fmt(rate)}</strong>
                  {target ? (
                    <Typography component="span" variant="body2" color={rate >= target ? 'success.main' : 'error.main'}>
                      {' '}— {fmt(Math.abs(rate - target))} {rate >= target ? 'acima' : 'abaixo'} da
                      meta de {fmt(target)}
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

        {/* ── Atrasados — some por inteiro quando não há nenhum ──────────── */}
        {overdue.count > 0 && (
          <Grid item xs={12}>
            <Panel
              title={`Atrasados · ${fmt(overdue.total)}`}
              action={
                <Button size="small" endIcon={<ArrowForward />} onClick={() => navigate('/financial/contas-do-mes')}>
                  ver contas
                </Button>
              }
            >
              {/* No telefone cada atrasado vira uma linha com nome, valor e o
                  botão de cobrar — que é tudo o que se usa dali. */}
              {compact ? (
                overdue.items.map((r: any) => (
                  <Box
                    key={r.id}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderTop: 1, borderColor: 'divider' }}
                  >
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>{r.customer}</Typography>
                      <Typography variant="caption" color="error.main">
                        {fmt(r.amount)} · há {r.daysOverdue} dia{r.daysOverdue === 1 ? '' : 's'}
                      </Typography>
                    </Box>
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
                  </Box>
                ))
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
        )}
      </Grid>
    </Box>
  );
}
