import { useState } from 'react';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton, Chip,
  InputAdornment, Skeleton, Tooltip,
} from '@mui/material';
import { Add, Search, Edit, Delete, Warning } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import ConfirmDialog from '../../components/common/ConfirmDialog';

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ['products', debouncedSearch],
    queryFn: () => api.get('/products', { params: { search: debouncedSearch } }).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setDeleteTarget(null); },
  });

  const fmt = (n: number | null) =>
    n == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">Produtos / Materiais</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/catalog/products/new')}>
          Novo Produto
        </Button>
      </Box>

      <TextField
        placeholder="Buscar produto por nome ou SKU…"
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
              <TableCell>SKU</TableCell>
              <TableCell align="center">Unidade</TableCell>
              <TableCell align="right">Custo</TableCell>
              <TableCell align="right">Venda</TableCell>
              <TableCell align="center">Estoque</TableCell>
              <TableCell align="center">Ativo</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>{[1,2,3,4,5,6,7,8].map(j => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
            )) : (data as any[]).map((p: any) => {
              const qty = p.inventory ? Number(p.inventory.quantity) : null;
              const min = p.inventory ? Number(p.inventory.minQuantity) : 0;
              const lowStock = qty !== null && qty <= min;
              return (
                /* Clicar em qualquer lugar da linha abre o registro — é o que se
                     tenta primeiro numa lista, e no celular poupa mirar num
                     ícone de 20px. A coluna de ações para o clique, para não
                     navegar junto com o botão. */
                <TableRow
                  key={p.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/catalog/products/${p.id}/edit`)}
                >
                  <TableCell sx={{ fontWeight: 500 }}>{p.name}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>{p.sku ?? '—'}</TableCell>
                  <TableCell align="center"><Chip label={p.unit} size="small" variant="outlined" /></TableCell>
                  <TableCell align="right">{fmt(p.costPrice)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, color: 'primary.main' }}>{fmt(p.salePrice)}</TableCell>
                  <TableCell align="center">
                    {qty === null ? (
                      <Typography variant="caption" color="text.disabled">—</Typography>
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                        {lowStock && (
                          <Tooltip title="Estoque abaixo do mínimo">
                            <Warning fontSize="small" color="warning" />
                          </Tooltip>
                        )}
                        <Chip
                          label={qty}
                          size="small"
                          color={lowStock ? 'error' : qty === 0 ? 'warning' : 'default'}
                        />
                      </Box>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Chip label={p.active ? 'Ativo' : 'Inativo'} size="small" color={p.active ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell align="right" onClick={e => e.stopPropagation()}>
                    <IconButton size="small" onClick={() => navigate(`/catalog/products/${p.id}/edit`)}>
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => setDeleteTarget(p)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
            {!isLoading && data.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="text.secondary" py={2}>Nenhum produto cadastrado</Typography>
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
        title="Remover produto"
        message={`Deseja remover "${deleteTarget?.name}"?`}
        confirmLabel="Remover"
        confirmColor="error"
        loading={deleteMutation.isPending}
      />
    </Box>
  );
}
