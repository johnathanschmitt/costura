import { useEffect, useState } from 'react';
import {
  Box, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Typography, TextField, Alert, Chip, Skeleton, Card, CardContent, Grid,
  Divider, Tooltip,
} from '@mui/material';
import { PlaylistAddCheck, Save, History } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import api from '../../services/api';
import { useToast } from '../../store/toast.store';
import { apiError, fmt, qty } from './format';

export default function CountTab() {
  const qc = useQueryClient();
  const toast = useToast();
  const [counting, setCounting] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const { data: sheet = [], isLoading } = useQuery({
    queryKey: ['count-sheet'],
    queryFn: () => api.get('/inventory/count-sheet').then(r => r.data),
    enabled: counting,
  });

  const { data: report } = useQuery({
    queryKey: ['count-report'],
    queryFn: () => api.get('/inventory/counts/report').then(r => r.data).catch(() => null),
    retry: false,
  });

  useEffect(() => {
    if (counting) { setCounts({}); setNotes(''); setError(''); }
  }, [counting]);

  const mutation = useMutation({
    mutationFn: () => api.post('/inventory/counts', {
      // Só produtos com contagem digitada entram — em branco significa
      // "não contei", não "contei zero".
      items: (sheet as any[])
        .filter(p => counts[p.productId] !== undefined && counts[p.productId] !== '')
        .map(p => ({ productId: p.productId, countedQuantity: parseFloat(counts[p.productId]) })),
      notes: notes || undefined,
    }),
    onSuccess: res => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['inventory-movements'] });
      qc.invalidateQueries({ queryKey: ['low-stock'] });
      qc.invalidateQueries({ queryKey: ['count-report'] });
      const n = res.data.summary.divergentProducts;
      toast(n === 0 ? 'Inventário fechado — tudo conferido' : `Inventário fechado com ${n} divergência(s)`,
        n === 0 ? 'success' : 'warning');
      setCounting(false);
    },
    onError: (e: any) => setError(apiError(e, 'Erro ao fechar o inventário')),
  });

  const filled = Object.values(counts).filter(v => v !== '').length;

  if (!counting) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>Inventário</Typography>
            <Typography variant="caption" color="text.secondary">
              Conte o que há fisicamente e o sistema aponta as diferenças.
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<PlaylistAddCheck />} onClick={() => setCounting(true)}>
            Iniciar contagem
          </Button>
        </Box>

        {!report ? (
          <Alert severity="info" icon={<History />}>
            Nenhum inventário realizado ainda.
          </Alert>
        ) : (
          <>
            <Grid container spacing={2} mb={2}>
              <Grid item xs={12} sm={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">Último inventário</Typography>
                    <Typography variant="h6" fontWeight={700}>
                      {dayjs(report.summary.countedAt).format('DD/MM/YYYY')}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">Divergências</Typography>
                    <Typography variant="h6" fontWeight={700} color={report.summary.divergentProducts > 0 ? 'warning.main' : 'success.main'}>
                      {report.summary.divergentProducts}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {report.summary.shortages} falta(s) · {report.summary.surpluses} sobra(s)
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">Impacto no valor</Typography>
                    <Typography
                      variant="h6"
                      fontWeight={700}
                      color={Number(report.summary.valueImpact) < 0 ? 'error.main' : 'success.main'}
                    >
                      {fmt(report.summary.valueImpact)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">pelo preço de custo</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Produto</TableCell>
                    <TableCell>Diferença</TableCell>
                    <TableCell align="right">Saldo após</TableCell>
                    <TableCell>Detalhe</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.divergences.map((d: any) => (
                    <TableRow key={d.productId} hover>
                      <TableCell>{d.name}</TableCell>
                      <TableCell>
                        <Chip
                          label={`${d.kind} · ${qty(Math.abs(Number(d.difference)))} ${d.unit}`}
                          size="small"
                          color={d.kind === 'FALTA' ? 'error' : 'success'}
                        />
                      </TableCell>
                      <TableCell align="right">{qty(d.balanceAfter)} {d.unit}</TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">{d.detail}</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {report.divergences.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography variant="body2" color="success.main" py={2}>
                          Nenhuma divergência — o estoque batia com a contagem.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Box>
    );
  }

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Alert severity="info" sx={{ mb: 2 }}>
        Digite a quantidade contada de cada produto. Deixe em branco os que não contou —
        eles ficam de fora do ajuste.
      </Alert>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Produto</TableCell>
              <TableCell>Localização</TableCell>
              <TableCell align="right">Sistema</TableCell>
              <TableCell align="right" width={150}>Contado</TableCell>
              <TableCell align="right">Diferença</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
            )) : (sheet as any[]).map(p => {
              const raw = counts[p.productId];
              const counted = raw === undefined || raw === '' ? null : parseFloat(raw);
              const diff = counted !== null && !Number.isNaN(counted)
                ? counted - Number(p.systemQuantity)
                : null;
              return (
                <TableRow key={p.productId} hover>
                  <TableCell>
                    {p.name}
                    {p.sku && <Typography variant="caption" display="block" color="text.secondary">{p.sku}</Typography>}
                  </TableCell>
                  <TableCell>{p.location ?? '—'}</TableCell>
                  <TableCell align="right">{qty(p.systemQuantity)} {p.unit}</TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      value={raw ?? ''}
                      onChange={e => setCounts(c => ({ ...c, [p.productId]: e.target.value }))}
                      inputProps={{ min: 0, step: 0.001, style: { textAlign: 'right' } }}
                      sx={{ width: 120 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {diff === null || Number.isNaN(diff) ? (
                      <Typography variant="caption" color="text.disabled">—</Typography>
                    ) : diff === 0 ? (
                      <Chip label="confere" size="small" color="success" variant="outlined" />
                    ) : (
                      <Tooltip title={diff < 0 ? 'Falta no estoque físico' : 'Sobra no estoque físico'}>
                        <Chip
                          label={`${diff > 0 ? '+' : ''}${qty(diff)}`}
                          size="small"
                          color={diff < 0 ? 'error' : 'success'}
                        />
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Divider sx={{ my: 2 }} />
      <TextField
        label="Observações do inventário"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        fullWidth
        multiline
        rows={2}
        size="small"
        sx={{ mb: 2 }}
      />

      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
        <Button onClick={() => setCounting(false)} disabled={mutation.isPending}>Cancelar</Button>
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="body2" color="text.secondary">
          {filled} de {sheet.length} produtos contados
        </Typography>
        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={() => mutation.mutate()}
          disabled={filled === 0 || mutation.isPending}
        >
          Fechar inventário
        </Button>
      </Box>
    </Box>
  );
}
