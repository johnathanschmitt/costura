import { useState } from 'react';
import {
  Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Typography, Skeleton, TablePagination, Select, MenuItem,
  FormControl, InputLabel, Link, Tooltip,
} from '@mui/material';
import { Description } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import { useQuery } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import api from '../../services/api';
import { fmt, MOVEMENT_LABELS, qty } from './format';

export default function MovementsTab() {
  const [type, setType] = useState('');
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-movements', type, startDate?.toISOString(), endDate?.toISOString(), page, limit],
    queryFn: () => api.get('/inventory/movements', {
      params: {
        type: type || undefined,
        startDate: startDate?.startOf('day').toISOString(),
        endDate: endDate?.endOf('day').toISOString(),
        page: page + 1,
        limit,
      },
    }).then(r => r.data),
  });

  const rows = data?.data ?? [];
  const reset = () => setPage(0);

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Tipo</InputLabel>
          <Select value={type} label="Tipo" onChange={e => { setType(e.target.value); reset(); }}>
            <MenuItem value="">Todos</MenuItem>
            {Object.entries(MOVEMENT_LABELS).map(([v, { label }]) => (
              <MenuItem key={v} value={v}>{label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <DatePicker
          label="De"
          value={startDate}
          onChange={v => { setStartDate(v); reset(); }}
          slotProps={{ textField: { size: 'small' }, field: { clearable: true } }}
        />
        <DatePicker
          label="Até"
          value={endDate}
          onChange={v => { setEndDate(v); reset(); }}
          slotProps={{ textField: { size: 'small' }, field: { clearable: true } }}
        />
        <Box sx={{ flexGrow: 1 }} />
        <Box>
          <Typography variant="caption" color="text.secondary">Custo das entradas no filtro</Typography>
          <Typography variant="h6" fontWeight={700}>{fmt(data?.summary?.totalCost)}</Typography>
        </Box>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Data</TableCell>
              <TableCell>Produto</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell align="right">Quantidade</TableCell>
              <TableCell align="right">Saldo após</TableCell>
              <TableCell align="right">Custo</TableCell>
              <TableCell>Origem / Motivo</TableCell>
              <TableCell>Responsável</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
            )) : rows.map((m: any) => {
              const { label, color } = MOVEMENT_LABELS[m.type] ?? { label: m.type, color: 'default' };
              const sign = m.type === 'IN' ? '+' : m.type === 'OUT' ? '-' : '±';
              return (
                <TableRow key={m.id} hover>
                  <TableCell>{dayjs(m.occurredAt).format('DD/MM/YYYY HH:mm')}</TableCell>
                  <TableCell>
                    {m.product?.name}
                    {m.product?.sku && (
                      <Typography variant="caption" display="block" color="text.secondary">
                        {m.product.sku}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell><Chip label={label} size="small" color={color} /></TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {sign} {qty(m.quantity)} {m.product?.unit}
                  </TableCell>
                  <TableCell align="right">{qty(m.balanceAfter)} {m.product?.unit}</TableCell>
                  <TableCell align="right">{m.totalCost ? fmt(m.totalCost) : '—'}</TableCell>
                  <TableCell>
                    {m.supplier && <div>{m.supplier}</div>}
                    {m.invoiceNumber && (
                      <Typography variant="caption" color="text.secondary">NF {m.invoiceNumber}</Typography>
                    )}
                    {m.workOrder && <div>{m.workOrder.number}</div>}
                    {m.reason && <Typography variant="caption" display="block">{m.reason}</Typography>}
                    {m.attachments?.map((a: any) => (
                      <Tooltip key={a.id} title={a.originalName}>
                        <Link href={a.url} target="_blank" rel="noopener" sx={{ display: 'inline-flex', mt: 0.5 }}>
                          <Description fontSize="small" />
                        </Link>
                      </Tooltip>
                    ))}
                    {!m.supplier && !m.workOrder && !m.reason && '—'}
                  </TableCell>
                  <TableCell>{m.user?.name ?? '—'}</TableCell>
                </TableRow>
              );
            })}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="text.secondary" py={3}>
                    Nenhuma movimentação registrada no filtro selecionado
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={data?.total ?? 0}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={limit}
          onRowsPerPageChange={e => { setLimit(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50, 100]}
          labelRowsPerPage="Por página"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
        />
      </TableContainer>
    </Box>
  );
}
