import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, TextField, Table, TableBody,
  TableCell, TableHead, TableRow, Alert, Dialog, DialogTitle, DialogContent,
  DialogActions,
} from '@mui/material';
import { QuantityField } from '../../components/common/fields/MaskedFields';
import { Add, Inventory2 } from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import api from '../../services/api';
import ProductAutocomplete, { Product } from '../../components/common/ProductAutocomplete';
import { useToast } from '../../store/toast.store';
import { apiError } from './constants';

const qty = (v: unknown) => Number(v ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

interface Props {
  workOrderId: string;
  workOrderNumber: string;
  movements: any[];
  readOnly?: boolean;
}

export default function MaterialsCard({ workOrderId, workOrderNumber, movements, readOnly }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number | null>(null);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post('/inventory/exits', {
      productId: product!.id,
      quantity,
      reason: `Consumo na ${workOrderNumber}`,
      workOrderId,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-order', workOrderId] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['low-stock'] });
      toast('Material baixado do estoque');
      setOpen(false);
      setProduct(null);
      setQuantity(null);
      setError('');
    },
    // O backend recusa baixa acima do saldo e devolve o disponível na mensagem.
    onError: (e: any) => setError(apiError(e, 'Erro ao dar baixa no material')),
  });

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography variant="subtitle1" fontWeight={600}>Materiais utilizados</Typography>
          {!readOnly && (
            <Button size="small" variant="outlined" startIcon={<Add />} onClick={() => { setError(''); setOpen(true); }}>
              Baixar material
            </Button>
          )}
        </Box>

        {movements.length === 0 ? (
          <Typography variant="body2" color="text.secondary" py={1}>
            Nenhum material baixado para esta OS.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Material</TableCell>
                <TableCell align="right">Quantidade</TableCell>
                <TableCell>Data</TableCell>
                <TableCell>Responsável</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {movements.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell>{m.product?.name}</TableCell>
                  <TableCell align="right">{qty(m.quantity)} {m.product?.unit}</TableCell>
                  <TableCell>{dayjs(m.occurredAt).format('DD/MM/YYYY')}</TableCell>
                  <TableCell>{m.user?.name ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Baixar material da {workOrderNumber}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Alert severity="info" icon={<Inventory2 />}>
            A quantidade é subtraída do estoque na hora e fica registrada no histórico do material.
          </Alert>
          <ProductAutocomplete value={product} onChange={setProduct} label="Material" required />
          <QuantityField
            label={`Quantidade${product?.unit ? ` (${product.unit})` : ''}`}
            value={quantity}
            onChange={setQuantity}
            fullWidth
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={mutation.isPending}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => mutation.mutate()}
            disabled={!product || !((quantity ?? 0) > 0) || mutation.isPending}
          >
            Dar baixa
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
