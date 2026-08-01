import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, TextField, LinearProgress,
  ToggleButton, ToggleButtonGroup, Divider, Alert, Avatar, Chip,
} from '@mui/material';
import { Send } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import api from '../../services/api';
import { useToast } from '../../store/toast.store';
import { apiError } from './constants';

const STEPS = [0, 25, 50, 75, 100];

interface Props {
  workOrderId: string;
  currentPct: number;
  readOnly?: boolean;
}

export default function ProgressCard({ workOrderId, currentPct, readOnly }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [pct, setPct] = useState<number | null>(null);
  const [error, setError] = useState('');

  const { data: updates = [] } = useQuery({
    queryKey: ['work-order-updates', workOrderId],
    queryFn: () => api.get(`/work-orders/${workOrderId}/updates`).then(r => r.data),
  });

  const mutation = useMutation({
    mutationFn: () => api.post(`/work-orders/${workOrderId}/updates`, {
      note,
      progressPct: pct ?? undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-order-updates', workOrderId] });
      qc.invalidateQueries({ queryKey: ['work-order', workOrderId] });
      qc.invalidateQueries({ queryKey: ['work-orders-board'] });
      setNote('');
      setPct(null);
      setError('');
      toast('Andamento registrado');
    },
    onError: (e: any) => setError(apiError(e, 'Erro ao registrar o andamento')),
  });

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>Andamento da produção</Typography>
          <Chip label={`${currentPct}% concluído`} size="small" color={currentPct === 100 ? 'success' : 'default'} />
        </Box>
        <LinearProgress
          variant="determinate"
          value={currentPct}
          color={currentPct === 100 ? 'success' : 'primary'}
          sx={{ height: 8, borderRadius: 1, mb: 2 }}
        />

        {!readOnly && (
          <>
            {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
            <TextField
              label="O que foi feito"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ex: corte concluído, iniciando a montagem"
              fullWidth
              multiline
              rows={2}
              size="small"
              sx={{ mb: 1.5 }}
            />
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary">Conclusão:</Typography>
              <ToggleButtonGroup
                value={pct}
                exclusive
                size="small"
                onChange={(_, v) => setPct(v)}
              >
                {STEPS.map(s => (
                  <ToggleButton key={s} value={s} sx={{ px: 1.5 }}>{s}%</ToggleButton>
                ))}
              </ToggleButtonGroup>
              <Box sx={{ flexGrow: 1 }} />
              <Button
                variant="contained"
                size="small"
                startIcon={<Send />}
                onClick={() => mutation.mutate()}
                disabled={!note.trim() || mutation.isPending}
              >
                Registrar
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
              O percentual é opcional — deixe em branco para só anotar o que aconteceu.
            </Typography>
            <Divider sx={{ my: 2 }} />
          </>
        )}

        {updates.length === 0 ? (
          <Typography variant="body2" color="text.secondary" py={1}>
            Nenhuma atualização registrada ainda.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {(updates as any[]).map(u => (
              <Box key={u.id} sx={{ display: 'flex', gap: 1.5 }}>
                <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: 'secondary.main' }}>
                  {(u.user?.name ?? '?').charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="body2" fontWeight={600}>{u.user?.name ?? 'Sistema'}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {dayjs(u.createdAt).format('DD/MM/YYYY [às] HH:mm')}
                    </Typography>
                    {u.progressPct !== null && (
                      <Chip label={`${u.progressPct}%`} size="small" sx={{ height: 18, fontSize: 10 }} />
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary">{u.note}</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
