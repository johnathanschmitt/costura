import { useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, IconButton, Skeleton,
  Button, Alert, Avatar, Divider, Accordion, AccordionSummary, AccordionDetails,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tooltip,
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

const monthLabel = (key: string) => dayjs(`${key}-01`).format('MMMM [de] YYYY');

export default function DistributionSection() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [closeOpen, setCloseOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
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

  const shift = (d: number) => setMonth(m => dayjs(`${m}-01`).add(d, 'month').format('YYYY-MM'));
  const isCurrent = month === dayjs().format('YYYY-MM');

  if (isLoading) return <Skeleton variant="rounded" height={340} />;

  const result = toNumber(data.result);
  const closed = data.closed;

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

      {data.shares.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Nenhuma sócia cadastrada. Marque quem são as sócias em{' '}
          <strong>Configurações → Usuários</strong> para o sistema calcular a divisão.
        </Alert>
      )}

      {result <= 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          O mês fechou {result === 0 ? 'zerado' : `negativo em ${fmt(Math.abs(result))}`} — não há
          resultado a dividir.
        </Alert>
      )}

      {closed && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Divisão fechada em {dayjs(closed.closedAt).format('DD/MM/YYYY [às] HH:mm')} com os valores
          congelados abaixo. Lançamentos feitos depois disso não alteram estes números.
          {closed.notes && <> — <em>{closed.notes}</em></>}
        </Alert>
      )}

      {/* Resumo da divisão */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>Resultado a dividir</Typography>
            <Typography variant="h5" fontWeight={700} color={result >= 0 ? 'success.main' : 'error.main'}>
              {fmt(closed ? closed.result : data.result)}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Entrou {fmt(data.income)} · saiu {fmt(data.expense)} · dividido em{' '}
            <strong>{data.parts} partes iguais</strong> ({data.shares.length} sócias + o ateliê)
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Grid container spacing={2}>
            {(closed ? closed.shares : data.shares).map((s: any) => (
              <Grid item xs={12} sm={6} md={3} key={s.userId}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Avatar sx={{ mx: 'auto', mb: 1, bgcolor: 'secondary.main' }}>
                      {s.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Typography variant="body2" noWrap>{s.name}</Typography>
                    <Typography variant="h6" fontWeight={700} color="success.main">
                      {fmt(s.amount)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      produziu {s.deliveredCount} peça{s.deliveredCount === 1 ? '' : 's'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ height: '100%', bgcolor: 'primary.main', color: 'white' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Avatar sx={{ mx: 'auto', mb: 1, bgcolor: 'rgba(255,255,255,0.2)' }}>
                    <Storefront />
                  </Avatar>
                  <Typography variant="body2">Ateliê</Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {fmt(closed ? closed.atelierShare : data.atelierShare)}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.85 }}>
                    fica para os gastos
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
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
