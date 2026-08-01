import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Grid, Alert, Box, Typography, Divider,
} from '@mui/material';
import MoneyField from '../../components/common/fields/MoneyField';
import { QuantityField } from '../../components/common/fields/MaskedFields';
import { UploadFile, Description } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import api from '../../services/api';
import ProductAutocomplete, { Product } from '../../components/common/ProductAutocomplete';
import { useToast } from '../../store/toast.store';
import { apiError, fmt } from './format';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function EntryDialog({ open, onClose }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number | null>(null);
  const [unitCost, setUnitCost] = useState<number | null>(null);
  const [supplier, setSupplier] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [occurredAt, setOccurredAt] = useState<Dayjs | null>(null);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setProduct(null); setQuantity(null); setUnitCost(null); setSupplier('');
      setInvoiceNumber(''); setOccurredAt(dayjs()); setNotes(''); setFile(null); setError('');
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: movement } = await api.post('/inventory/entries', {
        productId: product!.id,
        quantity,
        unitCost: unitCost ?? undefined,
        supplier: supplier || undefined,
        invoiceNumber: invoiceNumber || undefined,
        occurredAt: occurredAt?.toISOString(),
        notes: notes || undefined,
      });

      // O anexo da NF só faz sentido depois que a movimentação existe.
      if (file) {
        const form = new FormData();
        form.append('file', file);
        await api.post('/attachments/upload', form, {
          params: { entityType: 'inventoryMovement', entityId: movement.id },
        });
      }
      return movement;
    },
    onSuccess: m => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['inventory-movements'] });
      qc.invalidateQueries({ queryKey: ['low-stock'] });
      toast(`Entrada registrada — saldo de ${m.product.name}: ${Number(m.balanceAfter)} ${m.product.unit}`);
      onClose();
    },
    onError: (e: any) => setError(apiError(e, 'Erro ao registrar a entrada')),
  });

  const totalCost = quantity !== null && unitCost !== null ? quantity * unitCost : null;
  const valid = product && (quantity ?? 0) > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Entrada de Material</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}

        <ProductAutocomplete value={product} onChange={setProduct} required />

        <Grid container spacing={2}>
          <Grid item xs={6}>
            <QuantityField
              label={`Quantidade${product?.unit ? ` (${product.unit})` : ''}`}
              value={quantity}
              onChange={setQuantity}
              fullWidth required
            />
          </Grid>
          <Grid item xs={6}>
            <MoneyField
              label="Preço de custo unitário"
              value={unitCost}
              onChange={setUnitCost}
              fullWidth
            />
          </Grid>
        </Grid>

        {totalCost !== null && (
          <Box sx={{ bgcolor: 'background.default', p: 1.5, borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary">Custo total da entrada</Typography>
            <Typography variant="h6" fontWeight={700}>{fmt(totalCost)}</Typography>
          </Box>
        )}

        <Divider />

        <Grid container spacing={2}>
          <Grid item xs={6}>
            <TextField label="Fornecedor" value={supplier} onChange={e => setSupplier(e.target.value)} fullWidth />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Nota fiscal (número)" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} fullWidth />
          </Grid>
          <Grid item xs={6}>
            <DatePicker
              label="Data da entrada"
              value={occurredAt}
              onChange={setOccurredAt}
              slotProps={{ textField: { fullWidth: true, size: 'small' } }}
            />
          </Grid>
          <Grid item xs={6}>
            <Button
              component="label"
              variant="outlined"
              startIcon={file ? <Description /> : <UploadFile />}
              fullWidth
              sx={{ height: 40, textTransform: 'none', justifyContent: 'flex-start', overflow: 'hidden' }}
            >
              {file ? file.name : 'Anexar nota fiscal'}
              <input
                type="file"
                hidden
                accept="image/*,application/pdf"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
            </Button>
          </Grid>
        </Grid>

        <TextField label="Observações" value={notes} onChange={e => setNotes(e.target.value)} fullWidth multiline rows={2} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() => mutation.mutate()}
          disabled={!valid || mutation.isPending}
        >
          Registrar Entrada
        </Button>
      </DialogActions>
    </Dialog>
  );
}
