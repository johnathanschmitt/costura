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

function Section({ title, rows, total, sign }: any) {
  return (
    <Box sx={{ breakInside: 'avoid', mb: 2.5 }}>
      <Typography sx={{ fontSize: 10, letterSpacing: 1, color: MUTED, fontWeight: 700, mb: 0.5 }}>
        {title}
      </Typography>
      <Table size="small">
        <TableBody>
          {rows.map((r: any) => (
            <TableRow key={r.category}>
              <TableCell sx={{ px: 0, py: 0.6, border: 0, fontSize: 13 }}>{r.category}</TableCell>
              <TableCell align="right" sx={{ px: 0, py: 0.6, border: 0, fontSize: 12, color: MUTED, width: 70 }}>
                {toNumber(r.share).toFixed(1)}%
              </TableCell>
              <TableCell align="right" sx={{ px: 0, py: 0.6, border: 0, fontSize: 13, width: 120 }}>
                {sign} {fmt(r.amount)}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell sx={{ px: 0, py: 0.6, border: 0, fontSize: 12, color: MUTED }}>
                Nada registrado no mês.
              </TableCell>
            </TableRow>
          )}
          <TableRow>
            <TableCell sx={{ px: 0, pt: 1, borderTop: `1px solid ${INK}`, fontSize: 13, fontWeight: 700 }}>
              Total
            </TableCell>
            <TableCell sx={{ borderTop: `1px solid ${INK}` }} />
            <TableCell align="right" sx={{ px: 0, pt: 1, borderTop: `1px solid ${INK}`, fontSize: 13, fontWeight: 700 }}>
              {sign} {fmt(total)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Box>
  );
}

export default function MonthlyClosingPage() {
  const { month } = useParams<{ month: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['monthly-result', month],
    queryFn: () => api.get('/financial/monthly-result', { params: { month } }).then(r => r.data),
  });

  useEffect(() => {
    if (data) setTimeout(() => window.print(), 600);
  }, [data]);

  if (isLoading || !data) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>;
  }

  const c = data.current;
  const biz = data.business;
  const result = toNumber(c.result);
  const ind = data.indicators;

  return (
    <>
      <style>{PRINT_CSS}</style>

      <Box className="no-print" sx={{ p: 2, display: 'flex', gap: 1, bgcolor: 'grey.100', borderBottom: 1, borderColor: 'divider' }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/financial')}>Voltar</Button>
        <Button variant="contained" startIcon={<Print />} onClick={() => window.print()}>
          Imprimir / Salvar PDF
        </Button>
      </Box>

      <Box sx={{ bgcolor: 'grey.200', py: { xs: 0, sm: 4 }, minHeight: '100vh', '@media print': { bgcolor: '#fff', py: 0 } }}>
        <Paper
          elevation={3}
          className="quote-doc"
          sx={{
            maxWidth: '210mm', mx: 'auto', p: { xs: '10mm', sm: '14mm' }, color: INK,
            WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
            '@media print': { boxShadow: 'none' },
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography sx={{ fontSize: 20, fontWeight: 700, color: BRAND }}>
                {biz?.name ?? 'Ateliê'}
              </Typography>
              {biz?.taxId && <Typography sx={{ fontSize: 11.5, color: MUTED }}>CNPJ/CPF: {biz.taxId}</Typography>}
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontSize: 11, letterSpacing: 1.5, color: MUTED, fontWeight: 600 }}>
                FECHAMENTO MENSAL
              </Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 700, color: BRAND, textTransform: 'capitalize' }}>
                {dayjs(`${data.month}-01`).format('MMMM [de] YYYY')}
              </Typography>
              <Typography sx={{ fontSize: 11, color: MUTED }}>
                Emitido em {dayjs().format('DD/MM/YYYY [às] HH:mm')}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ height: 3, bgcolor: BRAND, borderRadius: 2, mt: 2, mb: 3 }} />

          <Section title="RECEITAS" rows={c.incomeByCategory} total={c.income} sign="" />
          <Section title="DESPESAS" rows={c.expenseByCategory} total={c.expense} sign="−" />

          {/* Resultado */}
          <Box
            sx={{
              bgcolor: result >= 0 ? '#e6f4ea' : '#fdecea',
              border: `1px solid ${result >= 0 ? '#1e6b34' : '#a3271f'}`,
              borderRadius: 1, p: 2, mb: 3, breakInside: 'avoid',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                RESULTADO DO MÊS
              </Typography>
              <Typography sx={{ fontSize: 24, fontWeight: 700, color: result >= 0 ? '#1e6b34' : '#a3271f' }}>
                {result >= 0 ? '+' : ''}{fmt(result)}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.5 }}>
              Margem de {toNumber(c.margin).toFixed(1)}% sobre a receita ·{' '}
              mês anterior fechou em {fmt(data.previous.result)}
            </Typography>
          </Box>

          {/* Indicadores */}
          <Typography sx={{ fontSize: 10, letterSpacing: 1, color: MUTED, fontWeight: 700, mb: 1 }}>
            INDICADORES
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 3, breakInside: 'avoid' }}>
            {[
              { l: 'Peças entregues', v: String(ind.deliveredCount) },
              { l: 'Ticket médio', v: fmt(ind.averageTicket) },
              { l: 'Orçamentos feitos', v: String(ind.quotesCreated) },
              { l: 'Viraram OS', v: `${ind.quotesConverted} (${toNumber(ind.conversionRate).toFixed(0)}%)` },
            ].map(i => (
              <Box key={i.l}>
                <Typography sx={{ fontSize: 10, color: MUTED, letterSpacing: 0.5 }}>
                  {i.l.toUpperCase()}
                </Typography>
                <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{i.v}</Typography>
              </Box>
            ))}
          </Box>

          {ind.bySeamstress.length > 0 && (
            <Box sx={{ mb: 3, breakInside: 'avoid' }}>
              <Typography sx={{ fontSize: 10, letterSpacing: 1, color: MUTED, fontWeight: 700, mb: 0.5 }}>
                PRODUÇÃO POR COSTUREIRA
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ px: 0, fontSize: 11, color: MUTED }}>Costureira</TableCell>
                    <TableCell align="right" sx={{ px: 0, fontSize: 11, color: MUTED }}>Peças</TableCell>
                    <TableCell align="right" sx={{ px: 0, fontSize: 11, color: MUTED }}>Valor</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ind.bySeamstress.map((s: any) => (
                    <TableRow key={s.name}>
                      <TableCell sx={{ px: 0, py: 0.5, fontSize: 13 }}>{s.name}</TableCell>
                      <TableCell align="right" sx={{ px: 0, py: 0.5, fontSize: 13 }}>{s.count}</TableCell>
                      <TableCell align="right" sx={{ px: 0, py: 0.5, fontSize: 13 }}>{fmt(s.value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}

          <Divider sx={{ mb: 1.5 }} />
          <Typography sx={{ fontSize: 10.5, color: MUTED, textAlign: 'center' }}>
            Valores realizados no período — o que efetivamente entrou e saiu.
            Sangrias e suprimentos não entram, por serem transferências de dinheiro.
          </Typography>

          <Box sx={{ mt: 6, mx: 'auto', width: 280, textAlign: 'center' }}>
            <Divider sx={{ borderColor: INK }} />
            <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.5 }}>Responsável pelo fechamento</Typography>
          </Box>
        </Paper>
      </Box>
    </>
  );
}
