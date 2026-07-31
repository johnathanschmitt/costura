import { useState } from 'react';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton, Chip,
  InputAdornment, Skeleton, Switch,
} from '@mui/material';
import { Add, Search, Edit, Delete } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import ConfirmDialog from '../../components/common/ConfirmDialog';

export default function ServicesPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ['services', debouncedSearch],
    queryFn: () => api.get('/services', { params: { search: debouncedSearch } }).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/services/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['services'] }); setDeleteTarget(null); },
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">Serviços</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/catalog/services/new')}>
          Novo Serviço
        </Button>
      </Box>

      <TextField
        placeholder="Buscar serviço…"
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
              <TableCell>Descrição</TableCell>
              <TableCell align="center">Unidade</TableCell>
              <TableCell align="right">Preço base</TableCell>
              <TableCell align="center">Ativo</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>{[1,2,3,4,5,6].map(j => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
            )) : (data as any[]).map((s: any) => (
              <TableRow key={s.id} hover>
                <TableCell sx={{ fontWeight: 500 }}>{s.name}</TableCell>
                <TableCell sx={{ color: 'text.secondary', maxWidth: 300 }}>
                  <Typography noWrap variant="body2">{s.description ?? '—'}</Typography>
                </TableCell>
                <TableCell align="center">
                  <Chip label={s.unit} size="small" variant="outlined" />
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, color: 'primary.main' }}>
                  {fmt(s.basePrice)}
                </TableCell>
                <TableCell align="center">
                  <Chip label={s.active ? 'Ativo' : 'Inativo'} size="small" color={s.active ? 'success' : 'default'} />
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => navigate(`/catalog/services/${s.id}/edit`)}>
                    <Edit fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => setDeleteTarget(s)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary" py={2}>Nenhum serviço cadastrado</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget?.id)}
        title="Remover serviço"
        message={`Deseja remover "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Remover"
        confirmColor="error"
        loading={deleteMutation.isPending}
      />
    </Box>
  );
}
