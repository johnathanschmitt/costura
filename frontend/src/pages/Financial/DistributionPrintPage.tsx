import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Button, Divider, Table, TableBody, TableCell,
  TableHead, TableRow, CircularProgress, Paper,
} from '@mui/material';
import { Print, ArrowBack } from '@mui/icons-material';
import dayjs from 'dayjs';
import api from '../../services/api';
import { fmt, toNumber } from './format';
import { PRINT_CSS } from '../Quotes/print.css';

const INK = '#1a1a1a';
const MUTED = '#6b6b6b';
const BRAND = '#7B3F8C';

export default function DistributionPrintPage() {
  const { month } = useParams<{ month: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['distribution', month],
    queryFn: () => api.get('/financial/distribution', { params: { month } }).then(r => r.data),
  });

  useEffect(() => { if (data) setTimeout(() => window.print(), 600); }, [data]);
  if (isLoading || !data) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>;
  }

  const biz = data.business;
  const closed = data.closed;
  const shares = closed ? closed.shares : data.shares;
  const result = toNumber(closed ? closed.result : data.result);

  return (
    <>
      <style>{PRINT_CSS}</style>
      <Box className="no-print" sx={{ p: 2, display: 'flex', gap: 1, bgcolor: 'grey.100', borderBottom: 1, borderColor: 'divider' }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/financial')}>Voltar</Button>
        <Button variant="contained" startIcon={<Print />} onClick={() => window.print()}>Imprimir / Salvar PDF</Button>
      </Box>

      <Box sx={{ bgcolor: 'grey.200', py: { xs: 0, sm: 4 }, minHeight: '100vh', '@media print': { bgcolor: '#fff', py: 0 } }}>
        <Paper elevation={3} className="quote-doc" sx={{
          maxWidth: '210mm', mx: 'auto', p: { xs: '10mm', sm: '14mm' }, color: INK,
          WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
          '@media print': { boxShadow: 'none' },
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Typography sx={{ fontSize: 20, fontWeight: 700, color: BRAND }}>{biz?.name ?? 'Ateliê'}</Typography>
            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontSize: 11, letterSpacing: 1.5, color: MUTED, fontWeight: 600 }}>
                DIVISÃO DO RESULTADO
              </Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 700, color: BRAND, textTransform: 'capitalize' }}>
                {dayjs(`${data.month}-01`).format('MMMM [de] YYYY')}
              </Typography>
              {closed && (
                <Typography sx={{ fontSize: 11, color: MUTED }}>
                  Fechada em {dayjs(closed.closedAt).format('DD/MM/YYYY')}
                </Typography>
              )}
            </Box>
          </Box>

          <Box sx={{ height: 3, bgcolor: BRAND, borderRadius: 2, mt: 2, mb: 3 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography sx={{ fontSize: 13 }}>Entrou no mês</Typography>
            <Typography sx={{ fontSize: 13 }}>{fmt(data.income)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography sx={{ fontSize: 13 }}>Saiu no mês</Typography>
            <Typography sx={{ fontSize: 13 }}>− {fmt(data.expense)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', borderTop: `2px solid ${BRAND}`, pt: 1, mb: 3 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>RESULTADO A DIVIDIR</Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 700, color: BRAND }}>{fmt(result)}</Typography>
          </Box>

          <Typography sx={{ fontSize: 10, letterSpacing: 1, color: MUTED, fontWeight: 700, mb: 0.5 }}>
            DIVIDIDO EM {data.parts} PARTES IGUAIS
          </Typography>
          <Table size="small" sx={{ mb: 3 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ px: 0, fontSize: 11, color: MUTED }}>Destino</TableCell>
                <TableCell align="right" sx={{ px: 0, fontSize: 11, color: MUTED }}>Peças no mês</TableCell>
                <TableCell align="right" sx={{ px: 0, fontSize: 11, color: MUTED }}>A receber</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {shares.map((s: any) => (
                <TableRow key={s.userId}>
                  <TableCell sx={{ px: 0, py: 0.75, fontSize: 13 }}>{s.name}</TableCell>
                  <TableCell align="right" sx={{ px: 0, py: 0.75, fontSize: 13, color: MUTED }}>
                    {s.deliveredCount} ({fmt(s.deliveredValue)})
                  </TableCell>
                  <TableCell align="right" sx={{ px: 0, py: 0.75, fontSize: 14, fontWeight: 700 }}>
                    {fmt(s.amount)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell sx={{ px: 0, py: 0.75, fontSize: 13, fontWeight: 700 }}>
                  Ateliê — reserva para gastos
                </TableCell>
                <TableCell />
                <TableCell align="right" sx={{ px: 0, py: 0.75, fontSize: 14, fontWeight: 700 }}>
                  {fmt(closed ? closed.atelierShare : data.atelierShare)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          {data.shares.some((s: any) => s.items?.length) && (
            <>
              <Typography sx={{ fontSize: 10, letterSpacing: 1, color: MUTED, fontWeight: 700, mb: 0.5 }}>
                PRODUÇÃO DETALHADA
              </Typography>
              {data.shares.filter((s: any) => s.items?.length).map((s: any) => (
                <Box key={s.userId} sx={{ mb: 2, breakInside: 'avoid' }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.5 }}>{s.name}</Typography>
                  <Table size="small">
                    <TableBody>
                      {s.items.map((i: any) => (
                        <TableRow key={i.id}>
                          <TableCell sx={{ px: 0, py: 0.4, border: 0, fontSize: 12, width: 90 }}>{i.number}</TableCell>
                          <TableCell sx={{ px: 0, py: 0.4, border: 0, fontSize: 12 }}>{i.customer}</TableCell>
                          <TableCell sx={{ px: 0, py: 0.4, border: 0, fontSize: 12, color: MUTED, width: 70 }}>
                            {dayjs(i.deliveredAt).format('DD/MM')}
                          </TableCell>
                          <TableCell align="right" sx={{ px: 0, py: 0.4, border: 0, fontSize: 12, width: 100 }}>
                            {fmt(i.value)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              ))}
            </>
          )}

          <Divider sx={{ mb: 1.5 }} />
          <Typography sx={{ fontSize: 10.5, color: MUTED, textAlign: 'center' }}>
            A divisão é igual entre as sócias e o ateliê. A produção listada é para acompanhamento
            e não altera os valores.
          </Typography>

          <Box sx={{ mt: 5, display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'space-around' }}>
            {shares.map((s: any) => (
              <Box key={s.userId} sx={{ width: 160, textAlign: 'center' }}>
                <Divider sx={{ borderColor: INK }} />
                <Typography sx={{ fontSize: 10.5, color: MUTED, mt: 0.5 }}>{s.name}</Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      </Box>
    </>
  );
}
