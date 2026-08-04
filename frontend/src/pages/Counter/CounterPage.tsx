import { useState } from 'react';
import {
  Box, Typography, Paper, Button, Chip, Skeleton, Divider, Stack, IconButton,
} from '@mui/material';
import { LocalShipping, Print, Close, Receipt, WhatsApp } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';
import CustomerAutocomplete from '../../components/common/CustomerAutocomplete';
import DeliverDialog from '../WorkOrders/DeliverDialog';
import CustomerFinancialCard from '../Customers/CustomerFinancialCard';
import { STATUS_MAP } from '../WorkOrders/constants';
import { fmt, toNumber } from '../Financial/format';

/**
 * Modo balcão — a cliente na frente, uma tela só.
 *
 * O caminho normal para atender no balcão passava por três módulos: achar a
 * cliente, achar a OS, sair para o financeiro receber, voltar para entregar. É
 * o caminho longo, e ele existe porque as telas foram organizadas por assunto,
 * não pelo momento em que são usadas.
 *
 * Aqui não há abas: busca a cliente, vê as peças dela, recebe e entrega no
 * mesmo diálogo, imprime o recibo. Tudo o que esta tela faz já existia — o que
 * não existia era o lugar onde as quatro coisas acontecem juntas.
 */
export default function CounterPage() {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<any>(null);
  const [delivering, setDelivering] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['counter-work-orders', customer?.id],
    queryFn: () => api.get('/work-orders', {
      params: { customerId: customer.id, limit: 50 },
    }).then(r => r.data),
    enabled: Boolean(customer?.id),
  });

  const rows = (data?.data ?? []) as any[];
  // Peça já entregue não é assunto do balcão; cancelada, menos ainda.
  const active = rows.filter(r => !['DELIVERED', 'CANCELLED'].includes(r.status));
  const ready = active.filter(r => r.status === 'DONE');
  const owing = active.reduce((s, r) => s + toNumber(r.financials?.balance), 0);

  const whatsapp = String(customer?.phone ?? '').replace(/\D/g, '');

  return (
    <Box sx={{ maxWidth: 780, mx: 'auto' }}>
      <Typography variant="h5" mb={0.5}>Balcão</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Busque a cliente, veja as peças dela, receba e entregue sem sair daqui.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <Box sx={{ flexGrow: 1 }}>
            <CustomerAutocomplete value={customer} onChange={setCustomer} />
          </Box>
          {customer && (
            <IconButton onClick={() => setCustomer(null)} sx={{ mt: 0.5 }}>
              <Close />
            </IconButton>
          )}
        </Box>
      </Paper>

      {!customer ? (
        <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
          <Typography variant="body1" fontWeight={600} gutterBottom>
            Comece digitando o nome da cliente.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440, mx: 'auto' }}>
            As peças em aberto aparecem aqui, com o que ela ainda deve em cada uma.
          </Typography>
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mb: 1, flexWrap: 'wrap' }}>
            <Typography variant="h6">{customer.name}</Typography>
            {whatsapp && (
              <Button
                size="small"
                startIcon={<WhatsApp />}
                color="success"
                href={`https://wa.me/55${whatsapp}`}
                target="_blank"
                rel="noopener"
              >
                {customer.phone}
              </Button>
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Button size="small" onClick={() => navigate(`/customers/${customer.id}/edit`)}>
              abrir a ficha
            </Button>
          </Box>

          {owing > 0.005 && (
            <Typography variant="body2" color="error.main" mb={2}>
              Em peças ainda não entregues, ela deve <strong>{fmt(owing)}</strong>.
            </Typography>
          )}

          {ready.length > 0 && (
            <Typography variant="body2" mb={2}>
              <strong>{ready.length}</strong> peça{ready.length === 1 ? '' : 's'}{' '}
              pronta{ready.length === 1 ? '' : 's'} para retirar.
            </Typography>
          )}

          <Stack spacing={1.5} mb={3}>
            {isLoading && [0, 1].map(i => <Skeleton key={i} variant="rounded" height={110} />)}

            {!isLoading && active.length === 0 && (
              <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body1" fontWeight={600} gutterBottom>
                  Nenhuma peça em aberto para {customer.name.split(' ')[0]}.
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Tudo o que ela deixou já foi entregue ou cancelado.
                </Typography>
                <Button
                  variant="outlined"
                  onClick={() => navigate(`/work-orders/new?customerId=${customer.id}`)}
                >
                  Abrir uma OS
                </Button>
              </Paper>
            )}

            {active.map(wo => {
              const balance = toNumber(wo.financials?.balance);
              const status = STATUS_MAP[wo.status] ?? { label: wo.status, color: 'default' };
              const canDeliver = wo.status === 'DONE';
              return (
                <Paper key={wo.id} variant="outlined" sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body1" fontWeight={600}>{wo.number}</Typography>
                        <Chip size="small" label={status.label} color={status.color} />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {wo.garment?.name ?? 'Peça'}
                        {wo.dueDate && ` · entrega prevista ${dayjs(wo.dueDate).format('DD/MM')}`}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="body2" color="text.secondary">
                        {balance > 0.005 ? 'Falta pagar' : 'Está pago'}
                      </Typography>
                      <Typography
                        variant="h6"
                        fontWeight={700}
                        color={balance > 0.005 ? 'error.main' : 'success.main'}
                      >
                        {fmt(balance)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        de {fmt(wo.financials?.total)}
                      </Typography>
                    </Box>
                  </Box>

                  <Divider sx={{ my: 1.5 }} />

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {/* O mesmo diálogo da OS: recebe e entrega de uma vez. */}
                    <Button
                      variant={canDeliver ? 'contained' : 'outlined'}
                      startIcon={<LocalShipping />}
                      onClick={() => setDelivering(wo)}
                    >
                      {balance > 0.005 ? `Receber ${fmt(balance)} e entregar` : 'Entregar'}
                    </Button>
                    <Button startIcon={<Receipt />} onClick={() => navigate(`/work-orders/${wo.id}/edit`)}>
                      Abrir a OS
                    </Button>
                    <Button startIcon={<Print />} onClick={() => navigate(`/work-orders/${wo.id}/receipt`)}>
                      Imprimir recibo
                    </Button>
                  </Box>

                  {!canDeliver && (
                    <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                      Esta peça ainda está em {status.label.toLowerCase()} — entregar agora vai
                      marcá-la como entregue mesmo assim.
                    </Typography>
                  )}
                </Paper>
              );
            })}
          </Stack>

          {/* O que decide o fiado, na mesma tela em que ele é pedido. */}
          <CustomerFinancialCard customerId={customer.id} />
        </>
      )}

      <DeliverDialog
        workOrder={delivering}
        onClose={() => setDelivering(null)}
        onDelivered={() => setDelivering(null)}
      />
    </Box>
  );
}
