import { useState } from 'react';
import {
  Card, CardContent, Typography, Grid, TextField, Button, IconButton, Tooltip,
  Table, TableBody, TableCell, TableHead, TableRow, Box, Collapse, CircularProgress,
} from '@mui/material';
import { Add, ExpandMore, ExpandLess, DeleteOutline } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import api from '../../services/api';

const FIELDS: { key: string; label: string }[] = [
  { key: 'bust', label: 'Busto' },
  { key: 'waist', label: 'Cintura' },
  { key: 'hip', label: 'Quadril' },
  { key: 'shoulder', label: 'Ombro' },
  { key: 'backLength', label: 'Comp. Costas' },
  { key: 'frontLength', label: 'Comp. Frente' },
  { key: 'sleeveLength', label: 'Comp. Manga' },
  { key: 'inseam', label: 'Entrepernas' },
  { key: 'thigh', label: 'Coxa' },
  { key: 'neckCirc', label: 'Pescoço' },
  { key: 'wrist', label: 'Pulso' },
];

type CustomField = { label: string; value: string };

/** Tipos extras salvos numa medição — vêm do backend como [{ label, value }]. */
function readCustom(measurement: any): { label: string; value: number | null }[] {
  return Array.isArray(measurement?.custom) ? measurement.custom : [];
}

export default function MeasurementsCard({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<CustomField[]>([]);
  const [notes, setNotes] = useState('');
  const qc = useQueryClient();

  const { data: measurements = [] } = useQuery({
    queryKey: ['measurements', customerId],
    queryFn: () => api.get(`/customers/${customerId}/measurements`).then(r => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.post(`/customers/${customerId}/measurements`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['measurements', customerId] });
      setShowForm(false);
      setValues({});
      setCustom([]);
      setNotes('');
    },
  });

  const latest = measurements[0];

  // Ao abrir o formulário, repete os tipos extras já usados pelo cliente (sem os valores).
  const toggleForm = () => {
    setShowForm(s => {
      if (!s) setCustom(readCustom(latest).map(f => ({ label: f.label, value: '' })));
      return !s;
    });
  };

  const updateCustom = (index: number, patch: Partial<CustomField>) =>
    setCustom(list => list.map((f, i) => (i === index ? { ...f, ...patch } : f)));

  const handleSave = () => {
    const payload: any = { notes };
    FIELDS.forEach(f => {
      if (values[f.key]) payload[f.key] = parseFloat(values[f.key]);
    });
    payload.custom = custom
      .filter(f => f.label.trim())
      .map(f => ({ label: f.label.trim(), value: f.value ? parseFloat(f.value) : null }));
    saveMutation.mutate(payload);
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>Medidas</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" startIcon={<Add />} onClick={toggleForm}>
              Nova Medição
            </Button>
            <Button size="small" endIcon={open ? <ExpandLess /> : <ExpandMore />} onClick={() => setOpen(s => !s)}>
              Histórico ({measurements.length})
            </Button>
          </Box>
        </Box>

        {/* Medidas atuais */}
        {latest && (
          <Grid container spacing={1} sx={{ mb: 1 }}>
            {FIELDS.filter(f => latest[f.key] != null).map(f => (
              <Grid item xs={6} sm={4} md={3} key={f.key}>
                <Box sx={{ bgcolor: 'background.default', borderRadius: 1, p: 1 }}>
                  <Typography variant="caption" color="text.secondary">{f.label}</Typography>
                  <Typography variant="body2" fontWeight={600}>{latest[f.key]} cm</Typography>
                </Box>
              </Grid>
            ))}
            {readCustom(latest).filter(f => f.value != null).map(f => (
              <Grid item xs={6} sm={4} md={3} key={`custom-${f.label}`}>
                <Box sx={{ bgcolor: 'background.default', borderRadius: 1, p: 1 }}>
                  <Typography variant="caption" color="text.secondary">{f.label}</Typography>
                  <Typography variant="body2" fontWeight={600}>{f.value} cm</Typography>
                </Box>
              </Grid>
            ))}
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">
                Versão {latest.version} — {dayjs(latest.takenAt).format('DD/MM/YYYY')}
              </Typography>
            </Grid>
          </Grid>
        )}

        {!latest && !showForm && (
          <Typography variant="body2" color="text.secondary">Nenhuma medida cadastrada.</Typography>
        )}

        {/* Formulário nova medição */}
        <Collapse in={showForm}>
          <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
            <Typography variant="subtitle2" mb={1.5}>Nova Medição (cm)</Typography>
            <Grid container spacing={1.5}>
              {FIELDS.map(f => (
                <Grid item xs={6} sm={4} md={3} key={f.key}>
                  <TextField
                    label={f.label}
                    value={values[f.key] ?? ''}
                    onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                    type="number"
                    size="small"
                    fullWidth
                    inputProps={{ step: '0.5', min: '0' }}
                    InputProps={{ endAdornment: <Typography variant="caption" color="text.secondary">cm</Typography> }}
                  />
                </Grid>
              ))}

              {custom.map((f, i) => (
                <Grid item xs={12} sm={6} md={4} key={i}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <TextField
                      label="Tipo de medida"
                      placeholder="Ex.: Punho, Cava, Barra"
                      value={f.label}
                      onChange={e => updateCustom(i, { label: e.target.value })}
                      size="small"
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Medida"
                      value={f.value}
                      onChange={e => updateCustom(i, { value: e.target.value })}
                      type="number"
                      size="small"
                      sx={{ width: 110 }}
                      inputProps={{ step: '0.5', min: '0' }}
                      InputProps={{ endAdornment: <Typography variant="caption" color="text.secondary">cm</Typography> }}
                    />
                    <Tooltip title="Remover tipo">
                      <IconButton size="small" onClick={() => setCustom(list => list.filter((_, j) => j !== i))}>
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Grid>
              ))}

              <Grid item xs={12}>
                <Button
                  size="small"
                  startIcon={<Add />}
                  onClick={() => setCustom(list => [...list, { label: '', value: '' }])}
                >
                  Adicionar outro tipo de medida
                </Button>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label="Observações"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  fullWidth
                  multiline
                  rows={2}
                  size="small"
                />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                    startIcon={saveMutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
                  >
                    Salvar Medidas
                  </Button>
                  <Button size="small" onClick={() => setShowForm(false)}>Cancelar</Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Collapse>

        {/* Histórico */}
        <Collapse in={open}>
          <Table size="small" sx={{ mt: 2 }}>
            <TableHead>
              <TableRow>
                <TableCell>Versão</TableCell>
                <TableCell>Data</TableCell>
                <TableCell>Busto</TableCell>
                <TableCell>Cintura</TableCell>
                <TableCell>Quadril</TableCell>
                <TableCell>Obs</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {measurements.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell>v{m.version}</TableCell>
                  <TableCell>{dayjs(m.takenAt).format('DD/MM/YYYY')}</TableCell>
                  <TableCell>{m.bust ?? '—'}</TableCell>
                  <TableCell>{m.waist ?? '—'}</TableCell>
                  <TableCell>{m.hip ?? '—'}</TableCell>
                  <TableCell>{m.notes ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Collapse>
      </CardContent>
    </Card>
  );
}
