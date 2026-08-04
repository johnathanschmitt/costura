import {
  Box, Card, CardContent, Typography, Chip, Button, Skeleton, Stack, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import { Add, ArrowForward } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';
import { useCompact } from '../../hooks/useCompact';
import { STATUS_MAP, fmt } from '../WorkOrders/constants';

/** Peça ainda em casa é a que precisa de atenção; entregue e cancelada são histórico. */
const OPEN = ['PENDING', 'IN_PROGRESS', 'WAITING_MATERIAL', 'FITTING', 'DONE'];

/**
 * Todas as peças da cliente, dentro da ficha dela.
 *
 * A ficha respondia "quem é" e "quanto ela deve", mas não "o que ela já deixou
 * aqui" — que é a pergunta feita no balcão e ao telefone. O histórico existia
 * espalhado na lista de OS, filtrável por nome; aqui ele vem junto do resto,
 * ordenado da peça mais recente para a mais antiga.
 */
export default function CustomerWorkOrdersCard({ customerId }: { customerId: string }) {
  const navigate = useNavigate();
  const compact = useCompact();

  const { data, isLoading } = useQuery({
    queryKey: ['customer-work-orders', customerId],
    queryFn: () => api.get('/work-orders', {
      params: { customerId, limit: 100 },
    }).then(r => r.data),
  });

  const rows = (data?.data ?? []) as any[];
  const open = rows.filter(r => OPEN.includes(r.status));
  const delivered = rows.filter(r => r.status === 'DELIVERED');
  const owing = rows.reduce((s, r) => s + Number(r.financials?.balance ?? 0), 0);

  const openOs = (id: string) => navigate(`/work-orders/${id}/edit`);

  const summary = isLoading ? null : (
    <Typography variant="body2" color="text.secondary">
      {rows.length === 0
        ? 'nenhuma peça ainda'
        : [
          `${rows.length} peça${rows.length === 1 ? '' : 's'}`,
          open.length > 0 && `${open.length} em aberto`,
          delivered.length > 0 && `${delivered.length} entregue${delivered.length === 1 ? '' : 's'}`,
        ].filter(Boolean).join(' · ')}
    </Typography>
  );

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1.5, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>Peças</Typography>
            {summary}
          </Box>
          <Button
            size="small"
            startIcon={<Add />}
            onClick={() => navigate(`/work-orders/new?customerId=${customerId}`)}
          >
            Nova OS
          </Button>
        </Box>

        {isLoading ? (
          <Stack spacing={1}>{[0, 1, 2].map(i => <Skeleton key={i} height={40} />)}</Stack>
        ) : rows.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
            <Typography variant="body1" fontWeight={600} gutterBottom>
              Esta cliente ainda não tem nenhuma peça.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              As OS abertas para ela aparecem aqui, da mais recente para a mais antiga, com o
              status e o que falta pagar em cada uma.
            </Typography>
          </Box>
        ) : compact ? (
          <Stack spacing={1}>
            {rows.map(wo => {
              const s = STATUS_MAP[wo.status] ?? { label: wo.status, color: 'default' };
              const balance = Number(wo.financials?.balance ?? 0);
              return (
                <Paper
                  key={wo.id}
                  variant="outlined"
                  sx={{ p: 1.5, cursor: 'pointer' }}
                  onClick={() => openOs(wo.id)}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {wo.number} · {wo.garment?.name ?? 'Peça'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        aberta em {dayjs(wo.createdAt).format('DD/MM/YYYY')}
                      </Typography>
                    </Box>
                    <Chip label={s.label} size="small" color={s.color} sx={{ alignSelf: 'flex-start' }} />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      {fmt(wo.financials?.total)}
                    </Typography>
                    {balance > 0.005 && (
                      <Typography variant="caption" color="error.main" fontWeight={600}>
                        faltam {fmt(balance)}
                      </Typography>
                    )}
                  </Box>
                </Paper>
              );
            })}
          </Stack>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>OS</TableCell>
                  <TableCell>Peça</TableCell>
                  <TableCell>Aberta em</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Valor</TableCell>
                  <TableCell align="right">Falta pagar</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(wo => {
                  const s = STATUS_MAP[wo.status] ?? { label: wo.status, color: 'default' };
                  const balance = Number(wo.financials?.balance ?? 0);
                  return (
                    <TableRow
                      key={wo.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => openOs(wo.id)}
                    >
                      <TableCell>{wo.number}</TableCell>
                      <TableCell>{wo.garment?.name ?? '—'}</TableCell>
                      <TableCell>{dayjs(wo.createdAt).format('DD/MM/YYYY')}</TableCell>
                      <TableCell><Chip label={s.label} size="small" color={s.color} /></TableCell>
                      <TableCell align="right">{fmt(wo.financials?.total)}</TableCell>
                      <TableCell align="right">
                        {balance > 0.005 ? (
                          <Typography variant="body2" fontWeight={600} color="error.main">
                            {fmt(balance)}
                          </Typography>
                        ) : (
                          <Typography variant="caption" color="text.secondary">—</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* A soma do que ela deve some no meio da lista quando há muitas peças. */}
        {owing > 0.005 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="body2">
              Somando tudo, ela ainda deve <strong>{fmt(owing)}</strong>.
            </Typography>
            <Button size="small" endIcon={<ArrowForward />} onClick={() => navigate('/financial/contas-do-mes')}>
              Ver as contas
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
