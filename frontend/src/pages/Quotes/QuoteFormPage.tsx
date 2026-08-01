import { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Button, Grid, TextField, Card, CardContent,
  Breadcrumbs, Link, Alert, Chip,
} from '@mui/material';
import {
  Save, ArrowBack, CheckCircle, Assignment, Print, PersonAdd, ContentCopy, WhatsApp,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs, { Dayjs } from 'dayjs';
import api from '../../services/api';
import { useAutosave } from '../../hooks/useAutosave';
import { useToast } from '../../store/toast.store';
import AutosaveIndicator from '../../components/common/AutosaveIndicator';
import CustomerAutocomplete from '../../components/common/CustomerAutocomplete';
import ItemsEditor, { LineItem } from '../../components/common/ItemsEditor';
import QuickCustomerDialog from '../../components/common/QuickCustomerDialog';
import ConvertDialog from './ConvertDialog';
import ShareDialog from './ShareDialog';

interface QuoteForm {
  customer: any | null;
  validUntil: Dayjs | null;
  deliveryDate: Dayjs | null;
  notes: string;
  discount: number;
  items: LineItem[];
}

const EMPTY: QuoteForm = {
  customer: null, validUntil: null, deliveryDate: null, notes: '', discount: 0, items: [],
};

export default function QuoteFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

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
        deliveryDate: existing.deliveryDate ? dayjs(existing.deliveryDate) : null,
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
          discount: parseFloat(i.discount ?? 0),
          total: parseFloat(i.total),
        })) ?? [],
      });
    }
  }, [existing]);

  // Campos vazios são omitidos: o ValidationPipe do backend recusa null onde
  // espera string ou data.
  const buildPayload = useCallback((f: QuoteForm) => ({
    customerId: f.customer?.id,
    validUntil: f.validUntil?.toISOString() ?? undefined,
    deliveryDate: f.deliveryDate?.toISOString() ?? undefined,
    notes: f.notes || undefined,
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

  const [convertOpen, setConvertOpen] = useState(false);
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const reopenMutation = useMutation({
    mutationFn: () => api.patch(`/quotes/${id}/reopen`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quote', id] });
      qc.invalidateQueries({ queryKey: ['quotes'] });
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Erro ao reabrir'),
  });

  const duplicateMutation = useMutation({
    mutationFn: () => api.post(`/quotes/${id}/duplicate`),
    onSuccess: res => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      navigate(`/quotes/${res.data.id}/edit`);
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Erro ao duplicar'),
  });

  const handleSave = async () => {
    if (!form.customer) { setError('Selecione um cliente'); return; }
    if (form.items.length === 0) { setError('Adicione pelo menos um item'); return; }
    setError('');
    try {
      // Ao criar, o `saveFn` já leva para o orçamento recém-salvo — é lá que
      // ficam Enviar por WhatsApp, Imprimir e Converter em OS. Voltar para a
      // lista aqui obrigava a abrir o orçamento de novo para qualquer um deles.
      await saveNow();
      toast(isEdit ? 'Orçamento salvo' : 'Orçamento criado');
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
          {isEdit && (
            <Button
              variant="outlined"
              color="success"
              startIcon={<WhatsApp />}
              onClick={() => setShareOpen(true)}
            >
              Enviar por WhatsApp
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
          {isEdit && !linkedWO && ['DRAFT', 'SENT', 'APPROVED'].includes(existing?.status ?? '') && (
            <Button
              variant="contained"
              color="secondary"
              startIcon={<Assignment />}
              onClick={() => setConvertOpen(true)}
            >
              {isApproved ? 'Converter em OS' : 'Aprovar e criar OS'}
            </Button>
          )}
          {isEdit && ['REJECTED', 'EXPIRED'].includes(existing?.status ?? '') && (
            <Button variant="outlined" onClick={() => reopenMutation.mutate()} disabled={reopenMutation.isPending}>
              Reabrir
            </Button>
          )}
          {isEdit && (
            <Button variant="outlined" startIcon={<ContentCopy />} onClick={() => duplicateMutation.mutate()}
              disabled={duplicateMutation.isPending}>
              Duplicar
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
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <CustomerAutocomplete
                        value={form.customer}
                        onChange={c => setForm(f => ({ ...f, customer: c }))}
                        required
                        error={!form.customer && !!error}
                      />
                    </Box>
                    <Button
                      variant="outlined"
                      startIcon={<PersonAdd />}
                      onClick={() => setQuickCustomerOpen(true)}
                      sx={{ mt: 0.5, whiteSpace: 'nowrap' }}
                    >
                      Nova
                    </Button>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <DatePicker
                    label="Válido até"
                    value={form.validUntil}
                    onChange={v => setForm(f => ({ ...f, validUntil: v }))}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        size: 'small',
                        helperText: 'Depois desta data o orçamento expira sozinho',
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <DatePicker
                    label="Prazo de entrega estimado"
                    value={form.deliveryDate}
                    onChange={v => setForm(f => ({ ...f, deliveryDate: v }))}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        size: 'small',
                        helperText: 'Vira o prazo da OS na conversão',
                      },
                    }}
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

      <QuickCustomerDialog
        open={quickCustomerOpen}
        onClose={() => setQuickCustomerOpen(false)}
        onCreated={c => setForm(f => ({ ...f, customer: c }))}
      />

      <ConvertDialog
        quote={convertOpen ? existing : null}
        onClose={() => setConvertOpen(false)}
      />

      <ShareDialog quote={shareOpen ? existing : null} onClose={() => setShareOpen(false)} />
    </Box>
  );
}
