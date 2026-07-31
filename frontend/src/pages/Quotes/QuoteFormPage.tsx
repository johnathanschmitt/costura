import { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Button, Grid, TextField, Card, CardContent,
  Breadcrumbs, Link, Alert, Chip,
} from '@mui/material';
import { Save, ArrowBack, CheckCircle, Assignment, Print } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs, { Dayjs } from 'dayjs';
import api from '../../services/api';
import { useAutosave } from '../../hooks/useAutosave';
import AutosaveIndicator from '../../components/common/AutosaveIndicator';
import CustomerAutocomplete from '../../components/common/CustomerAutocomplete';
import ItemsEditor, { LineItem } from '../../components/common/ItemsEditor';

interface QuoteForm {
  customer: any | null;
  validUntil: Dayjs | null;
  notes: string;
  discount: number;
  items: LineItem[];
}

const EMPTY: QuoteForm = {
  customer: null, validUntil: null, notes: '', discount: 0, items: [],
};

export default function QuoteFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState<QuoteForm>(EMPTY);
  const [error, setError] = useState('');

  const { data: existing } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => api.get(`/quotes/${id}`).then(r => r.data),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        customer: existing.customer ?? null,
        validUntil: existing.validUntil ? dayjs(existing.validUntil) : null,
        notes: existing.notes ?? '',
        discount: parseFloat(existing.discount ?? 0),
        items: existing.items?.map((i: any) => ({
          id: i.id,
          type: i.type,
          serviceId: i.serviceId,
          productId: i.productId,
          description: i.description,
          quantity: parseFloat(i.quantity),
          unitPrice: parseFloat(i.unitPrice),
          total: parseFloat(i.total),
        })) ?? [],
      });
    }
  }, [existing]);

  const buildPayload = useCallback((f: QuoteForm) => ({
    customerId: f.customer?.id,
    validUntil: f.validUntil?.toISOString() ?? null,
    notes: f.notes || null,
    discount: f.discount,
    items: f.items.map(({ id: _id, total: _total, ...rest }) => rest),
  }), []);

  const saveFn = useCallback(async (f: QuoteForm) => {
    if (!f.customer?.id) return;
    if (isEdit && id) {
      await api.put(`/quotes/${id}`, buildPayload(f));
    } else {
      const res = await api.post('/quotes', buildPayload(f));
      navigate(`/quotes/${res.data.id}/edit`, { replace: true });
    }
    qc.invalidateQueries({ queryKey: ['quotes'] });
  }, [isEdit, id, buildPayload, navigate, qc]);

  const { status: saveStatus, saveNow } = useAutosave(form, saveFn, { enabled: isEdit });

  const approveMutation = useMutation({
    mutationFn: () => api.patch(`/quotes/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quote', id] });
      qc.invalidateQueries({ queryKey: ['quotes'] });
    },
  });

  const convertMutation = useMutation({
    mutationFn: () => api.post(`/quotes/${id}/convert`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['quote', id] });
      qc.invalidateQueries({ queryKey: ['work-orders'] });
      navigate(`/work-orders/${res.data.id}/edit`);
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Erro ao converter'),
  });

  const handleSave = async () => {
    if (!form.customer) { setError('Selecione um cliente'); return; }
    if (form.items.length === 0) { setError('Adicione pelo menos um item'); return; }
    setError('');
    try {
      await saveNow();
      if (!isEdit) navigate('/quotes');
    } catch {
      setError('Erro ao salvar orçamento');
    }
  };

  const total = form.items.reduce((s, i) => s + i.total, 0) - form.discount;
  const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
  const isDraft = !existing?.status || existing.status === 'DRAFT' || existing.status === 'SENT';
  const isApproved = existing?.status === 'APPROVED';
  const linkedWO = existing?.workOrder;

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link component="button" variant="body2" onClick={() => navigate('/quotes')} underline="hover" color="inherit">
          Orçamentos
        </Link>
        <Typography variant="body2" color="text.primary">
          {isEdit ? existing?.number ?? 'Editar' : 'Novo'}
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button size="small" startIcon={<ArrowBack />} onClick={() => navigate('/quotes')}>Voltar</Button>
          <Typography variant="h5">{isEdit ? `Orçamento ${existing?.number ?? ''}` : 'Novo Orçamento'}</Typography>
          {existing?.status && (
            <Chip
              label={{ DRAFT: 'Rascunho', SENT: 'Enviado', APPROVED: 'Aprovado', REJECTED: 'Recusado', EXPIRED: 'Expirado' }[existing.status as string] ?? existing.status}
              size="small"
              color={existing.status === 'APPROVED' ? 'success' : existing.status === 'REJECTED' ? 'error' : 'default'}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {isEdit && <AutosaveIndicator status={saveStatus} />}
          {linkedWO && (
            <Chip
              icon={<Assignment fontSize="small" />}
              label={`OS ${linkedWO.number}`}
              color="primary"
              variant="outlined"
              size="small"
              onClick={() => navigate(`/work-orders/${linkedWO.id}/edit`)}
              sx={{ cursor: 'pointer' }}
            />
          )}
          {isEdit && (
            <Button
              variant="outlined"
              startIcon={<Print />}
              onClick={() => window.open(`/quotes/${id}/print`, '_blank')}
            >
              Imprimir / PDF
            </Button>
          )}
          {isEdit && existing?.status === 'DRAFT' && (
            <Button
              variant="outlined"
              color="success"
              startIcon={<CheckCircle />}
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
            >
              Aprovar
            </Button>
          )}
          {isEdit && isApproved && !linkedWO && (
            <Button
              variant="contained"
              color="secondary"
              startIcon={<Assignment />}
              onClick={() => convertMutation.mutate()}
              disabled={convertMutation.isPending}
            >
              Converter em OS
            </Button>
          )}
          {isDraft && (
            <Button variant="contained" startIcon={<Save />} onClick={handleSave}>
              {isEdit ? 'Salvar' : 'Criar Orçamento'}
            </Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2}>
        {/* Cabeçalho */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} mb={2}>Dados do Orçamento</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <CustomerAutocomplete
                    value={form.customer}
                    onChange={c => setForm(f => ({ ...f, customer: c }))}
                    required
                    error={!form.customer && !!error}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <DatePicker
                    label="Válido até"
                    value={form.validUntil}
                    onChange={v => setForm(f => ({ ...f, validUntil: v }))}
                    slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Resumo financeiro */}
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
            <CardContent>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>Subtotal</Typography>
              <Typography variant="h5" fontWeight={700}>
                {fmt(form.items.reduce((s, i) => s + i.total, 0))}
              </Typography>
              {form.discount > 0 && (
                <>
                  <Typography variant="body2" sx={{ opacity: 0.8, mt: 1 }}>Desconto</Typography>
                  <Typography>- {fmt(form.discount)}</Typography>
                </>
              )}
              <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(255,255,255,0.3)' }}>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>Total</Typography>
                <Typography variant="h4" fontWeight={700}>{fmt(total)}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Itens */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} mb={2}>Itens</Typography>
              <ItemsEditor
                items={form.items}
                onChange={items => setForm(f => ({ ...f, items }))}
                readOnly={!isDraft}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Rodapé */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Desconto (R$)"
                    type="number"
                    value={form.discount}
                    onChange={e => setForm(f => ({ ...f, discount: parseFloat(e.target.value) || 0 }))}
                    fullWidth
                    inputProps={{ min: 0, step: 0.01 }}
                    disabled={!isDraft}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Observações para o cliente"
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    fullWidth
                    multiline
                    rows={3}
                    disabled={!isDraft}
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
