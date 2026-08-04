import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Button, Skeleton, TablePagination, Collapse, Stack,
} from '@mui/material';
import {
  Print, CheckCircleOutline, WarningAmber, LockOpen, ArrowBack, ExpandMore, ExpandLess,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';
import { fmt, toNumber } from './format';
import { useCompact } from '../../hooks/useCompact';

/**
 * Histórico de aberturas e fechamentos.
 *
 * Eram dez colunas — a tabela mais larga do módulo — para responder uma
 * pergunta: bateu? Abertura, esperado, contado e diferença viraram uma coluna
 * de resultado, com os quatro números no detalhe de quem quiser abrir. As
 * colunas de autoria saíram da tela enquanto há uma pessoa só operando; o
 * registro continua no banco, para o dia em que houver duas.
 */
export default function CashHistorySection() {
  const navigate = useNavigate();
  const compact = useCompact();
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['cash-registers', page, limit],
    queryFn: () => api.get('/financial/cash-register', {
      params: { page: page + 1, limit },
    }).then(r => r.data),
  });

  const rows = data?.data ?? [];
  const summary = data?.summary;
  const total = data?.total ?? 0;

  return (
    <Box>
      <Button size="small" startIcon={<ArrowBack />} sx={{ mb: 2 }} onClick={() => navigate('/financial/caixa')}>
        voltar para o caixa
      </Button>

      {/* Dos três cartões de resumo, só um muda o que se faz: quantos
          fechamentos não bateram. */}
      {summary && summary.withDifferenceCount > 0 && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary">Fechamentos que não bateram</Typography>
            <Typography variant="h5" fontWeight={700} color="warning.main">
              {summary.withDifferenceCount} de {summary.closedCount}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              somando {fmt(summary.differenceTotal)}
              {toNumber(summary.differenceTotal) < 0 ? ' de dinheiro que faltou' : ' de sobra'}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* No telefone o histórico vira uma lista de dias: bateu ou não bateu. */}
      {compact ? (
        <Stack spacing={1}>
          {isLoading && [0, 1, 2].map(i => <Skeleton key={i} variant="rounded" height={72} />)}
          {!isLoading && rows.length === 0 && (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1" fontWeight={600} gutterBottom>
                Nenhum caixa fechado ainda.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Cada dia que você abre e fecha o caixa vira uma linha aqui, com o que foi contado e
                a diferença, se houver.
              </Typography>
            </Paper>
          )}
          {rows.map((r: any) => {
            const open = r.status === 'OPEN';
            const diff = toNumber(r.difference);
            const hasDiff = !open && Math.abs(diff) >= 0.005;
            return (
              <Paper key={r.id} variant="outlined" sx={{ p: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {dayjs(r.openedAt).format('DD/MM/YYYY')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {open ? 'ainda aberto' : `fechou às ${dayjs(r.closedAt).format('HH:mm')}`}
                      {` · ${r._count?.transactions ?? 0} lançamentos`}
                    </Typography>
                  </Box>
                  {!open && (hasDiff ? (
                    <Chip
                      size="small"
                      color={diff < 0 ? 'error' : 'warning'}
                      icon={<WarningAmber />}
                      label={`${diff < 0 ? 'faltou' : 'sobrou'} ${fmt(Math.abs(diff))}`}
                    />
                  ) : (
                    <Chip size="small" color="success" icon={<CheckCircleOutline />} label="bateu" />
                  ))}
                </Box>
                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    contado {open ? '—' : fmt(r.countedBalance)}
                  </Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  {!open && (
                    <Button size="small" startIcon={<Print />} onClick={() => navigate(`/financial/cash-register/${r.id}/report`)}>
                      relatório
                    </Button>
                  )}
                </Box>
                {hasDiff && r.notes && (
                  <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                    {r.notes}
                  </Typography>
                )}
              </Paper>
            );
          })}
        </Stack>
      ) : (
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Dia</TableCell>
              <TableCell>Fechou às</TableCell>
              <TableCell>Bateu?</TableCell>
              <TableCell align="right">Lançamentos</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 5 }).map((__, j) => <TableCell key={j}><Skeleton /></TableCell>)}
              </TableRow>
            ))}

            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
                    <Typography variant="body1" fontWeight={600} gutterBottom>
                      Nenhum caixa fechado ainda.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Cada dia que você abre e fecha o caixa vira uma linha aqui, com o que foi
                      contado e a diferença, se houver.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}

            {rows.map((r: any) => {
              const open = r.status === 'OPEN';
              const diff = toNumber(r.difference);
              const hasDiff = !open && Math.abs(diff) >= 0.005;
              const isOpen = expanded === r.id;
              return [
                <TableRow key={r.id} hover>
                  <TableCell>{dayjs(r.openedAt).format('DD/MM/YYYY')}</TableCell>
                  <TableCell>
                    {open
                      ? <Chip size="small" color="success" icon={<LockOpen />} label="ainda aberto" />
                      : dayjs(r.closedAt).format('HH:mm')}
                  </TableCell>
                  <TableCell>
                    {open ? '—' : hasDiff ? (
                      <Chip
                        size="small"
                        color={diff < 0 ? 'error' : 'warning'}
                        icon={<WarningAmber />}
                        label={`${diff < 0 ? 'faltou' : 'sobrou'} ${fmt(Math.abs(diff))}`}
                      />
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <CheckCircleOutline fontSize="small" color="success" />
                        <Typography variant="body2" color="text.secondary">bateu certinho</Typography>
                      </Box>
                    )}
                  </TableCell>
                  <TableCell align="right">{r._count?.transactions ?? 0}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      endIcon={isOpen ? <ExpandLess /> : <ExpandMore />}
                      onClick={() => setExpanded(e => (e === r.id ? null : r.id))}
                    >
                      detalhe
                    </Button>
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
                </TableRow>,
                <TableRow key={`${r.id}-detail`}>
                  <TableCell colSpan={5} sx={{ py: 0, border: 0 }}>
                    <Collapse in={isOpen}>
                      <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', py: 1.5 }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">Abertura</Typography>
                          <Typography variant="body2">{fmt(r.openingBalance)}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">Esperado</Typography>
                          <Typography variant="body2">{open ? '—' : fmt(r.closingBalance)}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">Contado</Typography>
                          <Typography variant="body2">{open ? '—' : fmt(r.countedBalance)}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">Aberto em</Typography>
                          <Typography variant="body2">{dayjs(r.openedAt).format('DD/MM/YY HH:mm')}</Typography>
                        </Box>
                        {hasDiff && (
                          <Box sx={{ minWidth: 220 }}>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Justificativa
                            </Typography>
                            <Typography variant="body2">{r.notes || 'sem justificativa'}</Typography>
                          </Box>
                        )}
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>,
              ];
            })}
          </TableBody>
        </Table>
        {total > limit && (
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={limit}
            onRowsPerPageChange={e => { setLimit(Number(e.target.value)); setPage(0); }}
            rowsPerPageOptions={[20, 50]}
            labelRowsPerPage="Por página"
          />
        )}
      </TableContainer>
      )}
    </Box>
  );
}
