import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Button, CircularProgress, Alert, Paper } from '@mui/material';
import { Print } from '@mui/icons-material';
import axios from 'axios';
import QuoteDocument from './QuoteDocument';
import { PRINT_CSS } from './print.css';

/**
 * Página que a cliente abre pelo link do WhatsApp. Não passa pelo PrivateRoute
 * nem pelo cliente axios autenticado — é acesso anônimo, só pelo token.
 */
export default function PublicQuotePage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-quote', token],
    queryFn: () => axios.get(`/api/v1/public/quotes/${token}`).then(r => r.data),
    retry: false,
  });

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}><CircularProgress /></Box>;
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: 560, mx: 'auto', p: 4 }}>
        <Alert severity="warning">
          Este orçamento não está mais disponível. Fale com o ateliê para receber um novo link.
        </Alert>
      </Box>
    );
  }

  return (
    <>
      <style>{PRINT_CSS}</style>

      <Box sx={{ bgcolor: 'grey.200', minHeight: '100vh', py: { xs: 0, sm: 3 }, '@media print': { bgcolor: '#fff', py: 0 } }}>
        <Box className="no-print" sx={{ maxWidth: '210mm', mx: 'auto', px: 2, pb: 2 }}>
          <Button variant="contained" startIcon={<Print />} onClick={() => window.print()} fullWidth size="large">
            Imprimir ou salvar em PDF
          </Button>
        </Box>

        <Paper
          elevation={3}
          sx={{
            maxWidth: '210mm', mx: 'auto', borderRadius: { xs: 0, sm: 1 },
            '@media print': { boxShadow: 'none', borderRadius: 0 },
          }}
        >
          <QuoteDocument quote={data.quote} business={data.business} variant="public" />
        </Paper>
      </Box>
    </>
  );
}
