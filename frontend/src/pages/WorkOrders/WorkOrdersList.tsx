import { useState } from 'react';
import {
  Box, TextField, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, IconButton, Chip, InputAdornment, Skeleton, Select,
  MenuItem, FormControl, InputLabel, TablePagination, Tooltip, Typography, Avatar,
} from '@mui/material';
import {
  Search, Edit, Delete, PlayArrow, Done, LocalShipping, Receipt, Block,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../store/toast.store';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import DeliverDialog from './DeliverDialog';
import CancelDialog from './CancelDialog';
import { apiError, PRIORITY_MAP, STATUS_MAP } from './constants';

export default function WorkOrdersList() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [deliverTarget, setDeliverTarget] = useState<any>(null);
  const debouncedSearch = useDebounce(search, 400);
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['work-orders', debouncedSearch, status, page, limit],
    queryFn: () => api.get('/work-orders', {
      params: {
        search: debouncedSearch || undefined,
        status: status || undefined,
        page: page + 1,
        limit,
      },
    }).then(r => r.data),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['work-orders'] });
    qc.invalidateQueries({ queryKey: ['work-orders-board'] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/work-orders/${id}/status`, { status }),
    onSuccess: refresh,
    onError: (e: any) => toast(apiError(e, 'Não foi possível mudar o status'), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/work-orders/${id}`),
    onSuccess: () => { refresh(); setDeleteTarget(null); toast('OS removida', 'info'); },
    onError: (e: any) => { setDeleteTarget(null); toast(apiError(e, 'Não foi possível remover'), 'error'); },
  });

  const rows = data?.data ?? [];

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          size="small"
          placeholder="Buscar por número ou cliente…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          sx={{ flex: 1 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Status</InputLabel>
          <Select value={status} label="Status" onChange={e => { setStatus(e.target.value); setPage(0); }}>
            <MenuItem value="">Todos</MenuItem>
            {Object.entries(STATUS_MAP).map(([v, { label }]) => (
              <MenuItem key={v} value={v}>{label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Número</TableCell>
              <TableCell>Cliente</TableCell>
              <TableCell>Peça</TableCell>
              <TableCell>Costureira</TableCell>
              <TableCell>Prioridade</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Prazo</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
            )) : rows.map((wo: any) => {
              const s = STATUS_MAP[wo.status] ?? { label: wo.status, color: 'default' };
              const p = PRIORITY_MAP[wo.priority] ?? PRIORITY_MAP.NORMAL;
              const overdue = wo.dueDate && dayjs(wo.dueDate).isBefore(dayjs(), 'day')
                && wo.status !== 'DELIVERED' && wo.status !== 'CANCELLED';
              return (
                /* Clicar em qualquer lugar da linha abre o registro — é o que se
                     tenta primeiro numa lista, e no celular poupa mirar num
                     ícone de 20px. A coluna de ações para o clique, para não
                     navegar junto com o botão. */
                <TableRow
                  key={wo.id}
                  hover
                  sx={{ bgcolor: overdue ? 'error.50' : undefined, cursor: 'pointer' }}
                  onClick={() => navigate(`/work-orders/${wo.id}/edit`)}
                >
                  <TableCell>{wo.number}</TableCell>
                  <TableCell>{wo.customer?.name}</TableCell>
                  <TableCell>{wo.garment?.name ?? '—'}</TableCell>
                  <TableCell>
                    {wo.assignedTo ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Avatar sx={{ width: 22, height: 22, fontSize: 11, bgcolor: 'secondary.main' }}>
                          {wo.assignedTo.name.charAt(0).toUpperCase()}
                        </Avatar>
                        {wo.assignedTo.name}
                      </Box>
                    ) : '—'}
                  </TableCell>
                  <TableCell><Chip label={p.label} size="small" color={p.color} /></TableCell>
                  <TableCell><Chip label={s.label} color={s.color} size="small" /></TableCell>
                  <TableCell sx={{ color: overdue ? 'error.main' : undefined, fontWeight: overdue ? 600 : undefined }}>
                    {wo.dueDate ? dayjs(wo.dueDate).format('DD/MM/YYYY') : '—'}
                  </TableCell>
                  <TableCell align="right" onClick={e => e.stopPropagation()}>
                    {wo.status === 'PENDING' && (
                      <Tooltip title="Iniciar produção">
                        <IconButton size="small" color="info" onClick={() => statusMutation.mutate({ id: wo.id, status: 'IN_PROGRESS' })}>
                          <PlayArrow fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {wo.status === 'IN_PROGRESS' && (
                      <Tooltip title="Marcar como pronta">
                        <IconButton size="small" color="success" onClick={() => statusMutation.mutate({ id: wo.id, status: 'DONE' })}>
                          <Done fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {wo.status === 'DONE' && (
                      <Tooltip title="Registrar entrega">
                        <IconButton size="small" color="primary" onClick={() => setDeliverTarget(wo)}>
                          <LocalShipping fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {wo.status === 'DELIVERED' && (
                      <Tooltip title="Recibo de entrega">
                        <IconButton size="small" onClick={() => navigate(`/work-orders/${wo.id}/receipt`)}>
                          <Receipt fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => navigate(`/work-orders/${wo.id}/edit`)}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {/* Desistência da cliente é cancelamento, não remoção: a OS
                        continua no histórico, com o motivo e o acerto do que já
                        foi pago. */}
                    {wo.status !== 'DELIVERED' && wo.status !== 'CANCELLED' && (
                      <Tooltip title="Cliente desistiu — cancelar OS">
                        <IconButton size="small" color="warning" onClick={() => setCancelTarget(wo)}>
                          <Block fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Remover">
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(wo)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="text.secondary" py={3}>Nenhuma OS encontrada</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={data?.total ?? 0}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={limit}
          onRowsPerPageChange={e => { setLimit(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50, 100]}
          labelRowsPerPage="Por página"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
        />
      </TableContainer>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        title="Remover OS"
        message={`Remover a ${deleteTarget?.number ?? ''}? Ela deixa de aparecer nas listagens.`}
        confirmLabel="Remover"
        confirmColor="error"
        loading={deleteMutation.isPending}
      />

      <DeliverDialog workOrder={deliverTarget} onClose={() => setDeliverTarget(null)} onDelivered={refresh} />

      <CancelDialog workOrder={cancelTarget} onClose={() => setCancelTarget(null)} onCancelled={refresh} />
    </Box>
  );
}
