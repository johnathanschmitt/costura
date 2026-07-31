import { useState } from 'react';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton, Chip,
  InputAdornment, Skeleton, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import { Add, Search, Edit, Delete, PlayArrow, Done } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';

const STATUS_MAP: Record<string, { label: string; color: any }> = {
  PENDING: { label: 'Pendente', color: 'default' },
  IN_PROGRESS: { label: 'Em Andamento', color: 'info' },
  WAITING_MATERIAL: { label: 'Aguard. Material', color: 'warning' },
  FITTING: { label: 'Prova', color: 'secondary' },
  DONE: { label: 'Concluída', color: 'success' },
  DELIVERED: { label: 'Entregue', color: 'success' },
  CANCELLED: { label: 'Cancelada', color: 'error' },
};

const PRIORITY_MAP: Record<string, { label: string; color: any }> = {
  LOW:    { label: 'Baixa',   color: 'default' },
  NORMAL: { label: 'Normal',  color: 'default' },
  HIGH:   { label: 'Alta',    color: 'warning' },
  URGENT: { label: 'Urgente', color: 'error' },
};

export default function WorkOrdersPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['work-orders', debouncedSearch, status],
    queryFn: () => api.get('/work-orders', { params: { search: debouncedSearch, status } }).then(r => r.data),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/work-orders/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work-orders'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/work-orders/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work-orders'] }),
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">Ordens de Serviço</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/work-orders/new')}>Nova OS</Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          placeholder="Buscar por número ou cliente…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ flex: 1 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select value={status} label="Status" onChange={e => setStatus(e.target.value)}>
            <MenuItem value="">Todos</MenuItem>
            {Object.entries(STATUS_MAP).map(([v, { label }]) => (
              <MenuItem key={v} value={v}>{label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Número</TableCell>
              <TableCell>Cliente</TableCell>
              <TableCell>Prioridade</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Prazo</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>{[1,2,3,4,5,6].map(j => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
            )) : data?.data?.map((wo: any) => {
              const s = STATUS_MAP[wo.status] ?? { label: wo.status, color: 'default' };
              return (
                <TableRow key={wo.id} hover>
                  <TableCell>{wo.number}</TableCell>
                  <TableCell>{wo.customer?.name}</TableCell>
                  <TableCell><Chip label={PRIORITY_MAP[wo.priority]?.label ?? wo.priority} size="small" color={PRIORITY_MAP[wo.priority]?.color} /></TableCell>
                  <TableCell><Chip label={s.label} color={s.color} size="small" /></TableCell>
                  <TableCell>{wo.dueDate ? dayjs(wo.dueDate).format('DD/MM/YYYY') : '—'}</TableCell>
                  <TableCell align="right">
                    {wo.status === 'PENDING' && (
                      <IconButton size="small" color="info" onClick={() => statusMutation.mutate({ id: wo.id, status: 'IN_PROGRESS' })}>
                        <PlayArrow fontSize="small" />
                      </IconButton>
                    )}
                    {wo.status === 'IN_PROGRESS' && (
                      <IconButton size="small" color="success" onClick={() => statusMutation.mutate({ id: wo.id, status: 'DONE' })}>
                        <Done fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton size="small" onClick={() => navigate(`/work-orders/${wo.id}/edit`)}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => confirm('Remover?') && deleteMutation.mutate(wo.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
