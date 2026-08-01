import { Box, Grid, TextField, Typography, Button, Alert } from '@mui/material';
import { ContentCopy } from '@mui/icons-material';

/** Mesmos campos da ficha da cliente, para que os valores sejam comparáveis. */
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

interface Props {
  value: Record<string, any> | null;
  onChange: (v: Record<string, any> | null) => void;
  /** Última medição da ficha da cliente, para copiar como ponto de partida. */
  customerMeasurement?: Record<string, any> | null;
  disabled?: boolean;
}

export default function PieceMeasurements({ value, onChange, customerMeasurement, disabled }: Props) {
  const m = value ?? {};

  const setField = (key: string, raw: string) => {
    const next = { ...m };
    if (raw === '') delete next[key];
    else next[key] = parseFloat(raw);
    onChange(Object.keys(next).length ? next : null);
  };

  const copyFromCustomer = () => {
    if (!customerMeasurement) return;
    const next: Record<string, any> = {};
    FIELDS.forEach(f => {
      if (customerMeasurement[f.key] != null) next[f.key] = Number(customerMeasurement[f.key]);
    });
    onChange(Object.keys(next).length ? next : null);
  };

  const filled = FIELDS.filter(f => m[f.key] != null).length;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={600}>Medidas desta peça</Typography>
          <Typography variant="caption" color="text.secondary">
            Preencha apenas quando diferirem da ficha da cliente
          </Typography>
        </Box>
        {customerMeasurement && !disabled && (
          <Button size="small" startIcon={<ContentCopy />} onClick={copyFromCustomer}>
            Copiar da ficha
          </Button>
        )}
      </Box>

      {filled === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Sem medidas específicas — a produção usa a ficha da cliente.
        </Alert>
      )}

      <Grid container spacing={1.5}>
        {FIELDS.map(f => (
          <Grid item xs={6} sm={4} md={3} key={f.key}>
            <TextField
              label={f.label}
              type="number"
              size="small"
              value={m[f.key] ?? ''}
              onChange={e => setField(f.key, e.target.value)}
              InputProps={{ endAdornment: <Typography variant="caption" color="text.secondary">cm</Typography> }}
              inputProps={{ step: 0.5, min: 0 }}
              disabled={disabled}
              fullWidth
            />
          </Grid>
        ))}
      </Grid>

      <TextField
        label="Observações das medidas"
        value={m.notes ?? ''}
        onChange={e => {
          const next = { ...m };
          if (e.target.value) next.notes = e.target.value;
          else delete next.notes;
          onChange(Object.keys(next).length ? next : null);
        }}
        fullWidth
        multiline
        rows={2}
        size="small"
        sx={{ mt: 2 }}
        disabled={disabled}
      />
    </Box>
  );
}
