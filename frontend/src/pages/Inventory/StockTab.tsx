import { useEffect, useState } from 'react';
import {
  Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Skeleton, LinearProgress, Tooltip, TextField, InputAdornment,
  IconButton, FormControlLabel, Switch, Typography, Dialog, DialogTitle,
  DialogContent, DialogActions, Button, Alert,
} from '@mui/material';
import { QuantityField } from '../../components/common/fields/MaskedFields';
import { Warning, Search, Tune } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../store/toast.store';
import { apiError, fmt, qty } from './format';

function SettingsDialog({ item, onClose }: { item: any; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [minQuantity, setMinQuantity] = useState<number | null>(null);
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (item) {
      setMinQuantity(Number(item.minQuantity ?? 0));
      setLocation(item.location ?? '');
      setError('');
    }
  }, [item]);

  const mutation = useMutation({
    mutationFn: () => api.patch(`/inventory/${item.product.id}/settings`, {
      minQuantity: minQuantity ?? 0,
      location: location || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['low-stock'] });
      toast('Configuração salva');
      onClose();
    },
    onError: (e: any) => setError(apiError(e, 'Erro ao salvar')),
  });

  return (
    <Dialog open={Boolean(item)} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{item?.product?.name}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <QuantityField
          label={`Estoque mínimo${item?.product?.unit ? ` (${item.product.unit})` : ''}`}
          value={minQuantity}
          onChange={setMinQuantity}
          helperText="O sistema alerta quando o saldo chega neste nível"
          autoFocus
          fullWidth
        />
        <TextField
          label="Localização"
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="Ex: prateleira B, gaveta 3"
          fullWidth
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function StockTab() {
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [settingsTarget, setSettingsTarget] = useState<any>(null);
  const debouncedSearch = useDebounce(search, 350);

  const { data = [], isLoading } = useQuery({
    queryKey: ['inventory', debouncedSearch, lowOnly],
    queryFn: () => api.get('/inventory', {
      params: { search: debouncedSearch || undefined, lowOnly: lowOnly ? 'true' : undefined },
    }).then(r => r.data),
  });

  const lowCount = (data as any[]).filter(i => Number(i.quantity) <= Number(i.minQuantity)).length;

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Buscar por nome ou SKU…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ minWidth: 260 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
        />
        <FormControlLabel
          control={<Switch checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} />}
          label="Só os que estão acabando"
        />
        {!lowOnly && lowCount > 0 && (
          <Chip icon={<Warning />} color="warning" label={`${lowCount} no mínimo`} onClick={() => setLowOnly(true)} />
        )}
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Produto</TableCell>
              <TableCell>SKU</TableCell>
              <TableCell align="right">Saldo</TableCell>
              <TableCell align="right">Mínimo</TableCell>
              <TableCell sx={{ minWidth: 120 }}>Nível</TableCell>
              <TableCell align="right">Custo unit.</TableCell>
              <TableCell>Localização</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
            )) : (data as any[]).map(inv => {
              const q = Number(inv.quantity);
              const min = Number(inv.minQuantity);
              const pct = min > 0 ? Math.min((q / (min * 2)) * 100, 100) : 100;
              const low = q <= min;
              return (
                <TableRow key={inv.id} hover sx={{ bgcolor: low ? 'warning.50' : undefined }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {low && <Tooltip title="No ou abaixo do estoque mínimo"><Warning color="warning" fontSize="small" /></Tooltip>}
                      {inv.product?.name}
                    </Box>
                  </TableCell>
                  <TableCell>{inv.product?.sku ?? '—'}</TableCell>
                  <TableCell align="right">
                    <Chip label={`${qty(q)} ${inv.product?.unit ?? ''}`} size="small" color={low ? 'error' : 'default'} />
                  </TableCell>
                  <TableCell align="right">{qty(min)}</TableCell>
                  <TableCell>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      color={low ? 'error' : pct < 50 ? 'warning' : 'success'}
                      sx={{ borderRadius: 1 }}
                    />
                  </TableCell>
                  <TableCell align="right">{inv.product?.costPrice ? fmt(inv.product.costPrice) : '—'}</TableCell>
                  <TableCell>{inv.location ?? '—'}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Estoque mínimo e localização">
                      <IconButton size="small" onClick={() => setSettingsTarget(inv)}>
                        <Tune fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
            {!isLoading && data.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="text.secondary" py={3}>
                    {lowOnly ? 'Nenhum material no mínimo — estoque saudável' : 'Nenhum produto encontrado'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {settingsTarget && <SettingsDialog item={settingsTarget} onClose={() => setSettingsTarget(null)} />}
    </Box>
  );
}
