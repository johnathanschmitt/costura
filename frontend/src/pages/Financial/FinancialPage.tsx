import { useState } from 'react';
import { Box, Typography, Tabs, Tab, Badge } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import api from '../../services/api';
import CashRegisterSection from './CashRegisterSection';
import ReceivablesSection from './ReceivablesSection';
import PayablesSection from './PayablesSection';
import CashFlowSection from './CashFlowSection';

function useOverdueCounts() {
  const { data: receivables = [] } = useQuery({
    queryKey: ['receivables', ''],
    queryFn: () => api.get('/financial/receivables').then(r => r.data),
  });
  const { data: payables = [] } = useQuery({
    queryKey: ['payables', ''],
    queryFn: () => api.get('/financial/payables').then(r => r.data),
  });

  const overdueRec = (receivables as any[]).filter(
    r => r.status === 'PENDING' && dayjs(r.dueDate).isBefore(dayjs(), 'day'),
  ).length;

  const overduePay = (payables as any[]).filter(
    r => r.status === 'PENDING' && dayjs(r.dueDate).isBefore(dayjs(), 'day'),
  ).length;

  return { overdueRec, overduePay };
}

export default function FinancialPage() {
  const [tab, setTab] = useState(0);
  const { overdueRec, overduePay } = useOverdueCounts();

  return (
    <Box>
      <Typography variant="h5" mb={2}>Financeiro</Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Caixa" />
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
        <Tab label="Fluxo de Caixa" />
      </Tabs>

      {tab === 0 && <CashRegisterSection />}
      {tab === 1 && <ReceivablesSection />}
      {tab === 2 && <PayablesSection />}
      {tab === 3 && <CashFlowSection />}
    </Box>
  );
}
