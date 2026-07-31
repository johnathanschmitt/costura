import { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Button, Grid, TextField, Card, CardContent,
  Breadcrumbs, Link, Alert, FormControl, InputLabel, Select,
  MenuItem, Switch, FormControlLabel, Divider,
} from '@mui/material';
import { Save, ArrowBack } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useAutosave } from '../../hooks/useAutosave';
import AutosaveIndicator from '../../components/common/AutosaveIndicator';

const UNITS = [
  { value: 'un', label: 'Unidade' },
  { value: 'metro', label: 'Metro' },
  { value: 'kg', label: 'Quilograma' },
  { value: 'g', label: 'Grama' },
  { value: 'rolo', label: 'Rolo' },
  { value: 'caixa', label: 'Caixa' },
  { value: 'par', label: 'Par' },
];

interface ProductForm {
  name: string;
  sku: string;
  description: string;
  unit: string;
  costPrice: string;
  salePrice: string;
  active: boolean;
  // estoque
  initialQuantity: string;
  minQuantity: string;
  location: string;
}

const EMPTY: ProductForm = {
  name: '', sku: '', description: '', unit: 'un',
  costPrice: '', salePrice: '', active: true,
  initialQuantity: '', minQuantity: '0', location: '',
};

export default function ProductFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState<ProductForm>(EMPTY);
  const [error, setError] = useState('');

  const { data: existing } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get(`/products/${id}`).then(r => r.data),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name ?? '',
        sku: existing.sku ?? '',
        description: existing.description ?? '',
        unit: existing.unit ?? 'un',
        costPrice: String(existing.costPrice ?? ''),
        salePrice: String(existing.salePrice ?? ''),
        active: existing.active ?? true,
        initialQuantity: String(existing.inventory?.quantity ?? ''),
        minQuantity: String(existing.inventory?.minQuantity ?? '0'),
        location: existing.inventory?.location ?? '',
      });
    }
  }, [existing]);

  const set = (field: keyof ProductForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const buildPayload = (f: ProductForm) => ({
    name: f.name,
    sku: f.sku || null,
    description: f.description || null,
    unit: f.unit,
    costPrice: f.costPrice ? parseFloat(f.costPrice) : null,
    salePrice: f.salePrice ? parseFloat(f.salePrice) : null,
    active: f.active,
    initialQuantity: f.initialQuantity ? parseFloat(f.initialQuantity) : undefined,
  });

  const saveFn = useCallback(async (f: ProductForm) => {
    if (!f.name.trim()) return;
    if (isEdit && id) {
      await api.put(`/products/${id}`, buildPayload(f));
      // Atualizar estoque separadamente se mudou
      if (existing?.inventory && (f.minQuantity || f.location)) {
        await api.post(`/inventory/${id}/adjust`, {
          quantity: 0, // apenas metadata
          location: f.location || undefined,
        });
      }
    } else {
      const res = await api.post('/products', buildPayload(f));
      navigate(`/catalog/products/${res.data.id}/edit`, { replace: true });
    }
    qc.invalidateQueries({ queryKey: ['products'] });
    qc.invalidateQueries({ queryKey: ['products-list'] });
    qc.invalidateQueries({ queryKey: ['inventory'] });
  }, [isEdit, id, existing, navigate, qc]);

  const { status: saveStatus, saveNow } = useAutosave(form, saveFn, { enabled: isEdit });

  const adjustMutation = useMutation({
    mutationFn: ({ quantity, location }: { quantity: number; location?: string }) =>
      api.post(`/inventory/${id}/adjust`, { quantity, location }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product', id] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Nome é obrigatório'); return; }
    setError('');
    try {
      await saveNow();
      if (!isEdit) navigate('/catalog/products');
    } catch {
      setError('Erro ao salvar produto');
    }
  };

  const margin = form.costPrice && form.salePrice
    ? (((parseFloat(form.salePrice) - parseFloat(form.costPrice)) / parseFloat(form.costPrice)) * 100).toFixed(1)
    : null;

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link component="button" variant="body2" onClick={() => navigate('/catalog/products')} underline="hover" color="inherit">
          Produtos
        </Link>
        <Typography variant="body2" color="text.primary">{isEdit ? 'Editar' : 'Novo'}</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button size="small" startIcon={<ArrowBack />} onClick={() => navigate('/catalog/products')}>Voltar</Button>
          <Typography variant="h5">{isEdit ? 'Editar Produto' : 'Novo Produto'}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {isEdit && <AutosaveIndicator status={saveStatus} />}
          <Button variant="contained" startIcon={<Save />} onClick={handleSave}>
            {isEdit ? 'Salvar' : 'Criar Produto'}
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2}>
        {/* Dados do produto */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} mb={2}>Dados do Produto</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={8}>
                  <TextField
                    label="Nome do produto"
                    value={form.name}
                    onChange={set('name')}
                    required
                    fullWidth
                    autoFocus={!isEdit}
                    error={!form.name && !!error}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="SKU / Código"
                    value={form.sku}
                    onChange={set('sku')}
                    fullWidth
                    placeholder="ex: TEC-001"
                    inputProps={{ style: { fontFamily: 'monospace' } }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Descrição"
                    value={form.description}
                    onChange={set('description')}
                    fullWidth
                    multiline
                    rows={2}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth>
                    <InputLabel>Unidade</InputLabel>
                    <Select value={form.unit} label="Unidade" onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                      {UNITS.map(u => <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Custo (R$)"
                    type="number"
                    value={form.costPrice}
                    onChange={set('costPrice')}
                    fullWidth
                    inputProps={{ min: 0, step: 0.01 }}
                    helperText="Preço pago ao fornecedor"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Preço de venda (R$)"
                    type="number"
                    value={form.salePrice}
                    onChange={set('salePrice')}
                    fullWidth
                    inputProps={{ min: 0, step: 0.01 }}
                    helperText={margin !== null ? `Margem: ${margin}%` : 'Usado em orçamentos/OS'}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Configurações */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" mb={2}>Configurações</Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.active}
                    onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                    color="primary"
                  />
                }
                label={form.active ? 'Produto ativo' : 'Produto inativo'}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Estoque */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} mb={2}>Estoque</Typography>
              <Grid container spacing={2}>
                {!isEdit && (
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Quantidade inicial"
                      type="number"
                      value={form.initialQuantity}
                      onChange={set('initialQuantity')}
                      fullWidth
                      inputProps={{ min: 0, step: 0.1 }}
                      helperText="Saldo de entrada no sistema"
                    />
                  </Grid>
                )}
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Quantidade mínima"
                    type="number"
                    value={form.minQuantity}
                    onChange={set('minQuantity')}
                    fullWidth
                    inputProps={{ min: 0, step: 0.1 }}
                    helperText="Alerta de estoque baixo"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Localização"
                    value={form.location}
                    onChange={set('location')}
                    fullWidth
                    placeholder="ex: Prateleira A3, Gaveta 2…"
                  />
                </Grid>

                {isEdit && existing?.inventory && (
                  <>
                    <Grid item xs={12}>
                      <Divider />
                    </Grid>
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                        <Box sx={{ bgcolor: 'background.default', borderRadius: 2, p: 1.5, minWidth: 120 }}>
                          <Typography variant="caption" color="text.secondary">Saldo atual</Typography>
                          <Typography variant="h5" fontWeight={700}>
                            {Number(existing.inventory.quantity)} {form.unit}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            variant="outlined"
                            color="success"
                            onClick={() => {
                              const qty = parseFloat(prompt('Quantidade a adicionar:') ?? '0');
                              if (qty > 0) adjustMutation.mutate({ quantity: qty });
                            }}
                          >
                            + Entrada
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            onClick={() => {
                              const qty = parseFloat(prompt('Quantidade a retirar:') ?? '0');
                              if (qty > 0) adjustMutation.mutate({ quantity: -qty });
                            }}
                          >
                            − Saída
                          </Button>
                        </Box>
                      </Box>
                    </Grid>
                  </>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
