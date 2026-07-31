import { useState } from 'react';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton, Chip,
  InputAdornment, Skeleton,
} from '@mui/material';
import { Add, Search, Edit, Delete, Visibility } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import AppPagination from '../../components/common/AppPagination';

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 400);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['customers', debouncedSearch, page],
    queryFn: () => api.get('/customers', { params: { search: debouncedSearch, page, limit: 20 } }).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/customers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">Clientes</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/customers/new')}>
          Novo Cliente
        </Button>
      </Box>

      <TextField
        placeholder="Buscar por nome, e-mail, telefone ou CPF…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        fullWidth
        sx={{ mb: 2 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
      />

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Telefone</TableCell>
              <TableCell>E-mail</TableCell>
              <TableCell align="center">OS</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {[1, 2, 3, 4, 5].map(j => <TableCell key={j}><Skeleton /></TableCell>)}
              </TableRow>
            )) : data?.data?.map((c: any) => (
              <TableRow key={c.id} hover>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.phone ?? '—'}</TableCell>
                <TableCell>{c.email ?? '—'}</TableCell>
                <TableCell align="center">
                  <Chip label={c._count?.workOrders ?? 0} size="small" />
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => navigate(`/customers/${c.id}`)}><Visibility fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => navigate(`/customers/${c.id}/edit`)}><Edit fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => confirm('Remover cliente?') && deleteMutation.mutate(c.id)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {data?.total ?? 0} cliente(s) encontrado(s)
        </Typography>
        <AppPagination
          page={page}
          total={data?.total ?? 0}
          limit={20}
          onChange={p => { setPage(p); }}
        />
      </Box>
    </Box>
  );
}
