import { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Grid, Box, Typography, ToggleButton, ToggleButtonGroup,
  FormControlLabel, Switch, FormControl, InputLabel, Select, MenuItem,
  IconButton, Divider, Alert,
} from '@mui/material';
import {
  Close, ContentCut, LocalShipping, People, MoreHoriz, Straighten, RequestQuote,
  EventBusy,
} from '@mui/icons-material';
import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import dayjs, { Dayjs } from 'dayjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import CustomerAutocomplete from '../../components/common/CustomerAutocomplete';
import WorkOrderAutocomplete from '../../components/common/WorkOrderAutocomplete';
import AutosaveIndicator from '../../components/common/AutosaveIndicator';
import { useAutosave } from '../../hooks/useAutosave';

export const TYPE_CONFIG = {
  FITTING:      { label: 'Prova',     icon: <ContentCut />,     color: '#7B3F8C' },
  MEASUREMENT:  { label: 'Medição',   icon: <Straighten />,     color: '#00838F' },
  QUOTE:        { label: 'Orçamento', icon: <RequestQuote />,   color: '#EF6C00' },
  DELIVERY:     { label: 'Entrega',   icon: <LocalShipping />,  color: '#2E7D32' },
  CONSULTATION: { label: 'Consulta',  icon: <People />,         color: '#1565C0' },
  OTHER:        { label: 'Outro',     icon: <MoreHoriz />,      color: '#757575' },
};

const STATUS_OPTIONS = [
  { value: 'SCHEDULED', label: 'Agendado' },
  { value: 'CONFIRMED', label: 'Confirmado' },
  { value: 'DONE', label: 'Realizado' },
  { value: 'CANCELLED', label: 'Cancelado' },
  { value: 'NO_SHOW', label: 'Não compareceu' },
];

interface ScheduleForm {
  title: string;
  type: string;
  customer: any | null;
  workOrder: any | null;
  quoteId: string;
  date: Dayjs;
  startTime: Dayjs;
  endTime: Dayjs;
  allDay: boolean;
  status: string;
  notes: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialDate?: Dayjs;
  initialHour?: number;
  existing?: any;
}

