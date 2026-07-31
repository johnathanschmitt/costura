import { useState } from 'react';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton, Chip,
  InputAdornment, Skeleton, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import { Add, Search, Edit, Delete, CheckCircle, Assignment } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';

const STATUS_LABELS: Record<string, { label: string; color: any }> = {
  DRAFT: { label: 'Rascunho', color: 'default' },
  SENT: { label: 'Enviado', color: 'info' },
  APPROVED: { label: 'Aprovado', color: 'success' },
  REJECTED: { label: 'Recusado', color: 'error' },
  EXPIRED: { label: 'Expirado', color: 'warning' },
};

export default function QuotesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['quotes', debouncedSearch, status],
    queryFn: () => api.get('/quotes', { params: { search: debouncedSearch, status } }).then(r => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/quotes/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  });

  const convertMutation = useMutation({
    mutationFn: (id: string) => api.post(`/quotes/${id}/convert`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      navigate(`/work-orders/${res.data.id}/edit`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/quotes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  });

  const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">Orçamentos</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/quotes/new')}>
          Novo Orçamento
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          placeholder="Buscar por número ou cliente…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ flex: 1 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select value={status} label="Status" onChange={e => setStatus(e.target.value)}>
            <MenuItem value="">Todos</MenuItem>
            {Object.entries(STATUS_LABELS).map(([v, { label }]) => (
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
              <TableCell>Status</TableCell>
              <TableCell>OS</TableCell>
              <TableCell>Total</TableCell>
              <TableCell>Validade</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>{[1,2,3,4,5,6].map(j => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
            )) : data?.data?.map((q: any) => {
              const s = STATUS_LABELS[q.status] ?? { label: q.status, color: 'default' };
              return (
                <TableRow key={q.id} hover>
                  <TableCell>{q.number}</TableCell>
                  <TableCell>{q.customer?.name}</TableCell>
                  <TableCell><Chip label={s.label} color={s.color} size="small" /></TableCell>
                  <TableCell>
                    {q.workOrder
                      ? <Chip
                          icon={<Assignment sx={{ fontSize: '14px !important' }} />}
                          label={q.workOrder.number}
                          size="small"
                          variant="outlined"
                          color="primary"
                          onClick={() => navigate(`/work-orders/${q.workOrder.id}/edit`)}
                          sx={{ cursor: 'pointer' }}
                        />
                      : '—'}
                  </TableCell>
                  <TableCell>{fmt(q.total)}</TableCell>
                  <TableCell>{q.validUntil ? dayjs(q.validUntil).format('DD/MM/YYYY') : '—'}</TableCell>
                  <TableCell align="right">
                    {q.status === 'SENT' && (
                      <IconButton size="small" color="success" onClick={() => approveMutation.mutate(q.id)} title="Aprovar">
                        <CheckCircle fontSize="small" />
                      </IconButton>
                    )}
                    {q.status === 'APPROVED' && !q.workOrder && (
                      <IconButton
                        size="small"
                        color="secondary"
                        title="Converter em OS"
                        disabled={convertMutation.isPending}
                        onClick={() => convertMutation.mutate(q.id)}
                      >
                        <Assignment fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton size="small" onClick={() => navigate(`/quotes/${q.id}/edit`)}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => confirm('Remover?') && deleteMutation.mutate(q.id)}>
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
