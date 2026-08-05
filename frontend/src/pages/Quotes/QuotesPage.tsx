import { useState } from 'react';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton, Chip,
  InputAdornment, Skeleton, Select, MenuItem, FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import Alert from '@mui/material/Alert';
import { Add, Search, Edit, Delete, CheckCircle, Assignment, Cancel } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../store/toast.store';

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
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const debouncedSearch = useDebounce(search, 400);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['quotes', debouncedSearch, status],
    queryFn: () => api.get('/quotes', { params: { search: debouncedSearch, status } }).then(r => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/quotes/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/quotes/${id}/reject`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
    onError: (e: any) => toast(e.response?.data?.message ?? 'Erro ao recusar', 'error'),
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      setDeleteTarget(null);
      toast('Orçamento e OS (se houver) removidos', 'info');
    },
    onError: (e: any) => {
      toast(e.response?.data?.message ?? 'Erro ao remover', 'error');
    },
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
                <TableRow
                  key={q.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/quotes/${q.id}/edit`)}
                >
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
                          onClick={e => {
                            e.stopPropagation();
                            navigate(`/work-orders/${q.workOrder.id}/edit`);
                          }}
                          sx={{ cursor: 'pointer' }}
                        />
                      : '—'}
                  </TableCell>
                  <TableCell>{fmt(q.total)}</TableCell>
                  <TableCell>{q.validUntil ? dayjs(q.validUntil).format('DD/MM/YYYY') : '—'}</TableCell>
                  <TableCell align="right" onClick={e => e.stopPropagation()}>
                    {q.status === 'SENT' && (
                      <IconButton size="small" color="success" onClick={() => approveMutation.mutate(q.id)} title="Aprovar">
                        <CheckCircle fontSize="small" />
                      </IconButton>
                    )}
                    {['DRAFT', 'SENT'].includes(q.status) && (
                      <IconButton size="small" color="error" onClick={() => confirm('Recusar orçamento?') && rejectMutation.mutate(q.id)} title="Recusar">
                        <Cancel fontSize="small" />
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
                    <IconButton size="small" color="error" onClick={() => setDeleteTarget(q)} title="Remover orçamento e OS vinculada">
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Remover Orçamento?</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Deseja realmente remover o orçamento <strong>{deleteTarget?.number}</strong>?
          </Typography>
          {deleteTarget?.workOrder && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              Este orçamento está aprovado e possui a <strong>OS {deleteTarget.workOrder.number}</strong> associada.
              <br />
              A OS também será removida. Esta ação é irreversível.
            </Alert>
          )}
          {!deleteTarget?.workOrder && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Esta ação é irreversível.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button
            onClick={() => deleteMutation.mutate(deleteTarget.id)}
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
          >
            {deleteTarget?.workOrder ? 'Remover Orçamento e OS' : 'Remover Orçamento'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
