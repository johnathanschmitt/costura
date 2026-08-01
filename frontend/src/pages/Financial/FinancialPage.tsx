import { useState } from 'react';
import { Box, Typography, Tabs, Tab, Badge, Alert, Button, Stack } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import CashRegisterSection from './CashRegisterSection';
import ReceivablesSection from './ReceivablesSection';
import PayablesSection from './PayablesSection';
import CashFlowSection from './CashFlowSection';
import DreSection from './DreSection';
import MonthlyResultSection from './MonthlyResultSection';
import { fmt } from './format';

export default function FinancialPage() {
  const [tab, setTab] = useState(0);

  // Os contadores de vencidos vêm do servidor: contar no cliente só enxergaria
  // a página carregada, e o status OVERDUE é atribuído no backend.
  const { data: summary } = useQuery({
    queryKey: ['financial-summary'],
    queryFn: () => api.get('/financial/summary').then(r => r.data),
    refetchInterval: 60_000,
  });

  const overdueRec = summary?.receivablesOverdue?.count ?? 0;
  const overduePay = summary?.payablesOverdue?.count ?? 0;

  return (
    <Box>
      <Typography variant="h5" mb={2}>Financeiro</Typography>

      {(overdueRec > 0 || overduePay > 0) && (
        <Stack spacing={1} mb={2}>
          {overdueRec > 0 && (
            <Alert
              severity="warning"
              action={<Button size="small" onClick={() => setTab(1)}>Ver contas</Button>}
            >
              {overdueRec} conta(s) a receber vencida(s), somando{' '}
              <strong>{fmt(summary.receivablesOverdue.amount)}</strong>.
            </Alert>
          )}
          {overduePay > 0 && (
            <Alert
              severity="error"
              action={<Button size="small" onClick={() => setTab(2)}>Ver contas</Button>}
            >
              {overduePay} conta(s) a pagar vencida(s), somando{' '}
              <strong>{fmt(summary.payablesOverdue.amount)}</strong>.
            </Alert>
          )}
        </Stack>
      )}

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab
          label={
            <Badge
              variant="dot"
              color="success"
              invisible={!summary?.cashRegisterOpen}
              sx={{ '& .MuiBadge-dot': { right: -6 } }}
            >
              Caixa
            </Badge>
          }
        />
        <Tab
          label={
            <Badge badgeContent={overdueRec || undefined} color="error">
              Contas a Receber
            </Badge>
          }
        />
        <Tab
          label={
            <Badge badgeContent={overduePay || undefined} color="error">
              Contas a Pagar
            </Badge>
          }
        />
        <Tab label="Resultado do Mês" />
        <Tab label="Fluxo de Caixa" />
        <Tab label="DRE" />
      </Tabs>

      {tab === 0 && <CashRegisterSection />}
      {tab === 1 && <ReceivablesSection />}
      {tab === 2 && <PayablesSection />}
      {tab === 3 && <MonthlyResultSection />}
      {tab === 4 && <CashFlowSection />}
      {tab === 5 && <DreSection />}
    </Box>
  );
}
