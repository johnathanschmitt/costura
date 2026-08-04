import { Box, Typography, Tabs, Tab, Badge, Alert, Button, Stack } from '@mui/material';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import OverviewSection from './OverviewSection';
import CashRegisterSection from './CashRegisterSection';
import CashHistorySection from './CashHistorySection';
import AccountsSection from './AccountsSection';
import ReturnsSection from './ReturnsSection';
import AccountsMonthSection from './AccountsMonthSection';
import CashFlowSection from './CashFlowSection';
import MonthlyResultSection from './MonthlyResultSection';
import DistributionSection from './DistributionSection';
import { fmt } from './format';

/**
 * O módulo é dividido em duas naturezas de trabalho: o que se faz todo dia
 * (caixa e contas) e o que se olha de vez em quando para decidir.
 *
 * O nome de cada aba é a pergunta que ela responde, não o artefato contábil que
 * a origina: "DRE" não diz nada para quem costura, e "Retorno por Peça" não diz
 * que ali mora a resposta de "estou cobrando barato?". Eram onze abas para
 * cinco perguntas; são sete.
 */
const DAILY = [
  { path: '', label: 'Painel' },
  { path: 'caixa', label: 'Caixa' },
  { path: 'contas-do-mes', label: 'Contas do mês' },
];

const ANALYSIS = [
  { path: 'resultado', label: 'Resultado' },
  { path: 'onde-esta-o-dinheiro', label: 'Onde está o dinheiro' },
  { path: 'previsao', label: 'Previsão' },
  { path: 'quanto-rende', label: 'Quanto rende cada peça' },
  { path: 'divisao', label: 'Divisão do mês' },
];

/**
 * Endereços antigos continuam funcionando: são links guardados nos favoritos e
 * em conversas, e quebrar um deles é fazer a usuária procurar de novo o que ela
 * já sabia onde ficava.
 */
const MOVED: Record<string, string> = {
  'a-receber': 'contas-do-mes',
  'a-pagar': 'contas-do-mes?lado=pagar',
  contas: 'onde-esta-o-dinheiro',
  fluxo: 'previsao',
  dre: 'resultado',
  retorno: 'quanto-rende',
};

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

      {/* No painel a fila de trabalho já lista os vencidos com valor e botão;
          repetir o aviso em cima dela seria dizer duas vezes a mesma coisa. */}
      {current !== '' && (overdueRec > 0 || overduePay > 0) && (
        <Stack spacing={1} mb={2}>
          {overdueRec > 0 && (
            <Alert severity="warning" action={<Button size="small" onClick={() => go('contas-do-mes')}>Ver contas</Button>}>
              {overdueRec} conta(s) a receber vencida(s), somando{' '}
              <strong>{fmt(summary.receivablesOverdue.amount)}</strong>.
            </Alert>
          )}
          {overduePay > 0 && (
            <Alert severity="error" action={<Button size="small" onClick={() => go('contas-do-mes?lado=pagar')}>Ver contas</Button>}>
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
                  t.path === 'contas-do-mes' ? label(t.label, overdueRec + overduePay)
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
        {/* Consulta esporádica: chega-se aqui pelo link dentro do Caixa, não
            por uma aba disputando espaço todo dia. */}
        <Route path="caixas" element={<CashHistorySection />} />
        <Route path="contas-do-mes" element={<AccountsMonthSection />} />
        <Route path="onde-esta-o-dinheiro" element={<AccountsSection />} />
        <Route path="resultado" element={<MonthlyResultSection />} />
        <Route path="divisao" element={<DistributionSection />} />
        <Route path="previsao" element={<CashFlowSection />} />
        <Route path="quanto-rende" element={<ReturnsSection />} />
        {Object.entries(MOVED).map(([from, to]) => (
          <Route key={from} path={from} element={<Navigate to={`/financial/${to}`} replace />} />
        ))}
        <Route path="*" element={<Navigate to="/financial" replace />} />
      </Routes>
    </Box>
  );
}
