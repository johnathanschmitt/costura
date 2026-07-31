import { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Grid, Box, Typography, ToggleButton, ToggleButtonGroup,
  FormControlLabel, Switch, FormControl, InputLabel, Select, MenuItem,
  IconButton, Divider,
} from '@mui/material';
import { Close, ContentCut, LocalShipping, People, MoreHoriz } from '@mui/icons-material';
import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import dayjs, { Dayjs } from 'dayjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import CustomerAutocomplete from '../../components/common/CustomerAutocomplete';
import WorkOrderAutocomplete from '../../components/common/WorkOrderAutocomplete';
import AutosaveIndicator from '../../components/common/AutosaveIndicator';
import { useAutosave } from '../../hooks/useAutosave';

export const TYPE_CONFIG = {
  FITTING:      { label: 'Prova',     icon: <ContentCut />,    color: '#7B3F8C' },
  DELIVERY:     { label: 'Entrega',   icon: <LocalShipping />, color: '#2E7D32' },
  CONSULTATION: { label: 'Consulta',  icon: <People />,        color: '#1565C0' },
  OTHER:        { label: 'Outro',     icon: <MoreHoriz />,     color: '#757575' },
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
    return {
      title: f.title,
      type: f.type,
      customerId: f.customer?.id ?? null,
      workOrderId: f.workOrder?.id ?? null,
      startAt,
      endAt,
      allDay: f.allDay,
      status: f.status,
      notes: f.notes || null,
    };
  };

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
          >
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <ToggleButton
                key={key}
                value={key}
                sx={{
                  gap: 0.5,
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
          onChange={c => setForm(f => ({ ...f, customer: c, workOrder: null }))}
        />

        {/* OS vinculada */}
        <WorkOrderAutocomplete
          value={form.workOrder}
          onChange={wo => setForm(f => ({ ...f, workOrder: wo }))}
          customerId={form.customer?.id}
          disabled={!form.customer}
        />

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
              loading={deleteMutation.isPending}
            >
              Remover
            </Button>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} loading={isSaving}>
            {isEdit ? 'Salvar' : 'Agendar'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