export default function ScheduleFormDialog({ open, onClose, initialDate, initialHour, existing }: Props) {
  const isEdit = Boolean(existing);
  const qc = useQueryClient();

  const buildInitial = useCallback((): ScheduleForm => {
    if (existing) {
      const start = dayjs(existing.startAt);
      const end = dayjs(existing.endAt);
      return {
        title: existing.title ?? '',
        type: existing.type ?? 'CONSULTATION',
        customer: existing.customer ?? null,
        workOrder: existing.workOrder ?? null,
        quoteId: existing.quoteId ?? '',
        date: start,
        startTime: start,
        endTime: end,
        allDay: existing.allDay ?? false,
        status: existing.status ?? 'SCHEDULED',
        notes: existing.notes ?? '',
      };
    }
    const base = initialDate ?? dayjs();
    const hour = initialHour ?? 9;
    return {
      title: '',
      type: 'CONSULTATION',
      customer: null,
      workOrder: null,
      quoteId: '',
      date: base,
      startTime: base.hour(hour).minute(0),
      endTime: base.hour(hour + 1).minute(0),
      allDay: false,
      status: 'SCHEDULED',
      notes: '',
    };
  }, [existing, initialDate, initialHour]);

  const [form, setForm] = useState<ScheduleForm>(buildInitial);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) setForm(buildInitial());
  }, [open, buildInitial]);

  // Auto-gera título quando tipo ou cliente muda
  useEffect(() => {
    if (!form.title || form.title === autoTitle(form.type, null)) {
      setForm(f => ({ ...f, title: autoTitle(f.type, f.customer) }));
    }
  }, [form.type, form.customer]);

  const autoTitle = (type: string, customer: any) => {
    const typeLabel = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG]?.label ?? type;
    return customer ? `${typeLabel} — ${customer.name}` : typeLabel;
  };

  const buildPayload = (f: ScheduleForm) => {
    const startAt = f.date
      .hour(f.startTime.hour())
      .minute(f.startTime.minute())
      .second(0)
      .toISOString();
    const endAt = f.date
      .hour(f.endTime.hour())
      .minute(f.endTime.minute())
      .second(0)
      .toISOString();
    // Campos vazios são omitidos: o backend valida os tipos e recusa null.
    return {
      title: f.title,
      type: f.type,
      customerId: f.customer?.id || undefined,
      workOrderId: f.workOrder?.id || undefined,
      quoteId: f.quoteId || undefined,
      startAt,
      endAt,
      allDay: f.allDay,
      status: f.status,
      notes: f.notes || undefined,
    };
  };

  const period = buildPayload(form);

  // Consulta os conflitos enquanto a usuária escolhe o horário, para o aviso
  // aparecer antes de salvar — e não como erro depois.
  const { data: conflicts = [] } = useQuery({
    queryKey: ['schedule-conflicts', period.startAt, period.endAt, existing?.id],
    queryFn: () => api.get('/schedules/conflicts', {
      params: { startAt: period.startAt, endAt: period.endAt, excludeId: existing?.id },
    }).then(r => r.data),
    enabled: open && !form.allDay && dayjs(period.endAt).isAfter(dayjs(period.startAt)),
  });

  // Orçamentos da cliente selecionada, para vincular o compromisso.
  const { data: customerQuotes = [] } = useQuery({
    queryKey: ['customer-quotes', form.customer?.id],
    queryFn: () => api.get('/quotes', { params: { customerId: form.customer.id, limit: 20 } })
      .then(r => r.data?.data ?? []),
    enabled: Boolean(form.customer?.id),
  });

  const saveFn = useCallback(async (f: ScheduleForm) => {
    if (!f.title.trim()) return;
    if (isEdit && existing?.id) {
      await api.put(`/schedules/${existing.id}`, buildPayload(f));
      qc.invalidateQueries({ queryKey: ['schedules'] });
    }
  }, [isEdit, existing, qc]);

  const { status: saveStatus, saveNow } = useAutosave(form, saveFn, { enabled: isEdit });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/schedules', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules'] }); onClose(); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put(`/schedules/${existing?.id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules'] }); onClose(); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/schedules/${existing?.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules'] }); onClose(); },
  });

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Título é obrigatório'); return; }
    setError('');
    const payload = buildPayload(form);
    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const typeColor = TYPE_CONFIG[form.type as keyof typeof TYPE_CONFIG]?.color ?? '#757575';
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderTop: `4px solid ${typeColor}` } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="h6">{isEdit ? 'Editar Agendamento' : 'Novo Agendamento'}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isEdit && <AutosaveIndicator status={saveStatus} />}
          <IconButton size="small" onClick={onClose}><Close /></IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1.5 }}>
        {/* Tipo */}
        <Box>
          <Typography variant="caption" color="text.secondary" mb={0.5} display="block">Tipo</Typography>
          <ToggleButtonGroup
            value={form.type}
            exclusive
            onChange={(_, v) => v && setForm(f => ({ ...f, type: v }))}
            size="small"
            fullWidth
            // Com seis tipos a fila não cabe numa linha só; deixamos quebrar
            // em vez de cortar o último.
            sx={{
              flexWrap: 'wrap',
              '& .MuiToggleButtonGroup-grouped': {
                flex: '1 0 30%',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                m: 0.25,
              },
            }}
          >
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <ToggleButton
                key={key}
                value={key}
                sx={{
                  gap: 0.5,
                  px: 1,
                  '&.Mui-selected': { bgcolor: `${cfg.color}18`, borderColor: cfg.color, color: cfg.color },
                }}
              >
                {cfg.icon}
                <Typography variant="caption" fontWeight={600}>{cfg.label}</Typography>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        {/* Título */}
        <TextField
          label="Título"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          fullWidth
          required
          error={!form.title && !!error}
          helperText={error || undefined}
          autoFocus={!isEdit}
        />

        {/* Cliente */}
        <CustomerAutocomplete
          value={form.customer}
          onChange={c => setForm(f => ({ ...f, customer: c, workOrder: null, quoteId: '' }))}
        />

        {/* OS vinculada */}
        <WorkOrderAutocomplete
          value={form.workOrder}
          onChange={wo => setForm(f => ({ ...f, workOrder: wo }))}
          customerId={form.customer?.id}
          disabled={!form.customer}
        />

        {/* Orçamento vinculado */}
        <FormControl fullWidth size="small" disabled={!form.customer}>
          <InputLabel>Orçamento vinculado</InputLabel>
          <Select
            value={form.quoteId}
            label="Orçamento vinculado"
            onChange={e => setForm(f => ({ ...f, quoteId: e.target.value }))}
          >
            <MenuItem value="">Nenhum</MenuItem>
            {(customerQuotes as any[]).map(q => (
              <MenuItem key={q.id} value={q.id}>
                {q.number} — {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(q.total))}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Divider />

        {/* Data e horário */}
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6}>
            <DatePicker
              label="Data"
              value={form.date}
              onChange={v => v && setForm(f => ({ ...f, date: v }))}
              slotProps={{ textField: { fullWidth: true, size: 'small', required: true } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.allDay}
                  onChange={e => setForm(f => ({ ...f, allDay: e.target.checked }))}
                />
              }
              label="Dia inteiro"
            />
          </Grid>

          {!form.allDay && (
            <>
              <Grid item xs={6}>
                <TimePicker
                  label="Início"
                  value={form.startTime}
                  onChange={v => v && setForm(f => ({ ...f, startTime: v }))}
                  ampm={false}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Grid>
              <Grid item xs={6}>
                <TimePicker
                  label="Término"
                  value={form.endTime}
                  onChange={v => v && setForm(f => ({ ...f, endTime: v }))}
                  ampm={false}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Grid>
            </>
          )}
        </Grid>

        {/* Status — só em edição */}
        {isEdit && (
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select
              value={form.status}
              label="Status"
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            >
              {STATUS_OPTIONS.map(s => (
                <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Conflito de horário — aviso, não impedimento */}
        {(conflicts as any[]).length > 0 && (
          <Alert severity="warning" icon={<EventBusy />}>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              Já há {conflicts.length === 1 ? 'um compromisso' : `${conflicts.length} compromissos`} neste horário
            </Typography>
            {(conflicts as any[]).slice(0, 3).map((c: any) => (
              <Typography key={c.id} variant="caption" display="block">
                • {dayjs(c.startAt).format('HH:mm')}–{dayjs(c.endAt).format('HH:mm')} · {c.title}
                {c.customer ? ` (${c.customer.name})` : ''}
              </Typography>
            ))}
            {conflicts.length > 3 && (
              <Typography variant="caption">e mais {conflicts.length - 3}…</Typography>
            )}
          </Alert>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        {/* Notas */}
        <TextField
          label="Observações"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          fullWidth
          multiline
          rows={2}
          placeholder="Detalhes, lembretes…"
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <Box>
          {isEdit && (
            <Button
              color="error"
              onClick={() => { if (confirm('Remover agendamento?')) deleteMutation.mutate(); }}
              disabled={deleteMutation.isPending}
            >
              Remover
            </Button>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={isSaving}>
            {isEdit ? 'Salvar' : 'Agendar'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
