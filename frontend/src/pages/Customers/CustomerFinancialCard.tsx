import { Box, Card, CardContent, Typography, Skeleton, Button } from '@mui/material';
import { ArrowForward } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { fmt, toNumber } from '../Financial/format';

const line = (label: string, value: React.ReactNode, caption?: React.ReactNode) => (
  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, py: 0.5 }}>
    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 150 }}>{label}</Typography>
    <Box sx={{ flexGrow: 1 }}>
      <Typography variant="body2" component="span" fontWeight={600}>{value}</Typography>
      {caption && (
        <Typography variant="body2" component="span" color="text.secondary">  {caption}</Typography>
      )}
    </Box>
  </Box>
);

/**
 * O histórico financeiro da cliente, na ficha dela.
 *
 * A ficha não tinha uma linha de financeiro, e a pergunta que ela precisa
 * responder no balcão — "posso fazer fiado para esta cliente?" — não tinha
 * resposta em tela nenhuma. Das três linhas, a terceira é a que muda a decisão:
 * quanto ela costuma atrasar.
 */
export default function CustomerFinancialCard({ customerId }: { customerId: string }) {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['customer-financials', customerId],
    queryFn: () => api.get(`/financial/customers/${customerId}/summary`).then(r => r.data),
  });

  const openAmount = toNumber(data?.open?.amount);
  const delay = data?.punctuality?.averageDelayDays;
  const sample = data?.punctuality?.sampleSize ?? 0;

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>Financeiro</Typography>
          <Button
            size="small"
            endIcon={<ArrowForward />}
            onClick={() => navigate('/financial/contas-do-mes')}
          >
            ver contas
          </Button>
        </Box>

        {isLoading ? <Skeleton height={90} /> : (
          <>
            {line(
              'Já gastou aqui',
              fmt(data?.spent),
              data?.pieces > 0 && `em ${data.pieces} peça${data.pieces === 1 ? '' : 's'}`,
            )}

            {line(
              'Em aberto agora',
              <Typography
                variant="body2"
                component="span"
                fontWeight={600}
                color={data?.open?.overdueCount > 0 ? 'error.main' : undefined}
              >
                {fmt(openAmount)}
              </Typography>,
              openAmount > 0 && (
                <>
                  {data.open.count} conta{data.open.count === 1 ? '' : 's'}
                  {data.open.overdueCount > 0 && data.open.oldestOverdueDays !== null
                    && `, vencida há ${data.open.oldestOverdueDays} dia${data.open.oldestOverdueDays === 1 ? '' : 's'}`}
                </>
              ),
            )}

            {/* Sem histórico não dá para inventar um comportamento: dizer
                "sempre paga em dia" com zero contas quitadas seria uma resposta
                errada com cara de certa, e é sobre ela que se decide o fiado. */}
            {line(
              'Costuma pagar',
              sample === 0
                ? 'sem histórico ainda'
                : delay <= 0
                  ? `${delay === 0 ? 'no dia' : `${Math.abs(delay)} dia${Math.abs(delay) === 1 ? '' : 's'} antes`} do combinado`
                  : `${delay} dia${delay === 1 ? '' : 's'} depois do combinado`,
              sample > 0 && `média de ${sample} conta${sample === 1 ? '' : 's'}`,
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
