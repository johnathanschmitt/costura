import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Button, Skeleton, TablePagination, Grid, Tooltip,
} from '@mui/material';
import { Print, CheckCircleOutline, WarningAmber, LockOpen } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';
import { fmt, toNumber } from './format';

/**
 * Histórico de aberturas e fechamentos.
 *
 * Os dados e o endpoint já existiam desde sempre — o que faltava era a tela.
 * Sem ela, fechado o caixa, o turno sumia: não dava para revisitar uma
 * diferença nem lembrar quem estava no balcão naquele dia.
 */
export default function CashHistorySection() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);

  const { data, isLoading } = useQuery({
    queryKey: ['cash-registers', page, limit],
    queryFn: () => api.get('/financial/cash-register', {
      params: { page: page + 1, limit },
    }).then(r => r.data),
  });

  const rows = data?.data ?? [];
  const summary = data?.summary;

  return (
    <Box>
      {summary && (
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body2" color="text.secondary">Caixas fechados</Typography>
                <Typography variant="h5" fontWeight={700}>{summary.closedCount}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body2" color="text.secondary">Fechamentos com diferença</Typography>
                <Typography
                  variant="h5"
                  fontWeight={700}
                  color={summary.withDifferenceCount > 0 ? 'warning.main' : 'text.primary'}
                >
                  {summary.withDifferenceCount}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body2" color="text.secondary">Soma das diferenças</Typography>
                <Typography
                  variant="h5"
                  fontWeight={700}
                  color={toNumber(summary.differenceTotal) < 0 ? 'error.main' : 'success.main'}
                >
                  {fmt(summary.differenceTotal)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  negativo = faltou dinheiro
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Aberto em</TableCell>
              <TableCell>Fechado em</TableCell>
              <TableCell>Abriu</TableCell>
              <TableCell>Fechou</TableCell>
              <TableCell align="right">Abertura</TableCell>
              <TableCell align="right">Esperado</TableCell>
              <TableCell align="right">Contado</TableCell>
              <TableCell align="right">Diferença</TableCell>
              <TableCell align="right">Lançamentos</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 10 }).map((__, j) => (
                  <TableCell key={j}><Skeleton /></TableCell>
                ))}
              </TableRow>
            ))}

            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  <Typography variant="body2" color="text.secondary" py={3}>
                    Nenhum caixa registrado ainda.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {rows.map((r: any) => {
              const open = r.status === 'OPEN';
              const diff = toNumber(r.difference);
              const hasDiff = !open && Math.abs(diff) >= 0.005;
              return (
                <TableRow key={r.id} hover>
                  <TableCell>{dayjs(r.openedAt).format('DD/MM/YY HH:mm')}</TableCell>
                  <TableCell>
                    {open
                      ? <Chip size="small" color="success" icon={<LockOpen />} label="aberto" />
                      : dayjs(r.closedAt).format('DD/MM/YY HH:mm')}
                  </TableCell>
                  <TableCell>{r.openedBy?.name ?? '—'}</TableCell>
                  <TableCell>{r.closedBy?.name ?? '—'}</TableCell>
                  <TableCell align="right">{fmt(r.openingBalance)}</TableCell>
                  <TableCell align="right">{open ? '—' : fmt(r.closingBalance)}</TableCell>
                  <TableCell align="right">{open ? '—' : fmt(r.countedBalance)}</TableCell>
                  <TableCell align="right">
                    {open ? '—' : hasDiff ? (
                      <Tooltip title={r.notes ?? 'sem justificativa'}>
                        <Chip
                          size="small"
                          color={diff < 0 ? 'error' : 'warning'}
                          icon={<WarningAmber />}
                          label={fmt(diff)}
                        />
                      </Tooltip>
                    ) : (
                      <CheckCircleOutline fontSize="small" color="success" />
                    )}
                  </TableCell>
                  <TableCell align="right">{r._count?.transactions ?? 0}</TableCell>
                  <TableCell align="right">
                    {!open && (
                      <Button
                        size="small"
                        startIcon={<Print />}
                        onClick={() => navigate(`/financial/cash-register/${r.id}/report`)}
                      >
                        relatório
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={data?.total ?? 0}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={limit}
          onRowsPerPageChange={e => { setLimit(Number(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50]}
          labelRowsPerPage="Por página"
        />
      </TableContainer>
    </Box>
  );
}
