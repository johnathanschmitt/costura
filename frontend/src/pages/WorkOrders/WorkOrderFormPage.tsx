import { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Button, Grid, TextField, Card, CardContent,
  Breadcrumbs, Link, Alert, Chip, Select, MenuItem, FormControl, InputLabel,
  Stepper, Step, StepLabel,
} from '@mui/material';
import { Save, ArrowBack, PlayArrow, Done, LocalShipping, RequestQuote, Pause, ContentCut } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs, { Dayjs } from 'dayjs';
import api from '../../services/api';
import { useAutosave } from '../../hooks/useAutosave';
import AutosaveIndicator from '../../components/common/AutosaveIndicator';
import CustomerAutocomplete from '../../components/common/CustomerAutocomplete';
import ItemsEditor, { LineItem } from '../../components/common/ItemsEditor';
import AttachmentsCard from '../../components/common/AttachmentsCard';
import { useToast } from '../../store/toast.store';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';

const STATUS_STEPS = ['PENDING', 'IN_PROGRESS', 'FITTING', 'DONE', 'DELIVERED'];
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente', IN_PROGRESS: 'Em Andamento', WAITING_MATERIAL: 'Aguard. Material',
  FITTING: 'Prova', DONE: 'Concluída', DELIVERED: 'Entregue', CANCELLED: 'Cancelada',
};

interface WOForm {
  customer: any | null;
  priority: string;
  dueDate: Dayjs | null;
  notes: string;
  internalNotes: string;
  discount: number;
  items: LineItem[];
}

const EMPTY: WOForm = {
  customer: null, priority: 'NORMAL', dueDate: null, notes: '', internalNotes: '', discount: 0, items: [],
};

