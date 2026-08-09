import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Button, CircularProgress, Paper } from '@mui/material';
import { Print, ArrowBack } from '@mui/icons-material';
import api from '../../services/api';
import QuoteDocument from './QuoteDocument';
import { PRINT_CSS } from './print.css';

export default function QuotePrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: quote, isLoading: loadingQuote } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => api.get(`/quotes/${id}`).then(r => r.data),
  });

  const { data: biz, isLoading: loadingBiz } = useQuery({
    queryKey: ['business-info'],
    queryFn: () => api.get('/settings/business').then(r => r.data),
  });

  if (loadingQuote || loadingBiz) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>;
  }
  if (!quote) return null;

  return (
    <>
      <style>{PRINT_CSS}</style>

      <Box className="no-print" sx={{ p: 2, display: 'flex', gap: 1, bgcolor: 'grey.100', borderBottom: 1, borderColor: 'divider' }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(`/quotes/${id}/edit`)}>Voltar</Button>
        <Button variant="contained" startIcon={<Print />} onClick={() => window.print()}>Imprimir / Salvar PDF</Button>
      </Box>

      {/* Fora da impressão, a folha aparece sobre um fundo cinza, como um preview. */}
      <Box sx={{ bgcolor: 'grey.200', py: { xs: 0, sm: 4 }, minHeight: '100vh', '@media print': { bgcolor: '#fff', py: 0 } }}>
        <Paper
          elevation={3}
          sx={{
            maxWidth: '210mm', mx: 'auto', borderRadius: { xs: 0, sm: 1 },
            '@media print': { boxShadow: 'none', borderRadius: 0 },
          }}
        >
          <QuoteDocument quote={quote} business={biz} variant="internal" />
        </Paper>
      </Box>
    </>
  );
}
