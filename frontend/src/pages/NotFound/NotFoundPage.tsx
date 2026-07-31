import { Box, Typography, Button } from '@mui/material';
import { SearchOff } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', textAlign: 'center', p: 3 }}>
      <Box>
        <SearchOff sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h4" fontWeight={700} mb={1}>404</Typography>
        <Typography variant="h6" color="text.secondary" mb={1}>Página não encontrada</Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          O endereço que você acessou não existe ou foi movido.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/dashboard')}>Ir ao Dashboard</Button>
      </Box>
    </Box>
  );
}
