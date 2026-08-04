import { useState } from 'react';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, IconButton, Switch,
  Grid, Alert, Tooltip, Skeleton,
} from '@mui/material';
import { Add, Delete, Lock } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useToast } from '../../store/toast.store';
import ConfirmDialog from '../../components/common/ConfirmDialog';

const apiError = (e: any, fallback: string) => {
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m.join('. ') : m ?? fallback;
};

function CategoryList({ type, title, hint }: { type: 'INCOME' | 'EXPENSE'; title: string; hint: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [removeTarget, setRemoveTarget] = useState<any>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ['financial-categories', type],
    queryFn: () => api.get('/financial/categories', { params: { type } }).then(r => r.data),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['financial-categories'] });

  const createMutation = useMutation({
    mutationFn: () => api.post('/financial/categories', { name: name.trim(), type }),
    onSuccess: () => { refresh(); setName(''); setError(''); toast('Categoria criada'); },
    onError: (e: any) => setError(apiError(e, 'Erro ao criar')),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: any) => api.patch(`/financial/categories/${id}`, { active }),
    onSuccess: refresh,
    onError: (e: any) => toast(apiError(e, 'Erro ao alterar'), 'error'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/financial/categories/${id}`),
    onSuccess: res => {
      refresh();
      setRemoveTarget(null);
      const n = res.data.affectedEntries;
      toast(n > 0 ? `Categoria removida — ${n} lançamento(s) mantêm o nome antigo` : 'Categoria removida', 'info');
    },
    onError: (e: any) => { setRemoveTarget(null); toast(apiError(e, 'Erro ao remover'), 'error'); },
  });

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={600}>{title}</Typography>
      <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>{hint}</Typography>

      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small"
          placeholder="Nova categoria…"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) createMutation.mutate(); }}
          fullWidth
        />
        <Button
          variant="outlined"
          startIcon={<Add />}
          onClick={() => createMutation.mutate()}
          disabled={!name.trim() || createMutation.isPending}
        >
          Adicionar
        </Button>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Categoria</TableCell>
              <TableCell align="center" width={90}>Ativa</TableCell>
              <TableCell align="right" width={60} />
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>{[1, 2, 3].map(j => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
            )) : (data as any[]).map(c => (
              <TableRow key={c.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {c.name}
                    {c.isSystem && (
                      <Tooltip title="Categoria padrão do sistema — pode ser desativada, mas não removida">
                        <Chip icon={<Lock sx={{ fontSize: '12px !important' }} />} label="padrão" size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <Switch
                    size="small"
                    checked={c.active}
                    onChange={e => toggleMutation.mutate({ id: c.id, active: e.target.checked })}
                  />
                </TableCell>
                <TableCell align="right">
                  {!c.isSystem && (
                    <IconButton size="small" color="error" onClick={() => setRemoveTarget(c)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => removeMutation.mutate(removeTarget.id)}
        title="Remover categoria"
        message={`Remover "${removeTarget?.name}"? Os lançamentos já feitos mantêm o nome, mas ela some dos seletores.`}
        confirmLabel="Remover"
        confirmColor="error"
        loading={removeMutation.isPending}
      />
    </Box>
  );
}

export default function CategoriesTab() {
  return (
    <Box>
      <Typography variant="h6" mb={0.5}>Categorias financeiras</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Alimentam os seletores de lançamento e o agrupamento do Resultado.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <CategoryList
            type="INCOME"
            title="Receitas"
            hint="De onde vem o dinheiro: costura, ajuste, bordado…"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <CategoryList
            type="EXPENSE"
            title="Despesas"
            hint="Para onde vai: aluguel, salários, materiais…"
          />
        </Grid>
      </Grid>
    </Box>
  );
}
