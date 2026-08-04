import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Divider, Button, CircularProgress, Table, TableBody,
  TableCell, TableHead, TableRow,
} from '@mui/material';
import { Print, ArrowBack } from '@mui/icons-material';
import dayjs from 'dayjs';
import api from '../../services/api';
import { fmt, toNumber } from './format';

/**
 * DRE do período em folha, para mandar ao contador.
 *
 * Segue o mesmo caminho dos outros documentos do sistema (recibo, fechamento de
 * caixa): uma página de impressão do navegador, que gera PDF pelo "salvar como
 * PDF" e não exige biblioteca nenhuma.
 */
export default function DrePrintPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const startDate = params.get('startDate') ?? dayjs().startOf('month').toISOString();
  const endDate = params.get('endDate') ?? dayjs().endOf('month').toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ['dre-print', startDate, endDate],
    queryFn: () => api.get('/financial/dre', { params: { startDate, endDate } }).then(r => r.data),
  });

  const { data: business } = useQuery({
    queryKey: ['business-info'],
    queryFn: () => api.get('/settings/business').then(r => r.data),
  });

  useEffect(() => {
    if (data) setTimeout(() => window.print(), 600);
  }, [data]);

  if (isLoading || !data) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>;
  }

  const t = data.totals;
  const result = toNumber(t.result);

  const section = (title: string, rows: any[], total: any, previousTotal: any) => (
    <>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 2 }}>{title}</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Categoria</TableCell>
            <TableCell align="right">Período</TableCell>
            <TableCell align="right">Anterior</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={3}>Nada no período</TableCell></TableRow>
          )}
          {rows.map((r: any) => (
            <TableRow key={r.category}>
              <TableCell>{r.category}</TableCell>
              <TableCell align="right">{fmt(r.amount)}</TableCell>
              <TableCell align="right">{fmt(r.previousAmount)}</TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(total)}</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(previousTotal)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </>
  );

  return (
    <Box sx={{ bgcolor: 'background.paper', minHeight: '100vh' }}>
      <Box sx={{ display: 'flex', gap: 1, p: 2, '@media print': { display: 'none' } }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)}>Voltar</Button>
        <Button variant="contained" startIcon={<Print />} onClick={() => window.print()}>
          Imprimir / salvar PDF
        </Button>
      </Box>

      <Box sx={{ maxWidth: 760, mx: 'auto', p: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>{business?.name ?? 'Ateliê'}</Typography>
            {business?.taxId && <Typography variant="body2">CNPJ/CPF: {business.taxId}</Typography>}
            {business?.address && <Typography variant="body2">{business.address}</Typography>}
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="h6" fontWeight={700}>DEMONSTRATIVO DE RESULTADO</Typography>
            <Typography variant="body2">
              {dayjs(data.period.start).format('DD/MM/YYYY')} a {dayjs(data.period.end).format('DD/MM/YYYY')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              comparado com {dayjs(data.previousPeriod.start).format('DD/MM/YYYY')} a{' '}
              {dayjs(data.previousPeriod.end).format('DD/MM/YYYY')}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {section('RECEITAS', data.income, t.income, t.previousIncome)}
        {section('DESPESAS', data.expense, t.expense, t.previousExpense)}

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight={700}>RESULTADO</Typography>
          <Typography variant="h6" fontWeight={700} color={result >= 0 ? 'success.main' : 'error.main'}>
            {fmt(result)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            Margem sobre a receita
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {toNumber(t.margin).toFixed(1)}% · período anterior: {fmt(t.previousResult)}
          </Typography>
        </Box>

        <Typography variant="caption" color="text.secondary" display="block" mt={3}>
          Regime de caixa: cada valor é contado na data em que o dinheiro entrou ou saiu.
          Transferências entre contas, sangrias e baixas estornadas não entram no resultado.
        </Typography>
      </Box>
    </Box>
  );
}
