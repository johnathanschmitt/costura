import { useState, useRef, useEffect } from 'react';
import {
  Box, InputBase, Paper, List, ListItem, ListItemText,
  ListItemIcon, Typography, Divider, CircularProgress, useMediaQuery, useTheme,
} from '@mui/material';
import {
  Search, People, RequestQuote, Assignment, MiscellaneousServices, AttachMoney,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useDebounce } from '../../hooks/useDebounce';
import api from '../../services/api';

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho', SENT: 'Enviado', APPROVED: 'Aprovado',
  PENDING: 'Pendente', IN_PROGRESS: 'Em Andamento', DONE: 'Concluída', DELIVERED: 'Entregue',
};

export default function SearchBar() {
  const theme = useTheme();
  // Em tela estreita o texto longo do campo não cabe junto dos botões.
  const compact = useMediaQuery(theme.breakpoints.down('sm'));
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const debouncedQ = useDebounce(q, 300);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  const { data, isFetching } = useQuery({
    queryKey: ['global-search', debouncedQ],
    queryFn: () => api.get('/search', { params: { q: debouncedQ } }).then(r => r.data),
    enabled: debouncedQ.length >= 2,
    staleTime: 10_000,
  });

  const total = data
    ? (data.customers?.length ?? 0) + (data.quotes?.length ?? 0) +
      (data.workOrders?.length ?? 0) + (data.services?.length ?? 0) +
      (data.receivables?.length ?? 0)
    : 0;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const go = (path: string) => { navigate(path); setQ(''); setOpen(false); };

  return (
    <Box ref={ref} sx={{ flexGrow: 1, mx: { xs: 0.5, sm: 2 }, minWidth: 0, position: 'relative' }}>
      <Box sx={{
        display: 'flex', alignItems: 'center',
        bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2,
        px: { xs: 1, sm: 1.5 }, py: 0.5,
      }}>
        <Search sx={{ mr: 1, opacity: 0.8, fontSize: 20 }} />
        <InputBase
          placeholder={compact ? 'Buscar…' : 'Buscar clientes, OS, orçamentos…'}
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); (e.target as HTMLInputElement).blur(); } }}
          sx={{ color: 'inherit', fontSize: 14, width: '100%' }}
        />
        {isFetching && <CircularProgress size={16} sx={{ color: 'rgba(255,255,255,0.7)' }} />}
      </Box>

      {open && debouncedQ.length >= 2 && (
        <Paper
          elevation={8}
          sx={{ position: 'absolute', top: '100%', left: 0, right: 0, mt: 0.5, zIndex: 9999, maxHeight: 420, overflow: 'auto' }}
        >
          {total === 0 && !isFetching && (
            <Box sx={{ px: 2, py: 2 }}>
              <Typography variant="body2" color="text.secondary">Nenhum resultado para "{debouncedQ}"</Typography>
            </Box>
          )}

          {data?.customers?.length > 0 && (
            <>
              <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" letterSpacing={0.5}>
                  Clientes
                </Typography>
              </Box>
              <List dense disablePadding>
                {data.customers.map((c: any) => (
                  <ListItem key={c.id} button onClick={() => go(`/customers/${c.id}/edit`)} sx={{ px: 2 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}><People fontSize="small" color="primary" /></ListItemIcon>
                    <ListItemText primary={c.name} secondary={c.phone} primaryTypographyProps={{ variant: 'body2' }} secondaryTypographyProps={{ variant: 'caption' }} />
                  </ListItem>
                ))}
              </List>
            </>
          )}

          {data?.quotes?.length > 0 && (
            <>
              <Divider />
              <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" letterSpacing={0.5}>
                  Orçamentos
                </Typography>
              </Box>
              <List dense disablePadding>
                {data.quotes.map((q: any) => (
                  <ListItem key={q.id} button onClick={() => go(`/quotes/${q.id}/edit`)} sx={{ px: 2 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}><RequestQuote fontSize="small" color="secondary" /></ListItemIcon>
                    <ListItemText primary={`${q.number} — ${q.customer?.name}`} secondary={STATUS_LABEL[q.status] ?? q.status} primaryTypographyProps={{ variant: 'body2' }} secondaryTypographyProps={{ variant: 'caption' }} />
                  </ListItem>
                ))}
              </List>
            </>
          )}

          {data?.workOrders?.length > 0 && (
            <>
              <Divider />
              <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" letterSpacing={0.5}>
                  Ordens de Serviço
                </Typography>
              </Box>
              <List dense disablePadding>
                {data.workOrders.map((wo: any) => (
                  <ListItem key={wo.id} button onClick={() => go(`/work-orders/${wo.id}/edit`)} sx={{ px: 2 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}><Assignment fontSize="small" color="action" /></ListItemIcon>
                    <ListItemText primary={`${wo.number} — ${wo.customer?.name}`} secondary={STATUS_LABEL[wo.status] ?? wo.status} primaryTypographyProps={{ variant: 'body2' }} secondaryTypographyProps={{ variant: 'caption' }} />
                  </ListItem>
                ))}
              </List>
            </>
          )}

          {/* "Quanto a Maria me deve" tem resposta aqui, sem passar pelo
              financeiro: a busca já é o caminho mais curto do sistema. */}
          {data?.receivables?.length > 0 && (
            <>
              <Divider />
              <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" letterSpacing={0.5}>
                  Contas em aberto
                </Typography>
              </Box>
              <List dense disablePadding>
                {data.receivables.map((r: any) => {
                  const saldo = Number(r.amount ?? 0) - Number(r.paidAmount ?? 0);
                  const dias = dayjs().diff(dayjs(r.dueDate), 'day');
                  return (
                    <ListItem key={r.id} button onClick={() => go('/financial/contas-do-mes')} sx={{ px: 2 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <AttachMoney fontSize="small" color={r.status === 'OVERDUE' ? 'error' : 'success'} />
                      </ListItemIcon>
                      <ListItemText
                        primary={`${r.customer?.name ?? 'Sem cliente'} — ${brl(saldo)}`}
                        secondary={
                          r.status === 'OVERDUE'
                            ? `${r.description} · venceu há ${dias} dia(s)`
                            : `${r.description} · vence ${dayjs(r.dueDate).format('DD/MM')}`
                        }
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{
                          variant: 'caption',
                          color: r.status === 'OVERDUE' ? 'error.main' : 'text.secondary',
                        }}
                      />
                    </ListItem>
                  );
                })}
              </List>
            </>
          )}

          {data?.services?.length > 0 && (
            <>
              <Divider />
              <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" letterSpacing={0.5}>
                  Serviços
                </Typography>
              </Box>
              <List dense disablePadding>
                {data.services.map((s: any) => (
                  <ListItem key={s.id} button onClick={() => go(`/catalog/services/${s.id}/edit`)} sx={{ px: 2 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}><MiscellaneousServices fontSize="small" color="action" /></ListItemIcon>
                    <ListItemText primary={s.name} primaryTypographyProps={{ variant: 'body2' }} />
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </Paper>
      )}
    </Box>
  );
}
