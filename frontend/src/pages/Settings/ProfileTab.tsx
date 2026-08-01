import { useState } from 'react';
import {
  Box, Grid, TextField, Button, Typography, Divider,
  Alert, CircularProgress, Avatar, Paper, InputAdornment, IconButton,
} from '@mui/material';
import { PhoneField } from '../../components/common/fields/MaskedFields';
import { Visibility, VisibilityOff, Save } from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import api from '../../services/api';
import { useAuthStore } from '../../store/auth.store';

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

export default function ProfileTab() {
  const { user, setAuth, token } = useAuthStore();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');

  const saveProfile = useMutation({
    mutationFn: () => api.patch('/settings/profile', { name: name.trim(), phone: phone.trim() || undefined }),
    onSuccess: (res) => {
      setProfileErr('');
      setProfileMsg('Perfil atualizado com sucesso');
      if (token) setAuth(token, { ...user!, name: res.data.name });
      setTimeout(() => setProfileMsg(''), 3000);
    },
    onError: (e: any) => setProfileErr(e.response?.data?.message ?? 'Erro ao atualizar'),
  });

  const changePwd = useMutation({
    mutationFn: () => api.patch('/auth/change-password', { currentPassword: currentPwd, newPassword: newPwd }),
    onSuccess: () => {
      setPwdErr('');
      setPwdMsg('Senha alterada com sucesso');
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      setTimeout(() => setPwdMsg(''), 3000);
    },
    onError: (e: any) => setPwdErr(e.response?.data?.message ?? 'Erro ao alterar senha'),
  });

  const pwdValid = currentPwd && newPwd.length >= 6 && newPwd === confirmPwd;

  return (
    <Box sx={{ maxWidth: 560 }}>
      {/* Avatar + info */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Avatar sx={{ width: 64, height: 64, fontSize: 24, bgcolor: 'primary.main' }}>
          {initials(user?.name ?? '?')}
        </Avatar>
        <Box>
          <Typography variant="h6" fontWeight={600}>{user?.name}</Typography>
          <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
          <Typography variant="caption" color="text.secondary">Perfil: {user?.role}</Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Dados pessoais */}
      <Typography variant="subtitle1" fontWeight={600} mb={2}>Dados pessoais</Typography>
      {profileErr && <Alert severity="error" sx={{ mb: 2 }}>{profileErr}</Alert>}
      {profileMsg && <Alert severity="success" sx={{ mb: 2 }}>{profileMsg}</Alert>}
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField label="Nome completo" value={name} onChange={e => setName(e.target.value)} fullWidth required />
        </Grid>
        <Grid item xs={12}>
          <PhoneField label="Telefone" value={phone} onChange={setPhone} fullWidth />
        </Grid>
        <Grid item xs={12}>
          <Button
            variant="contained"
            startIcon={saveProfile.isPending ? <CircularProgress size={16} /> : <Save />}
            disabled={!name.trim() || saveProfile.isPending}
            onClick={() => saveProfile.mutate()}
          >
            Salvar perfil
          </Button>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Alterar senha */}
      <Typography variant="subtitle1" fontWeight={600} mb={2}>Alterar senha</Typography>
      {pwdErr && <Alert severity="error" sx={{ mb: 2 }}>{pwdErr}</Alert>}
      {pwdMsg && <Alert severity="success" sx={{ mb: 2 }}>{pwdMsg}</Alert>}
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            label="Senha atual"
            type={showPwd ? 'text' : 'password'}
            value={currentPwd}
            onChange={e => setCurrentPwd(e.target.value)}
            fullWidth
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
        <Grid item xs={12} sm={6}>
          <TextField
            label="Nova senha"
            type={showPwd ? 'text' : 'password'}
            value={newPwd}
            onChange={e => setNewPwd(e.target.value)}
            fullWidth
            helperText="Mínimo 6 caracteres"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Confirmar nova senha"
            type={showPwd ? 'text' : 'password'}
            value={confirmPwd}
            onChange={e => setConfirmPwd(e.target.value)}
            fullWidth
            error={confirmPwd.length > 0 && confirmPwd !== newPwd}
            helperText={confirmPwd.length > 0 && confirmPwd !== newPwd ? 'As senhas não conferem' : undefined}
          />
        </Grid>
        <Grid item xs={12}>
          <Button
            variant="contained"
            color="warning"
            disabled={!pwdValid || changePwd.isPending}
            onClick={() => changePwd.mutate()}
          >
            {changePwd.isPending ? <CircularProgress size={18} /> : 'Alterar senha'}
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
}
