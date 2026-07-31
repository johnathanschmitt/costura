import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Skeleton, LinearProgress, Tooltip,
} from '@mui/material';
import { Warning } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';

export default function InventoryPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get('/inventory').then(r => r.data),
  });

  return (
    <Box>
      <Typography variant="h5" mb={2}>Estoque</Typography>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Produto</TableCell>
              <TableCell>SKU</TableCell>
              <TableCell align="center">Qtd</TableCell>
              <TableCell align="center">Mínimo</TableCell>
              <TableCell>Nível</TableCell>
              <TableCell>Localização</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>{[1,2,3,4,5,6].map(j => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
            )) : data.map((inv: any) => {
              const qty = Number(inv.quantity);
              const min = Number(inv.minQuantity);
              const pct = min > 0 ? Math.min((qty / (min * 2)) * 100, 100) : 100;
              const low = qty <= min;
              return (
                <TableRow key={inv.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {low && <Tooltip title="Estoque baixo"><Warning color="warning" fontSize="small" /></Tooltip>}
                      {inv.product?.name}
                    </Box>
                  </TableCell>
                  <TableCell>{inv.product?.sku ?? '—'}</TableCell>
                  <TableCell align="center">
                    <Chip label={qty} size="small" color={low ? 'error' : 'default'} />
                  </TableCell>
                  <TableCell align="center">{min}</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      color={low ? 'error' : pct < 50 ? 'warning' : 'success'}
                      sx={{ borderRadius: 1 }}
                    />
                  </TableCell>
                  <TableCell>{inv.location ?? '—'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
