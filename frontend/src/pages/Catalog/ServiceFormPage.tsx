import { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Button, Grid, TextField, Card, CardContent,
  Breadcrumbs, Link, Alert, FormControl, InputLabel, Select,
  MenuItem, Switch, FormControlLabel,
} from '@mui/material';
import { Save, ArrowBack } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useAutosave } from '../../hooks/useAutosave';
import AutosaveIndicator from '../../components/common/AutosaveIndicator';

const UNITS = [
  { value: 'un', label: 'Unidade' },
  { value: 'hora', label: 'Hora' },
  { value: 'metro', label: 'Metro' },
  { value: 'peça', label: 'Peça' },
];

interface ServiceForm {
  name: string;
  description: string;
  basePrice: string;
  unit: string;
  active: boolean;
}

const EMPTY: ServiceForm = { name: '', description: '', basePrice: '', unit: 'un', active: true };

export default function ServiceFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState<ServiceForm>(EMPTY);
  const [error, setError] = useState('');

  const { data: existing } = useQuery({
    queryKey: ['service', id],
    queryFn: () => api.get(`/services/${id}`).then(r => r.data),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name ?? '',
        description: existing.description ?? '',
        basePrice: String(existing.basePrice ?? ''),
        unit: existing.unit ?? 'un',
        active: existing.active ?? true,
      });
    }
  }, [existing]);

  const set = (field: keyof ServiceForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const buildPayload = (f: ServiceForm) => ({
    name: f.name,
    description: f.description || null,
    basePrice: parseFloat(f.basePrice) || 0,
    unit: f.unit,
    active: f.active,
  });

  const saveFn = useCallback(async (f: ServiceForm) => {
    if (!f.name.trim()) return;
    if (isEdit && id) {
      await api.put(`/services/${id}`, buildPayload(f));
    } else {
      const res = await api.post('/services', buildPayload(f));
      navigate(`/catalog/services/${res.data.id}/edit`, { replace: true });
    }
    qc.invalidateQueries({ queryKey: ['services'] });
    qc.invalidateQueries({ queryKey: ['services-list'] });
  }, [isEdit, id, navigate, qc]);

  const { status: saveStatus, saveNow } = useAutosave(form, saveFn, { enabled: isEdit });

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Nome é obrigatório'); return; }
    if (!form.basePrice || parseFloat(form.basePrice) <= 0) { setError('Informe o preço base'); return; }
    setError('');
    try {
      await saveNow();
      if (!isEdit) navigate('/catalog/services');
    } catch {
      setError('Erro ao salvar serviço');
    }
  };

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link component="button" variant="body2" onClick={() => navigate('/catalog/services')} underline="hover" color="inherit">
          Serviços
        </Link>
        <Typography variant="body2" color="text.primary">{isEdit ? 'Editar' : 'Novo'}</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button size="small" startIcon={<ArrowBack />} onClick={() => navigate('/catalog/services')}>Voltar</Button>
          <Typography variant="h5">{isEdit ? 'Editar Serviço' : 'Novo Serviço'}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {isEdit && <AutosaveIndicator status={saveStatus} />}
          <Button variant="contained" startIcon={<Save />} onClick={handleSave}>
            {isEdit ? 'Salvar' : 'Criar Serviço'}
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label="Nome do serviço"
                    value={form.name}
                    onChange={set('name')}
                    required
                    fullWidth
                    autoFocus={!isEdit}
                    error={!form.name && !!error}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Descrição"
                    value={form.description}
                    onChange={set('description')}
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="Detalhe o que inclui este serviço…"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Preço base (R$)"
                    type="number"
                    value={form.basePrice}
                    onChange={set('basePrice')}
                    required
                    fullWidth
                    inputProps={{ min: 0, step: 0.01 }}
                    error={!form.basePrice && !!error}
                    helperText="Valor padrão que aparece ao selecionar em orçamentos/OS"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Unidade de cobrança</InputLabel>
                    <Select
                      value={form.unit}
                      label="Unidade de cobrança"
                      onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    >
                      {UNITS.map(u => <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

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
                label={form.active ? 'Serviço ativo' : 'Serviço inativo'}
              />
              <Typography variant="caption" display="block" color="text.secondary" mt={1}>
                Serviços inativos não aparecem na seleção de itens em orçamentos e OS.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
