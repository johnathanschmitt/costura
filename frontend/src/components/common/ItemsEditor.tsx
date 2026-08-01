import { useState } from 'react';
import {
  Box, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  IconButton, Button, Select, MenuItem, FormControl, Autocomplete,
  Typography, Divider,
} from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';

export interface LineItem {
  id?: string;
  type: 'SERVICE' | 'PRODUCT' | 'CUSTOM';
  serviceId?: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  /** Desconto em reais aplicado sobre a linha. */
  discount?: number;
  total: number;
}

interface Props {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  readOnly?: boolean;
}

export default function ItemsEditor({ items, onChange, readOnly }: Props) {
  const { data: services = [] } = useQuery({
    queryKey: ['services-list'],
    queryFn: () => api.get('/services').then(r => r.data),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => api.get('/products').then(r => r.data),
  });

  const addItem = () => {
    onChange([...items, { type: 'SERVICE', description: '', quantity: 1, unitPrice: 0, discount: 0, total: 0 }]);
  };

  const updateItem = (index: number, patch: Partial<LineItem>) => {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      const next = { ...item, ...patch };
      const gross = next.quantity * next.unitPrice;
      // O desconto nunca pode passar do valor bruto da linha — o backend
      // recusaria, então limitamos aqui para o total exibido bater com o salvo.
      next.discount = Math.min(Math.max(next.discount ?? 0, 0), gross);
      next.total = gross - next.discount;
      return next;
    });
    onChange(updated);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const selectService = (index: number, svc: any | null) => {
    updateItem(index, {
      serviceId: svc?.id,
      productId: undefined,
      description: svc?.name ?? '',
      unitPrice: svc ? parseFloat(svc.basePrice) : 0,
    });
  };

  const selectProduct = (index: number, prd: any | null) => {
    updateItem(index, {
      productId: prd?.id,
      serviceId: undefined,
      description: prd?.name ?? '',
      unitPrice: prd ? parseFloat(prd.salePrice ?? 0) : 0,
    });
  };

  const total = items.reduce((s, i) => s + i.total, 0);
  const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

  return (
    <Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell width={120}>Tipo</TableCell>
            <TableCell>Descrição / Item</TableCell>
            <TableCell width={90} align="center">Qtd</TableCell>
            <TableCell width={120} align="right">Preço unit.</TableCell>
            <TableCell width={110} align="right">Desconto</TableCell>
            <TableCell width={120} align="right">Total</TableCell>
            {!readOnly && <TableCell width={48} />}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item, i) => (
            <TableRow key={i}>
              <TableCell>
                <FormControl size="small" fullWidth>
                  <Select
                    value={item.type}
                    onChange={e => updateItem(i, { type: e.target.value as any, serviceId: undefined, productId: undefined, description: '' })}
                    disabled={readOnly}
                  >
                    <MenuItem value="SERVICE">Serviço</MenuItem>
                    <MenuItem value="PRODUCT">Produto</MenuItem>
                    <MenuItem value="CUSTOM">Personalizado</MenuItem>
                  </Select>
                </FormControl>
              </TableCell>

              <TableCell>
                {item.type === 'SERVICE' ? (
                  <Autocomplete
                    size="small"
                    options={services as any[]}
                    getOptionLabel={(o: any) => o.name}
                    value={services.find((s: any) => s.id === item.serviceId) ?? null}
                    onChange={(_, v) => selectService(i, v)}
                    disabled={readOnly}
                    renderInput={p => <TextField {...p} placeholder="Selecione o serviço…" />}
                  />
                ) : item.type === 'PRODUCT' ? (
                  <Autocomplete
                    size="small"
                    options={products as any[]}
                    getOptionLabel={(o: any) => o.name}
                    value={products.find((p: any) => p.id === item.productId) ?? null}
                    onChange={(_, v) => selectProduct(i, v)}
                    disabled={readOnly}
                    renderInput={p => <TextField {...p} placeholder="Selecione o produto…" />}
                  />
                ) : (
                  <TextField
                    size="small"
                    fullWidth
                    value={item.description}
                    onChange={e => updateItem(i, { description: e.target.value })}
                    placeholder="Descrição do item…"
                    disabled={readOnly}
                  />
                )}
              </TableCell>

              <TableCell align="center">
                <TextField
                  size="small"
                  type="number"
                  value={item.quantity}
                  onChange={e => updateItem(i, { quantity: parseFloat(e.target.value) || 1 })}
                  inputProps={{ min: 0.1, step: 1, style: { textAlign: 'center' } }}
                  disabled={readOnly}
                  sx={{ width: 70 }}
                />
              </TableCell>

              <TableCell align="right">
                <TextField
                  size="small"
                  type="number"
                  value={item.unitPrice}
                  onChange={e => updateItem(i, { unitPrice: parseFloat(e.target.value) || 0 })}
                  inputProps={{ min: 0, step: 0.01, style: { textAlign: 'right' } }}
                  disabled={readOnly}
                  sx={{ width: 100 }}
                />
              </TableCell>

              <TableCell align="right">
                <TextField
                  size="small"
                  type="number"
                  value={item.discount ?? 0}
                  onChange={e => updateItem(i, { discount: parseFloat(e.target.value) || 0 })}
                  inputProps={{ min: 0, step: 0.01, style: { textAlign: 'right' } }}
                  disabled={readOnly}
                  sx={{ width: 90 }}
                />
              </TableCell>

              <TableCell align="right">
                <Typography variant="body2" fontWeight={500}>{fmt(item.total)}</Typography>
                {(item.discount ?? 0) > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                    {fmt(item.quantity * item.unitPrice)}
                  </Typography>
                )}
              </TableCell>

              {!readOnly && (
                <TableCell>
                  <IconButton size="small" color="error" onClick={() => removeItem(i)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </TableCell>
              )}
            </TableRow>
          ))}

          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} align="center">
                <Typography variant="body2" color="text.secondary" py={2}>
                  Nenhum item adicionado
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 1.5, px: 1 }}>
        {!readOnly && (
          <Button size="small" startIcon={<Add />} onClick={addItem} variant="outlined">
            Adicionar item
          </Button>
        )}
        <Box sx={{ ml: 'auto', textAlign: 'right' }}>
          <Typography variant="body2" color="text.secondary">Total</Typography>
          <Typography variant="h6" fontWeight={700} color="primary">{fmt(total)}</Typography>
        </Box>
      </Box>
    </Box>
  );
}