export default function WorkOrderFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState<WOForm>(EMPTY);
  const [error, setError] = useState('');

  const { data: existing } = useQuery({
    queryKey: ['work-order', id],
    queryFn: () => api.get(`/work-orders/${id}`).then(r => r.data),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        customer: existing.customer ?? null,
        priority: existing.priority ?? 'NORMAL',
        dueDate: existing.dueDate ? dayjs(existing.dueDate) : null,
        notes: existing.notes ?? '',
        internalNotes: existing.internalNotes ?? '',
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
          done: i.done,
        })) ?? [],
      });
    }
  }, [existing]);

  const buildPayload = useCallback((f: WOForm) => ({
    customerId: f.customer?.id,
    priority: f.priority,
    dueDate: f.dueDate?.toISOString() ?? null,
    notes: f.notes || null,
    internalNotes: f.internalNotes || null,
    discount: f.discount,
    items: f.items.map(({ id: _id, total: _total, ...rest }) => rest),
  }), []);

  const saveFn = useCallback(async (f: WOForm) => {
    if (!f.customer?.id) return;
    if (isEdit && id) {
      await api.put(`/work-orders/${id}`, buildPayload(f));
    } else {
      const res = await api.post('/work-orders', buildPayload(f));
      navigate(`/work-orders/${res.data.id}/edit`, { replace: true });
    }
    qc.invalidateQueries({ queryKey: ['work-orders'] });
  }, [isEdit, id, buildPayload, navigate, qc]);

  const { status: saveStatus, saveNow } = useAutosave(form, saveFn, { enabled: isEdit });

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/work-orders/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work-order', id] }),
  });

  const handleSave = async () => {
    if (!form.customer) { setError('Selecione um cliente'); return; }
    if (form.items.length === 0) { setError('Adicione pelo menos um item'); return; }
    setError('');
    try {
      await saveNow();
      if (!isEdit) navigate('/work-orders');
    } catch {
      setError('Erro ao salvar OS');
    }
  };

  const total = form.items.reduce((s, i) => s + i.total, 0) - form.discount;
  const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
  const isActive = !['DELIVERED', 'CANCELLED'].includes(existing?.status ?? '');
  const stepIndex = STATUS_STEPS.indexOf(existing?.status ?? 'PENDING');

  const PRIORITY_COLOR: Record<string, any> = { LOW: 'default', NORMAL: 'default', HIGH: 'warning', URGENT: 'error' };

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link component="button" variant="body2" onClick={() => navigate('/work-orders')} underline="hover" color="inherit">
          Ordens de Serviço
        </Link>
        <Typography variant="body2" color="text.primary">
          {isEdit ? existing?.number ?? 'Editar' : 'Nova'}
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button size="small" startIcon={<ArrowBack />} onClick={() => navigate('/work-orders')}>Voltar</Button>
          <Typography variant="h5">{isEdit ? `OS ${existing?.number ?? ''}` : 'Nova Ordem de Serviço'}</Typography>
          {existing?.status && (
            <Chip
              label={STATUS_LABELS[existing.status] ?? existing.status}
              size="small"
              color={existing.status === 'DELIVERED' ? 'success' : existing.status === 'CANCELLED' ? 'error' : 'default'}
            />
          )}
          {existing?.priority && existing.priority !== 'NORMAL' && (
            <Chip label={existing.priority} size="small" color={PRIORITY_COLOR[existing.priority]} />
          )}
          {existing?.quote && (
            <Chip
              icon={<RequestQuote fontSize="small" />}
              label={`Orc. ${existing.quote.number}`}
              size="small"
              variant="outlined"
              onClick={() => navigate(`/quotes/${existing.quote.id}/edit`)}
              sx={{ cursor: 'pointer' }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {isEdit && <AutosaveIndicator status={saveStatus} />}
          {existing?.status === 'PENDING' && (
            <Button size="small" variant="outlined" color="info" startIcon={<PlayArrow />}
              onClick={() => statusMutation.mutate('IN_PROGRESS')}>
              Iniciar
            </Button>
          )}
          {existing?.status === 'IN_PROGRESS' && (
            <Button size="small" variant="outlined" color="success" startIcon={<Done />}
              onClick={() => statusMutation.mutate('DONE')}>
              Concluir
            </Button>
          )}
          {existing?.status === 'DONE' && (
            <Button size="small" variant="outlined" color="primary" startIcon={<LocalShipping />}
              onClick={() => statusMutation.mutate('DELIVERED')}>
              Entregar
            </Button>
          )}
          {isActive && (
            <Button variant="contained" startIcon={<Save />} onClick={handleSave}>
              {isEdit ? 'Salvar' : 'Criar OS'}
            </Button>
          )}
        </Box>
      </Box>

      {/* Stepper de progresso */}
      {isEdit && existing?.status !== 'CANCELLED' && (
        <Stepper activeStep={stepIndex} sx={{ mb: 3 }}>
          {STATUS_STEPS.map(s => (
            <Step key={s}><StepLabel>{STATUS_LABELS[s]}</StepLabel></Step>
          ))}
        </Stepper>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2}>
        {/* Dados principais */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} mb={2}>Dados da OS</Typography>
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
                  <FormControl fullWidth size="small">
                    <InputLabel>Prioridade</InputLabel>
                    <Select
                      value={form.priority}
                      label="Prioridade"
                      onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                      disabled={!isActive}
                    >
                      <MenuItem value="LOW">Baixa</MenuItem>
                      <MenuItem value="NORMAL">Normal</MenuItem>
                      <MenuItem value="HIGH">Alta</MenuItem>
                      <MenuItem value="URGENT">Urgente</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <DatePicker
                    label="Prazo de entrega"
                    value={form.dueDate}
                    onChange={v => setForm(f => ({ ...f, dueDate: v }))}
                    slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                    disabled={!isActive}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Resumo financeiro */}
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: 'primary.main', color: 'white', height: '100%' }}>
            <CardContent>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>Total da OS</Typography>
              <Typography variant="h4" fontWeight={700}>{fmt(total)}</Typography>
              {existing?.paidAmount > 0 && (
                <>
                  <Typography variant="body2" sx={{ opacity: 0.8, mt: 1.5 }}>Recebido</Typography>
                  <Typography variant="h6">{fmt(existing.paidAmount)}</Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5 }}>Saldo</Typography>
                  <Typography variant="h6" color={total - existing.paidAmount > 0 ? 'error.light' : 'success.light'}>
                    {fmt(total - existing.paidAmount)}
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Itens */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} mb={2}>Itens / Serviços</Typography>
              <ItemsEditor
                items={form.items}
                onChange={items => setForm(f => ({ ...f, items }))}
                readOnly={!isActive}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Notas */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <TextField
                label="Observações para o cliente"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                fullWidth
                multiline
                rows={4}
                disabled={!isActive}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <TextField
                label="Notas internas"
                value={form.internalNotes}
                onChange={e => setForm(f => ({ ...f, internalNotes: e.target.value }))}
                fullWidth
                multiline
                rows={4}
                placeholder="Detalhes técnicos, avisos da equipe…"
                disabled={!isActive}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Anexos */}
        {isEdit && id && (
          <Grid item xs={12}>
            <AttachmentsCard entityType="workOrder" entityId={id} />
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
