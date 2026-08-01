import { useState } from 'react';
import {
  Box, Button, Table, TableBody, TableCell, TableHead, TableRow,
  Chip, IconButton, Tooltip, Typography, CircularProgress, Alert,
  Avatar,
} from '@mui/material';
import { Add, Edit, Delete, LockReset } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import api from '../../services/api';
import { useAuthStore } from '../../store/auth.store';
import UserDialog from './UserDialog';
import ConfirmDialog from '../../components/common/ConfirmDialog';

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

export default function UsersTab() {
  const qc = useQueryClient();
  const currentUser = useAuthStore(s => s.user);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['settings-users'],
    queryFn: () => api.get('/settings/users').then(r => r.data),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/settings/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings-users'] });
      setDeleteTarget(null);
    },
  });

  const openCreate = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (u: any) => { setEditing(u); setDialogOpen(true); };

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">Erro ao carregar usuários</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
          Novo usuário
        </Button>
      </Box>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Usuário</TableCell>
            <TableCell>E-mail</TableCell>
            <TableCell>Perfil</TableCell>
            <TableCell>Sócia</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Criado em</TableCell>
            <TableCell align="right">Ações</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(users as any[]).map(u => {
            const isMe = u.id === currentUser?.id;
            return (
              <TableRow key={u.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar sx={{ width: 32, height: 32, fontSize: 13, bgcolor: 'primary.main' }}>
                      {initials(u.name)}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>{u.name}</Typography>
                      {u.phone && <Typography variant="caption" color="text.secondary">{u.phone}</Typography>}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{u.email}</Typography>
                </TableCell>
                <TableCell>
                  <Chip label={u.role?.name} size="small" variant="outlined" color="primary" />
                </TableCell>
                <TableCell>
                  {u.isPartner
                    ? <Chip label="Sócia" size="small" color="secondary" />
                    : <Typography variant="caption" color="text.disabled">—</Typography>}
                </TableCell>
                <TableCell>
                  <Chip
                    label={u.active ? 'Ativo' : 'Inativo'}
                    size="small"
                    color={u.active ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {dayjs(u.createdAt).format('DD/MM/YYYY')}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Editar">
                    <IconButton size="small" onClick={() => openEdit(u)}>
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {!isMe && (
                    <Tooltip title="Excluir">
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(u)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <UserDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        existing={editing}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir usuário"
        message={`Deseja excluir o usuário "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
        confirmColor="error"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => remove.mutate(deleteTarget.id)}
      />
    </Box>
  );
}
