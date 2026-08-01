import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, Switch, FormControlLabel, Typography,
  Grid, InputAdornment, IconButton, Alert, CircularProgress,
} from '@mui/material';
import { PhoneField, EmailField } from '../../components/common/fields/MaskedFields';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

interface Props {
  open: boolean;
  onClose: () => void;
  existing?: any;
}

const EMPTY = { name: '', email: '', password: '', phone: '', roleId: '', active: true, isPartner: false };

export default function UserDialog({ open, onClose, existing }: Props) {
  const qc = useQueryClient();
  const isEdit = Boolean(existing);
  const [form, setForm] = useState(EMPTY);
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/settings/roles').then(r => r.data),
  });

  useEffect(() => {
    if (open) {
      setError('');
      setShowPwd(false);
      if (existing) {
        setForm({
          name: existing.name ?? '',
          email: existing.email ?? '',
          password: '',
          phone: existing.phone ?? '',
          roleId: existing.role?.id ?? '',
          active: existing.active ?? true,
          isPartner: existing.isPartner ?? false,
        });
      } else {
        setForm(EMPTY);
      }
    }
  }, [open, existing]);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const save = useMutation({
    mutationFn: async (): Promise<void> => {
      if (isEdit) {
        await api.patch(`/settings/users/${existing.id}`, {
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          roleId: form.roleId,
          active: form.active,
          isPartner: form.isPartner,
        });
        return;
      }
      await api.post('/settings/users', {
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        roleId: form.roleId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings-users'] });
      onClose();
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Erro ao salvar'),
  });

  const resetPwd = useMutation({
    mutationFn: () => api.patch(`/settings/users/${existing?.id}/reset-password`, { newPassword: form.password }),
    onSuccess: () => {
      setForm(f => ({ ...f, password: '' }));
      setError('');
      alert('Senha redefinida com sucesso');
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Erro'),
  });

  const valid = form.name && form.email && form.roleId && (!isEdit || true) && (isEdit || form.password.length >= 6);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12}>
            <TextField label="Nome" value={form.name} onChange={set('name')} fullWidth required />
          </Grid>
          <Grid item xs={12} sm={6}>
            <EmailField label="E-mail" value={form.email} onChange={v => set('email')({ target: { value: v } } as any)} fullWidth required />
          </Grid>
          <Grid item xs={12} sm={6}>
            <PhoneField label="Telefone" value={form.phone} onChange={v => set('phone')({ target: { value: v } } as any)} fullWidth />
          </Grid>
          <Grid item xs={12} sm={isEdit ? 8 : 12}>
            <TextField
              label={isEdit ? 'Nova senha (opcional)' : 'Senha'}
              type={showPwd ? 'text' : 'password'}
              value={form.password}
              onChange={set('password')}
              fullWidth
              required={!isEdit}
              helperText={!isEdit ? 'Mínimo 6 caracteres' : undefined}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPwd(v => !v)} edge="end">
                      {showPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          {isEdit && (
            <Grid item xs={12} sm={4} sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <Button
                variant="outlined"
                fullWidth
                disabled={form.password.length < 6 || resetPwd.isPending}
                onClick={() => resetPwd.mutate()}
              >
                {resetPwd.isPending ? <CircularProgress size={18} /> : 'Redefinir'}
              </Button>
            </Grid>
          )}
          <Grid item xs={12} sm={isEdit ? 8 : 12}>
            <TextField
              label="Perfil"
              select
              value={form.roleId}
              onChange={set('roleId')}
              fullWidth
              required
            >
              {(roles as any[]).map((r: any) => (
                <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          {isEdit && (
            <Grid item xs={12} sm={4} sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.active}
                    onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                    color="primary"
                  />
                }
                label="Ativo"
              />
            </Grid>
          )}
          <Grid item xs={12}>
            {/* Sócias participam da divisão do resultado no fim do mês. */}
            <FormControlLabel
              control={
                <Switch
                  checked={form.isPartner}
                  onChange={e => setForm(f => ({ ...f, isPartner: e.target.checked }))}
                  color="secondary"
                />
              }
              label="É sócia do ateliê"
            />
            <Typography variant="caption" color="text.secondary" display="block">
              Sócias entram na divisão do resultado mensal, em Financeiro → Divisão.
            </Typography>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={!valid || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? <CircularProgress size={18} /> : 'Salvar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
