import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Chip, Skeleton, Tooltip, LinearProgress,
  Select, MenuItem, FormControl, InputLabel, TextField, InputAdornment, Avatar,
} from '@mui/material';
import { Search, Warning, Person, LocalShipping } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../store/toast.store';
import DeliverDialog from './DeliverDialog';
import { apiError, PRIORITY_MAP, STATUS_MAP } from './constants';

/**
 * As seis colunas dividem a largura disponível em vez de terem tamanho fixo —
 * com 290px cada elas somavam ~1770px e forçavam rolagem horizontal em telas
 * comuns. A rolagem só volta abaixo de `MIN_COLUMN_WIDTH` por coluna.
 */
const MIN_COLUMN_WIDTH = 186;

function Column({
  column, onDropCard, dragging, onOpen, onDeliver,
}: {
  column: any;
  onDropCard: (id: string, status: string) => void;
  dragging: string | null;
  onOpen: (id: string) => void;
  onDeliver: (wo: any) => void;
}) {
  const [over, setOver] = useState(false);
  const { label } = STATUS_MAP[column.status] ?? { label: column.status };

  return (
    <Box
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData('text/plain');
        if (id) onDropCard(id, column.status);
      }}
      sx={{
        flex: '1 1 0',
        minWidth: MIN_COLUMN_WIDTH,
        bgcolor: over && dragging ? 'primary.50' : 'grey.100',
        border: 1,
        borderColor: over && dragging ? 'primary.main' : 'transparent',
        borderRadius: 2,
        p: 1,
        transition: 'background-color .15s, border-color .15s',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 260px)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1, pb: 1 }}>
        <Typography variant="subtitle2" fontWeight={700}>{label}</Typography>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          {column.overdueCount > 0 && (
            <Tooltip title={`${column.overdueCount} atrasada(s)`}>
              <Chip size="small" color="error" label={column.overdueCount} icon={<Warning sx={{ fontSize: '14px !important' }} />} />
            </Tooltip>
          )}
          <Chip size="small" label={column.count} />
        </Box>
      </Box>

      <Box sx={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, px: 0.5 }}>
        {column.items.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ px: 1, py: 2, textAlign: 'center' }}>
            Nenhuma OS
          </Typography>
        )}
        {column.items.map((wo: any) => {
          const priority = PRIORITY_MAP[wo.priority] ?? PRIORITY_MAP.NORMAL;
          return (
            <Card
              key={wo.id}
              draggable
              onDragStart={e => e.dataTransfer.setData('text/plain', wo.id)}
              onClick={() => onOpen(wo.id)}
              variant="outlined"
              sx={{
                cursor: 'grab',
                borderLeft: 4,
                borderLeftColor: priority.bar,
                bgcolor: wo.overdue ? 'error.50' : 'background.paper',
                '&:active': { cursor: 'grabbing' },
                '&:hover': { boxShadow: 2 },
              }}
            >
              <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 1 }}>
                  <Typography variant="caption" fontWeight={700} color="text.secondary">
                    {wo.number}
                  </Typography>
                  {wo.priority !== 'NORMAL' && wo.priority !== 'LOW' && (
                    <Chip label={priority.label} size="small" color={priority.color} sx={{ height: 18, fontSize: 10 }} />
                  )}
                </Box>

                <Typography
                  variant="body2"
                  fontWeight={600}
                  sx={{ mt: 0.25, lineHeight: 1.3, overflowWrap: 'anywhere' }}
                >
                  {wo.customer?.name}
                </Typography>
                {wo.garment?.name && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    {wo.garment.name}
                  </Typography>
                )}

                {wo.progressPct > 0 && wo.progressPct < 100 && (
                  <LinearProgress
                    variant="determinate"
                    value={wo.progressPct}
                    sx={{ mt: 1, height: 4, borderRadius: 1 }}
                  />
                )}

                {wo.updates?.[0] && (
                  <Tooltip title={`${wo.updates[0].user?.name ?? ''} · ${dayjs(wo.updates[0].createdAt).format('DD/MM HH:mm')}`}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden', mt: 0.75, fontStyle: 'italic',
                      }}
                    >
                      “{wo.updates[0].note}”
                    </Typography>
                  </Tooltip>
                )}

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1, gap: 1 }}>
                  <Tooltip title={wo.assignedTo?.name ? `Costureira: ${wo.assignedTo.name}` : 'Sem costureira'}>
                    {wo.assignedTo ? (
                      <Avatar sx={{ width: 22, height: 22, fontSize: 11, bgcolor: 'secondary.main' }}>
                        {wo.assignedTo.name.charAt(0).toUpperCase()}
                      </Avatar>
                    ) : (
                      <Person sx={{ fontSize: 18, color: 'text.disabled' }} />
                    )}
                  </Tooltip>

                  <Typography
                    variant="caption"
                    color={wo.overdue ? 'error.main' : 'text.secondary'}
                    fontWeight={wo.overdue ? 700 : 400}
                  >
                    {wo.dueDate ? dayjs(wo.dueDate).format('DD/MM') : 'sem prazo'}
                    {wo.overdue && ` · ${dayjs().diff(dayjs(wo.dueDate), 'day')}d`}
                  </Typography>
                </Box>

                {wo.status === 'DONE' && (
                  <Chip
                    icon={<LocalShipping sx={{ fontSize: '14px !important' }} />}
                    label="Registrar entrega"
                    size="small"
                    color="primary"
                    variant="outlined"
                    onClick={e => { e.stopPropagation(); onDeliver(wo); }}
                    sx={{ mt: 1, width: '100%' }}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}

export default function KanbanBoard() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);
  const [deliverTarget, setDeliverTarget] = useState<any>(null);
  const debouncedSearch = useDebounce(search, 350);

  const { data, isLoading } = useQuery({
    queryKey: ['work-orders-board', debouncedSearch, priority, assignedToId],
    queryFn: () => api.get('/work-orders/board', {
      params: {
        search: debouncedSearch || undefined,
        priority: priority || undefined,
        assignedToId: assignedToId || undefined,
      },
    }).then(r => r.data),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/settings/users').then(r => r.data),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/work-orders/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work-orders-board'] }),
    onError: (e: any) => {
      qc.invalidateQueries({ queryKey: ['work-orders-board'] });
      toast(apiError(e, 'Não foi possível mover a OS'), 'error');
    },
  });

  const handleDrop = (id: string, status: string) => {
    setDragging(null);
    const current = data?.columns
      ?.flatMap((c: any) => c.items)
      ?.find((w: any) => w.id === id);
    if (!current || current.status === status) return;

    // A entrega tem conferência de saldo — o arrasto abre o diálogo em vez de
    // mudar o status direto.
    if (status === 'DELIVERED') {
      setDeliverTarget(current);
      return;
    }
    statusMutation.mutate({ id, status });
  };

  const columns = data?.columns ?? [];

  return (
    <Box onDragStart={e => setDragging((e.target as HTMLElement).getAttribute('data-id') ?? 'x')} onDragEnd={() => setDragging(null)}>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Buscar por número ou cliente…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ minWidth: 260 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Prioridade</InputLabel>
          <Select value={priority} label="Prioridade" onChange={e => setPriority(e.target.value)}>
            <MenuItem value="">Todas</MenuItem>
            {Object.entries(PRIORITY_MAP).map(([v, { label }]) => (
              <MenuItem key={v} value={v}>{label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Costureira</InputLabel>
          <Select value={assignedToId} label="Costureira" onChange={e => setAssignedToId(e.target.value)}>
            <MenuItem value="">Todas</MenuItem>
            {(users as any[]).map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
          </Select>
        </FormControl>
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="body2" color="text.secondary">
          {data?.total ?? 0} OS no quadro · arraste os cartões para mudar o status
        </Typography>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', gap: 1 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" sx={{ flex: '1 1 0', minWidth: MIN_COLUMN_WIDTH }} height={340} />
          ))}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 2, alignItems: 'flex-start' }}>
          {columns.map((c: any) => (
            <Column
              key={c.status}
              column={c}
              dragging={dragging}
              onDropCard={handleDrop}
              onOpen={id => navigate(`/work-orders/${id}/edit`)}
              onDeliver={setDeliverTarget}
            />
          ))}
        </Box>
      )}

      <DeliverDialog
        workOrder={deliverTarget}
        onClose={() => setDeliverTarget(null)}
        onDelivered={() => qc.invalidateQueries({ queryKey: ['work-orders-board'] })}
      />
    </Box>
  );
}
