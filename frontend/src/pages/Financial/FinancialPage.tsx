import { Box, Typography, Tabs, Tab, Badge, Alert, Button, Stack } from '@mui/material';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import OverviewSection from './OverviewSection';
import CashRegisterSection from './CashRegisterSection';
import CashHistorySection from './CashHistorySection';
import AccountsSection from './AccountsSection';
import ReturnsSection from './ReturnsSection';
import ReceivablesSection from './ReceivablesSection';
import PayablesSection from './PayablesSection';
import CashFlowSection from './CashFlowSection';
import DreSection from './DreSection';
import MonthlyResultSection from './MonthlyResultSection';
import DistributionSection from './DistributionSection';
import { fmt } from './format';

/**
 * O módulo é dividido em duas naturezas de trabalho: o que se faz todo dia
 * (caixa e contas) e o que se olha de vez em quando para decidir (resultado,
 * divisão, fluxo, DRE). Antes eram sete abas no mesmo nível, guardadas só na
 * memória do componente — a URL era sempre /financial, então atualizar a página
 * ou voltar jogava a usuária de volta no caixa.
 */
const DAILY = [
  { path: '', label: 'Painel' },
  { path: 'caixa', label: 'Caixa' },
  { path: 'caixas', label: 'Histórico de Caixas' },
  { path: 'a-receber', label: 'A Receber' },
  { path: 'a-pagar', label: 'A Pagar' },
];

const ANALYSIS = [
  { path: 'contas', label: 'Contas e Saldos' },
  { path: 'resultado', label: 'Resultado do Mês' },
  { path: 'divisao', label: 'Divisão' },
  { path: 'fluxo', label: 'Fluxo de Caixa' },
  { path: 'dre', label: 'DRE' },
  { path: 'retorno', label: 'Retorno por Peça' },
];

export default function FinancialPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Segmento depois de /financial ('' na tela inicial).
  const current = location.pathname.replace(/^\/financial\/?/, '').split('/')[0];

  const { data: summary } = useQuery({
    queryKey: ['financial-summary'],
    queryFn: () => api.get('/financial/summary').then(r => r.data),
    refetchInterval: 60_000,
  });

  const overdueRec = summary?.receivablesOverdue?.count ?? 0;
  const overduePay = summary?.payablesOverdue?.count ?? 0;

  const go = (path: string) => navigate(`/financial${path ? `/${path}` : ''}`);

  const inDaily = DAILY.some(t => t.path === current);
  const inAnalysis = ANALYSIS.some(t => t.path === current);

  const label = (text: string, count: number) =>
    count > 0 ? <Badge badgeContent={count} color="error">{text}</Badge> : text;

  return (
    <Box>
      <Typography variant="h5" mb={2}>Financeiro</Typography>

      {/* No painel os atrasados já aparecem com nome e valor; repetir o aviso
          em cima deles seria dizer duas vezes a mesma coisa. */}
      {current !== '' && (overdueRec > 0 || overduePay > 0) && (
        <Stack spacing={1} mb={2}>
          {overdueRec > 0 && (
            <Alert severity="warning" action={<Button size="small" onClick={() => go('a-receber')}>Ver contas</Button>}>
              {overdueRec} conta(s) a receber vencida(s), somando{' '}
              <strong>{fmt(summary.receivablesOverdue.amount)}</strong>.
            </Alert>
          )}
          {overduePay > 0 && (
            <Alert severity="error" action={<Button size="small" onClick={() => go('a-pagar')}>Ver contas</Button>}>
              {overduePay} conta(s) a pagar vencida(s), somando{' '}
              <strong>{fmt(summary.payablesOverdue.amount)}</strong>.
            </Alert>
          )}
        </Stack>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 62 }}>
            DIA A DIA
          </Typography>
          <Tabs
            value={inDaily ? current : false}
            onChange={(_, v) => go(v)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {DAILY.map(t => (
              <Tab
                key={t.path}
                value={t.path}
                label={
                  t.path === 'a-receber' ? label(t.label, overdueRec)
                    : t.path === 'a-pagar' ? label(t.label, overduePay)
                    : t.path === 'caixa'
                      ? <Badge variant="dot" color="success" invisible={!summary?.cashRegisterOpen} sx={{ '& .MuiBadge-dot': { right: -6 } }}>{t.label}</Badge>
                      : t.label
                }
              />
            ))}
          </Tabs>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 62 }}>
            ANÁLISE
          </Typography>
          <Tabs
            value={inAnalysis ? current : false}
            onChange={(_, v) => go(v)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {ANALYSIS.map(t => <Tab key={t.path} value={t.path} label={t.label} />)}
          </Tabs>
        </Box>
      </Box>

      <Routes>
        <Route index element={<OverviewSection />} />
        <Route path="caixa" element={<CashRegisterSection />} />
        <Route path="caixas" element={<CashHistorySection />} />
        <Route path="a-receber" element={<ReceivablesSection />} />
        <Route path="a-pagar" element={<PayablesSection />} />
        <Route path="contas" element={<AccountsSection />} />
        <Route path="resultado" element={<MonthlyResultSection />} />
        <Route path="divisao" element={<DistributionSection />} />
        <Route path="fluxo" element={<CashFlowSection />} />
        <Route path="dre" element={<DreSection />} />
        <Route path="retorno" element={<ReturnsSection />} />
        <Route path="*" element={<Navigate to="/financial" replace />} />
      </Routes>
    </Box>
  );
}
