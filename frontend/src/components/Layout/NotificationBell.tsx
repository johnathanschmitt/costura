import { useState } from 'react';
import {
  IconButton, Badge, Popover, Box, Typography, List, ListItem,
  ListItemText, ListItemIcon, Chip, Divider, CircularProgress,
  Button,
} from '@mui/material';
import {
  Notifications, Assignment, AccountBalance, TrendingDown,
  Warning, MoneyOff, CheckCircle,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/pt-br';
import api from '../../services/api';

dayjs.extend(relativeTime);
dayjs.locale('pt-br');

const fmt = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

function Section({ icon, title, color, children }: {
  icon: React.ReactNode; title: string; color: string; children: React.ReactNode;
}) {
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, bgcolor: `${color}14` }}>
        <Box sx={{ color, display: 'flex' }}>{icon}</Box>
        <Typography variant="caption" fontWeight={700} color={color} textTransform="uppercase" letterSpacing={0.5}>
          {title}
        </Typography>
      </Box>
      {children}
    </Box>
  );
}

export default function NotificationBell() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/reports/notifications').then(r => r.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const total: number = data?.total ?? 0;

  const go = (path: string) => {
    navigate(path);
    setAnchor(null);
  };

  return (
    <>
      <IconButton color="inherit" onClick={e => setAnchor(e.currentTarget)}>
        <Badge badgeContent={total || null} color="error" max={99}>
          <Notifications />
        </Badge>
      </IconButton>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 380, maxHeight: 520, overflow: 'hidden', display: 'flex', flexDirection: 'column' } }}
      >
        {/* Cabeçalho */}
        <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
          <Typography variant="subtitle1" fontWeight={700}>Alertas</Typography>
          {total > 0 && (
            <Typography variant="caption" color="text.secondary">{total} item(s) precisam de atenção</Typography>
          )}
        </Box>

        <Box sx={{ overflowY: 'auto', flexGrow: 1 }}>
          {isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          )}

          {!isLoading && total === 0 && (
            <Box sx={{ textAlign: 'center', py: 5 }}>
              <CheckCircle sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">Tudo em dia!</Typography>
            </Box>
          )}

          {/* OS vencidas */}
          {data?.overdueWorkOrders?.length > 0 && (
            <>
              <Section icon={<Assignment fontSize="small" />} title="OS vencidas" color="#e34948">
                <List dense disablePadding>
                  {data.overdueWorkOrders.map((wo: any) => (
                    <ListItem
                      key={wo.id}
                      button
                      onClick={() => go(`/work-orders/${wo.id}/edit`)}
                      sx={{ px: 2, '&:hover': { bgcolor: 'action.hover' } }}
                    >
                      <ListItemText
                        primary={`${wo.number} — ${wo.customer?.name}`}
                        secondary={`Venceu ${dayjs(wo.dueDate).fromNow()}`}
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                        secondaryTypographyProps={{ variant: 'caption', color: 'error.main' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Section>
              <Divider />
            </>
          )}

          {/* Caixa aberto */}
          {data?.openCashRegister && (
            <>
              <Section icon={<AccountBalance fontSize="small" />} title="Caixa aberto" color="#eda100">
                <ListItem
                  button
                  onClick={() => go('/financial/caixa')}
                  sx={{ px: 2, '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <ListItemText
                    primary="Caixa não foi fechado"
                    secondary={`Aberto ${dayjs(data.openCashRegister.openedAt).fromNow()}`}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItem>
              </Section>
              <Divider />
            </>
          )}

          {/* Recebimentos vencidos */}
          {data?.overdueReceivables?.length > 0 && (
            <>
              <Section icon={<TrendingDown fontSize="small" />} title="A receber vencidos" color="#eb6834">
                <List dense disablePadding>
                  {data.overdueReceivables.map((r: any) => (
                    <ListItem
                      key={r.id}
                      button
                      onClick={() => go('/financial/contas-do-mes')}
                      sx={{ px: 2, '&:hover': { bgcolor: 'action.hover' } }}
                    >
                      <ListItemText
                        primary={r.description}
                        secondary={`${r.customer?.name ?? ''} · ${fmt(r.amount)} · venceu ${dayjs(r.dueDate).fromNow()}`}
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Section>
              <Divider />
            </>
          )}

          {/* Pagamentos vencidos */}
          {data?.overduePayables?.length > 0 && (
            <>
              <Section icon={<MoneyOff fontSize="small" />} title="A pagar vencidos" color="#e34948">
                <List dense disablePadding>
                  {data.overduePayables.map((p: any) => (
                    <ListItem
                      key={p.id}
                      button
                      onClick={() => go('/financial/contas-do-mes?lado=pagar')}
                      sx={{ px: 2, '&:hover': { bgcolor: 'action.hover' } }}
                    >
                      <ListItemText
                        primary={p.description}
                        secondary={`${fmt(p.amount)} · venceu ${dayjs(p.dueDate).fromNow()}`}
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Section>
              <Divider />
            </>
          )}

          {/* Estoque baixo */}
          {data?.lowStock?.length > 0 && (
            <>
              <Section icon={<Warning fontSize="small" />} title="Estoque baixo" color="#eda100">
                <List dense disablePadding>
                  {data.lowStock.map((p: any) => (
                    <ListItem
                      key={p.id}
                      button
                      onClick={() => go('/inventory')}
                      sx={{ px: 2, '&:hover': { bgcolor: 'action.hover' } }}
                    >
                      <ListItemText
                        primary={p.name}
                        secondary={`Qtd: ${p.quantity} · Mín: ${p.minQuantity}`}
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Section>
            </>
          )}
        </Box>

        {total > 0 && (
          <Box sx={{ px: 2, py: 1, borderTop: 1, borderColor: 'divider', flexShrink: 0 }}>
            <Button size="small" onClick={() => setAnchor(null)} fullWidth>
              Fechar
            </Button>
          </Box>
        )}
      </Popover>
    </>
  );
}
