import { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Button, Grid, TextField, Card, CardContent,
  Breadcrumbs, Link, Switch, FormControlLabel, MenuItem,
  alpha, Chip, Alert,
} from '@mui/material';
import { ArrowBack, CheckroomOutlined } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useAutosave } from '../../hooks/useAutosave';
import AutosaveIndicator from '../../components/common/AutosaveIndicator';
import { CATEGORIES, CATEGORY_COLOR } from './GarmentsPage';

interface GarmentForm {
  name: string;
  category: string;
  description: string;
  imageUrl: string;
  active: boolean;
}

const EMPTY: GarmentForm = { name: '', category: '', description: '', imageUrl: '', active: true };

export default function GarmentFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<GarmentForm>(EMPTY);
  const [error, setError] = useState('');

  const { data: existing } = useQuery({
    queryKey: ['garment', id],
    queryFn: () => api.get(`/garments/${id}`).then(r => r.data),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name ?? '',
        category: existing.category ?? '',
        description: existing.description ?? '',
        imageUrl: existing.imageUrl ?? '',
        active: existing.active ?? true,
      });
    }
  }, [existing]);

  const set = (field: keyof GarmentForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const buildPayload = useCallback((f: GarmentForm) => ({
    name: f.name.trim(),
    category: f.category || undefined,
    description: f.description.trim() || undefined,
    imageUrl: f.imageUrl.trim() || undefined,
    active: f.active,
  }), []);

  const saveFn = useCallback(async (f: GarmentForm) => {
    if (!f.name.trim()) return;
    if (isEdit && id) {
      await api.put(`/garments/${id}`, buildPayload(f));
    } else {
      const res = await api.post('/garments', buildPayload(f));
      navigate(`/catalog/garments/${res.data.id}/edit`, { replace: true });
    }
    qc.invalidateQueries({ queryKey: ['garments'] });
  }, [isEdit, id, buildPayload, navigate, qc]);

  const { status: saveStatus, saveNow } = useAutosave(form, saveFn, { enabled: isEdit });

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setError('');
    try {
      await saveNow();
      if (!isEdit) navigate('/catalog/garments');
    } catch {
      // Sem isto, uma criação que falha sairia da tela como se tivesse salvo.
      setError('Erro ao salvar a peça');
    }
  };

  const color = CATEGORY_COLOR[form.category] ?? '#898781';
  const imageValid = form.imageUrl.startsWith('http');

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link component="button" variant="body2" onClick={() => navigate('/catalog/garments')} underline="hover" color="inherit">
          Catálogo de Peças
        </Link>
        <Typography variant="body2" color="text.primary">
          {isEdit ? existing?.name ?? 'Editar' : 'Nova Peça'}
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button size="small" startIcon={<ArrowBack />} onClick={() => navigate('/catalog/garments')}>Voltar</Button>
          <Typography variant="h5">{isEdit ? existing?.name ?? '' : 'Nova Peça'}</Typography>
          {isEdit && !form.active && <Chip label="Inativo" size="small" />}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {isEdit && <AutosaveIndicator status={saveStatus} />}
          {!isEdit && (
            <Button variant="contained" disabled={!form.name.trim()} onClick={handleSave}>
              Criar Peça
            </Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        {/* Preview */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ overflow: 'hidden' }}>
            {imageValid ? (
              <Box
                component="img"
                src={form.imageUrl}
                alt={form.name}
                sx={{ width: '100%', height: 240, objectFit: 'cover', display: 'block' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <Box
                sx={{
                  height: 240,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: alpha(color, 0.08),
                  borderBottom: `3px solid ${alpha(color, 0.25)}`,
                }}
              >
                <CheckroomOutlined sx={{ fontSize: 80, color: alpha(color, 0.3) }} />
              </Box>
            )}
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700}>{form.name || 'Nome da peça'}</Typography>
              {form.category && (
                <Chip
                  label={form.category}
                  size="small"
                  sx={{ mt: 0.5, bgcolor: alpha(color, 0.12), color, fontWeight: 500 }}
                />
              )}
              {form.description && (
                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  {form.description}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Formulário */}
        <Grid item xs={12} md={8}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} mb={2}>Dados da peça</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label="Nome da peça"
                    value={form.name}
                    onChange={set('name')}
                    fullWidth
                    required
                    autoFocus={!isEdit}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Categoria"
                    select
                    value={form.category}
                    onChange={set('category')}
                    fullWidth
                  >
                    <MenuItem value=""><em>Sem categoria</em></MenuItem>
                    {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Descrição"
                    value={form.description}
                    onChange={set('description')}
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="Tecido, modelagem, referências, observações…"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="URL da foto"
                    value={form.imageUrl}
                    onChange={set('imageUrl')}
                    fullWidth
                    placeholder="https://…"
                    helperText="Cole o endereço de uma imagem para exibir no catálogo"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.active}
                        onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                        color="primary"
                      />
                    }
                    label="Peça ativa no catálogo"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
