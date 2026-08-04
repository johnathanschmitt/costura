import { useState } from 'react';
import { Box, Typography, Button, Card, Stack, Collapse } from '@mui/material';
import { WarningAmber, Circle, ArrowForward } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { fmt } from './format';

export interface QueueItem {
  kind: string;
  severity: 'warning' | 'info';
  count: number;
  amount: unknown;
  label: string | null;
  action: string;
  to: string;
  sub?: { key: string; label: string; to: string }[];
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * O texto de cada item. A fila é uma lista de coisas para fazer, não um resumo:
 * cada linha diz o fato e o botão ao lado resolve. Sem isso, o financeiro
 * espera ser aberto — e quem esquece de abrir na terça não cobra ninguém
 * naquela semana.
 */
function describe(item: QueueItem) {
  switch (item.kind) {
    case 'RECEIVABLES_OVERDUE':
      return (
        <>
          {item.count} {plural(item.count, 'conta vencida', 'contas vencidas')} somando{' '}
          <strong>{fmt(item.amount)}</strong>
        </>
      );
    case 'CASH_REGISTER_STALE':
      return (
        <>
          O caixa {item.count === 1 ? 'de ontem' : `de ${dayjs(item.label).format('DD/MM')}`} não foi
          fechado — <strong>{fmt(item.amount)}</strong> esperados na gaveta
        </>
      );
    case 'PAYABLES_OVERDUE':
      return (
        <>
          {item.count} {plural(item.count, 'conta a pagar vencida', 'contas a pagar vencidas')} somando{' '}
          <strong>{fmt(item.amount)}</strong>
        </>
      );
    case 'PAYABLE_DUE_SOON':
      return (
        <>
          {item.label} vence {item.count === 0 ? 'hoje' : 'amanhã'} — <strong>{fmt(item.amount)}</strong>
        </>
      );
    case 'DELIVERED_UNPAID':
      return (
        <>
          {item.count} {plural(item.count, 'peça entregue', 'peças entregues')} sem pagamento
          registrado — <strong>{fmt(item.amount)}</strong>
        </>
      );
    case 'SETUP_PENDING':
      return (
        <>
          {plural(item.count, 'Falta', 'Faltam')} {item.count}{' '}
          {plural(item.count, 'ajuste', 'ajustes')} para os números ficarem certos
        </>
      );
    default:
      return item.label;
  }
}

/**
 * Fila de trabalho do painel (§4). Zero itens é o caso bom: o bloco some por
 * inteiro e o painel abre direto no dinheiro.
 */
export default function WorkQueue({ items }: { items: QueueItem[] }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!items.length) return null;

  return (
    <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="overline" color="text.secondary" letterSpacing={0.8}>
          Precisa de você hoje
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {items.length} {plural(items.length, 'item', 'itens')}
        </Typography>
      </Box>

      <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
        {items.map((item, i) => {
          const key = `${item.kind}-${i}`;
          return (
            <Box key={key} sx={{ py: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {item.severity === 'warning' ? (
                  <WarningAmber fontSize="small" color="warning" />
                ) : (
                  <Circle sx={{ fontSize: 10, color: 'text.disabled' }} />
                )}
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  {describe(item)}
                </Typography>
                <Button
                  size="small"
                  onClick={() => (item.sub?.length
                    ? setExpanded(e => (e === key ? null : key))
                    : navigate(item.to))}
                >
                  {item.action}
                </Button>
              </Box>

              {/* Cada ajuste tem o seu próprio link: "vá em Configurações e
                  procure a aba certa" não é um link. */}
              {item.sub?.length ? (
                <Collapse in={expanded === key}>
                  <Stack spacing={0.5} sx={{ pl: 4, pt: 1 }}>
                    {item.sub.map(s => (
                      <Box key={s.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                          {s.label}
                        </Typography>
                        <Button size="small" endIcon={<ArrowForward />} onClick={() => navigate(s.to)}>
                          ajustar
                        </Button>
                      </Box>
                    ))}
                  </Stack>
                </Collapse>
              ) : null}
            </Box>
          );
        })}
      </Stack>
    </Card>
  );
}
