import { useState } from 'react';
import { Box, Typography, Tabs, Tab, Button, Badge, Alert } from '@mui/material';
import { Add } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import StockTab from './StockTab';
import MovementsTab from './MovementsTab';
import CountTab from './CountTab';
import EntryDialog from './EntryDialog';

export default function InventoryPage() {
  const [tab, setTab] = useState(0);
  const [entryOpen, setEntryOpen] = useState(false);

  const { data: lowStock = [] } = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => api.get('/inventory/low-stock').then(r => r.data),
    refetchInterval: 60_000,
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">Estoque</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setEntryOpen(true)}>
          Entrada de Material
        </Button>
      </Box>

      {lowStock.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {lowStock.length === 1 ? (
            <>O material <strong>{lowStock[0].product?.name}</strong> está no estoque mínimo.</>
          ) : (
            <>
              {lowStock.length} materiais estão no estoque mínimo:{' '}
              <strong>
                {lowStock.slice(0, 3).map((i: any) => i.product?.name).join(', ')}
                {lowStock.length > 3 && ` e mais ${lowStock.length - 3}`}
              </strong>.
            </>
          )}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab
          label={
            <Badge badgeContent={lowStock.length || undefined} color="warning">
              Saldos
            </Badge>
          }
        />
        <Tab label="Movimentações" />
        <Tab label="Inventário" />
      </Tabs>

      {tab === 0 && <StockTab />}
      {tab === 1 && <MovementsTab />}
      {tab === 2 && <CountTab />}

      <EntryDialog open={entryOpen} onClose={() => setEntryOpen(false)} />
    </Box>
  );
}
