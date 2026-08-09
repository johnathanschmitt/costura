import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Button, CircularProgress } from '@mui/material';
import { Print, ArrowBack } from '@mui/icons-material';
import api from '../../services/api';
import { PRINT_CSS } from '../Quotes/print.css';
import ServicePriceListDocument from './ServicePriceListDocument';

export default function ServicePriceListPrintPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ids = params.getAll('ids');

  const { data = [], isLoading: loadingServices } = useQuery({
    queryKey: ['services-print', ids],
    queryFn: () => api.get('/services').then(r => r.data),
  });

  const { data: business, isLoading: loadingBiz } = useQuery({
    queryKey: ['business-info'],
    queryFn: () => api.get('/settings/business').then(r => r.data),
  });

  const selectedServices = data.filter((s: any) => ids.includes(s.id));

  if (loadingServices || loadingBiz) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ bgcolor: 'background.paper', minHeight: '100vh' }}>
      <style>{PRINT_CSS}</style>
      <Box className="no-print" sx={{ display: 'flex', gap: 1, p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.100' }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)}>Voltar</Button>
        <Button variant="contained" startIcon={<Print />} onClick={() => window.print()}>
          Imprimir / salvar PDF
        </Button>
      </Box>

      <ServicePriceListDocument services={selectedServices} business={business} />
    </Box>
  );
}
