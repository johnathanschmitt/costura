import { useState } from 'react';
import { Box, Typography, Button, Tabs, Tab } from '@mui/material';
import { Add, ViewKanban, ViewList, Groups } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import KanbanBoard from './KanbanBoard';
import QueuesTab from './QueuesTab';
import WorkOrdersList from './WorkOrdersList';

export default function WorkOrdersPage() {
  const navigate = useNavigate();
  // O quadro é a visão de produção do dia a dia; a lista serve para busca e histórico.
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">Ordens de Serviço</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/work-orders/new')}>
          Nova OS
        </Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab icon={<ViewKanban fontSize="small" />} iconPosition="start" label="Quadro" />
        <Tab icon={<Groups fontSize="small" />} iconPosition="start" label="Filas" />
        <Tab icon={<ViewList fontSize="small" />} iconPosition="start" label="Lista" />
      </Tabs>

      {tab === 0 && <KanbanBoard />}
      {tab === 1 && <QueuesTab />}
      {tab === 2 && <WorkOrdersList />}
    </Box>
  );
}
