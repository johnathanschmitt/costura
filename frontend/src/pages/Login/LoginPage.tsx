import { useState } from 'react';
import { Box, Card, CardContent, TextField, Button, Typography, Alert, InputAdornment, IconButton } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuthStore } from '../../store/auth.store';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    // O try cobre só a chamada: antes ele envolvia também a gravação da sessão
    // e a navegação, então qualquer falha depois do login virava "senha
    // inválida" — e a pessoa ficava presa aqui sem entender por quê.
    let data;
    try {
      ({ data } = await api.post('/auth/login', { email, password }));
    } catch (e: any) {
      const status = e?.response?.status;
      setError(
        status === 401 || status === 400
          ? 'E-mail ou senha inválidos'
          : status
            ? `Não foi possível entrar (erro ${status}). Tente novamente.`
            : 'Não foi possível falar com o servidor. Verifique se o sistema está no ar.',
      );
      setLoading(false);
      return;
    }

    setAuth(data.access_token, data.user);
    setLoading(false);
    navigate('/dashboard');
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'primary.main' }}>
      <Card sx={{ width: 380, mx: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h5" color="primary" fontWeight={700}>Ateliê de Costura</Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>Entre com suas credenciais</Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="E-mail"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              fullWidth
              autoFocus
            />
            <TextField
              label="Senha"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPass(s => !s)} edge="end">
                      {showPass ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button type="submit" variant="contained" size="large" fullWidth disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
