import { useState } from 'react';
import {
  Box, Table, TableBody, TableCell, TableHead, TableRow,
  Typography, Chip, CircularProgress, Alert,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import api from '../../services/api';
import AppPagination from '../../components/common/AppPagination';

const ACTION_LABEL: Record<string, { label: string; color: any }> = {
  POST:   { label: 'Criou', color: 'success' },
  PUT:    { label: 'Editou', color: 'info' },
  PATCH:  { label: 'Atualizou', color: 'warning' },
  DELETE: { label: 'Removeu', color: 'error' },
};

export default function AuditTab() {
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-logs', page],
    queryFn: () => api.get('/settings/audit-logs', { params: { page } }).then(r => r.data),
    staleTime: 30_000,
  });

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">Erro ao carregar auditoria</Alert>;

  const logs: any[] = data?.data ?? [];

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Registro de todas as operações de criação, edição e exclusão realizadas no sistema.
      </Typography>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Data/Hora</TableCell>
            <TableCell>Usuário</TableCell>
            <TableCell>Ação</TableCell>
            <TableCell>Recurso</TableCell>
            <TableCell>ID</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {logs.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} align="center">
                <Typography variant="caption" color="text.secondary">Nenhum registro</Typography>
              </TableCell>
            </TableRow>
          )}
          {logs.map((log: any) => {
            const act = ACTION_LABEL[log.action] ?? { label: log.action, color: 'default' };
            return (
              <TableRow key={log.id} hover>
                <TableCell>
                  <Typography variant="caption">{dayjs(log.createdAt).format('DD/MM/YYYY HH:mm:ss')}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{log.user?.name ?? '—'}</Typography>
                  <Typography variant="caption" color="text.secondary">{log.user?.email ?? ''}</Typography>
                </TableCell>
                <TableCell>
                  <Chip label={act.label} color={act.color} size="small" />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{log.resource}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                    {log.resourceId?.slice(0, 12) ?? '—'}
                  </Typography>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <AppPagination
        total={data?.total ?? 0}
        page={page}
        limit={30}
        onChange={setPage}
      />
    </Box>
  );
}
