import { useState } from 'react';
import {
  Card, CardContent, Typography, Grid, TextField, Button,
  Table, TableBody, TableCell, TableHead, TableRow, Box, Collapse, CircularProgress,
} from '@mui/material';
import { Add, ExpandMore, ExpandLess } from '@mui/icons-material';
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

export default function MeasurementsCard({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
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
      setNotes('');
    },
  });

  const handleSave = () => {
    const payload: any = { notes };
    FIELDS.forEach(f => {
      if (values[f.key]) payload[f.key] = parseFloat(values[f.key]);
    });
    saveMutation.mutate(payload);
  };

  const latest = measurements[0];

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>Medidas</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" startIcon={<Add />} onClick={() => setShowForm(s => !s)}>
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
