import { useState } from 'react';
import {
  Box, Typography, Button, Checkbox, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function ServicePriceListSelectionPage() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const { data = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get('/services').then(r => r.data),
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    const activeServices = (data as any[]).filter(s => s.active);
    if (selectedIds.size === activeServices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeServices.map((s: any) => s.id)));
    }
  };

  const generatePdf = () => {
    const params = new URLSearchParams();
    selectedIds.forEach(id => params.append('ids', id));
    navigate(`/catalog/services/print?${params.toString()}`);
  };

  return (
    <Box>
      <Typography variant="h5" mb={2}>Selecionar serviços para tabela de preços</Typography>
      <Button variant="contained" disabled={selectedIds.size === 0} onClick={generatePdf} sx={{ mb: 2 }}>
        Gerar Tabela de Preços (PDF)
      </Button>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedIds.size > 0 && selectedIds.size < (data as any[]).filter(s => s.active).length}
                  checked={selectedIds.size > 0 && selectedIds.size === (data as any[]).filter(s => s.active).length}
                  onChange={toggleSelectAll}
                />
              </TableCell>
              <TableCell>Serviço</TableCell>
              <TableCell align="right">Preço base</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(data as any[]).filter(s => s.active).map(s => (
              <TableRow key={s.id} hover onClick={() => toggleSelect(s.id)} sx={{ cursor: 'pointer' }}>
                <TableCell padding="checkbox">
                  <Checkbox checked={selectedIds.has(s.id)} />
                </TableCell>
                <TableCell>{s.name}</TableCell>
                <TableCell align="right">{s.basePrice}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
