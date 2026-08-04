import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Checkbox, FormControlLabel, RadioGroup, Radio,
  Button, Divider, Alert, Table, TableBody, TableCell, TableHead, TableRow, Chip,
  CircularProgress, Tooltip, TextField, Grid,
} from '@mui/material';
import { InfoOutlined } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MoneyField from '../../components/common/fields/MoneyField';
import api from '../../services/api';
import { useToast } from '../../store/toast.store';

const fmt = (v: any) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const MONTH_LABEL = (key: string) => {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '');
};

/**
 * Parâmetros que o painel do financeiro usa para responder "quanto preciso
 * faturar para empatar" e "estou cobrando o suficiente". Sem eles os dois
 * indicadores aparecem sem base de comparação.
 */
export default function FinancialSettingsTab() {
  const qc = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['financial-settings'],
    queryFn: () => api.get('/financial/settings').then(r => r.data),
  });

  const [mode, setMode] = useState('AVERAGE_3M');
  const [manual, setManual] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [blind, setBlind] = useState(false);
  const [excludeSignals, setExcludeSignals] = useState(true);
  const [coverLoss, setCoverLoss] = useState(true);
  const [carryLoss, setCarryLoss] = useState(true);
  const [reserveMonths, setReserveMonths] = useState(3);
  const [debitFee, setDebitFee] = useState(0);
  const [creditFee, setCreditFee] = useState(0);
  const [debitDays, setDebitDays] = useState(0);
  const [creditDays, setCreditDays] = useState(0);

  useEffect(() => {
    if (!data) return;
    setMode(data.fixedCostMode ?? 'AVERAGE_3M');
    setManual(data.fixedCostManual !== null ? Number(data.fixedCostManual) : null);
    setTarget(data.targetHourlyRate !== null ? Number(data.targetHourlyRate) : null);
    setBlind(Boolean(data.blindCashCount));
    setExcludeSignals(data.excludeUndeliveredSignals !== false);
    setCoverLoss(data.coverLossWithReserve !== false);
    setCarryLoss(data.carryLossToNextMonth !== false);
    setReserveMonths(data.reserveTargetMonths ?? 3);
    setDebitFee(Number(data.cardDebitFeePercent ?? 0));
    setCreditFee(Number(data.cardCreditFeePercent ?? 0));
    setDebitDays(Number(data.cardDebitDays ?? 0));
    setCreditDays(Number(data.cardCreditDays ?? 0));
  }, [data]);

  const toggleFixed = useMutation({
    mutationFn: ({ id, isFixed }: { id: string; isFixed: boolean }) =>
      api.patch(`/financial/categories/${id}`, { isFixed }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-settings'] });
      qc.invalidateQueries({ queryKey: ['financial-categories'] });
      qc.invalidateQueries({ queryKey: ['financial-overview'] });
    },
  });

  const save = useMutation({
    mutationFn: () =>
      api.patch('/settings/business', {
        fixedCostMode: mode,
        fixedCostManual: mode === 'MANUAL' ? manual : null,
        targetHourlyRate: target,
        blindCashCount: blind,
        excludeUndeliveredSignals: excludeSignals,
        coverLossWithReserve: coverLoss,
        carryLossToNextMonth: carryLoss,
        reserveTargetMonths: reserveMonths,
        cardDebitFeePercent: debitFee,
        cardCreditFeePercent: creditFee,
        cardDebitDays: debitDays,
        cardCreditDays: creditDays,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-settings'] });
      qc.invalidateQueries({ queryKey: ['financial-overview'] });
      qc.invalidateQueries({ queryKey: ['cash-register-current'] });
      toast('Configurações salvas');
    },
    onError: () => toast('Erro ao salvar as configurações', 'error'),
  });

  if (isLoading || !data) return <CircularProgress />;

  const fixedCategories = (data.categories as any[]).filter(c => c.isFixed);
  const estimated = fixedCategories.reduce((s, c) => s + Number(c.average3m ?? 0), 0);
  const invalidManual = mode === 'MANUAL' && !manual;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 860 }}>
      {/* ── 1. Custo fixo ─────────────────────────────────────────────── */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600}>Custo fixo do ateliê</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Marque as despesas que se repetem todo mês. É a soma delas que diz quanto o ateliê
            precisa faturar para empatar.
          </Typography>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">Fixa</TableCell>
                <TableCell>Categoria</TableCell>
                <TableCell align="right">Média dos últimos 3 meses</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data.categories as any[]).map(c => (
                <TableRow key={c.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={Boolean(c.isFixed)}
                      onChange={e => toggleFixed.mutate({ id: c.id, isFixed: e.target.checked })}
                      disabled={toggleFixed.isPending}
                    />
                  </TableCell>
                  <TableCell>
                    {c.name}
                    {!c.active && <Chip label="inativa" size="small" sx={{ ml: 1 }} />}
                  </TableCell>
                  <TableCell align="right">{fmt(c.average3m)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="body2" fontWeight={600}>Custo fixo mensal estimado</Typography>
            <Typography variant="body2" fontWeight={700}>{fmt(estimated)}</Typography>
          </Box>

          <Typography variant="body2" fontWeight={600} mb={0.5}>
            Como calcular o valor de cada mês
          </Typography>
          <RadioGroup value={mode} onChange={e => setMode(e.target.value)}>
            <FormControlLabel
              value="REAL"
              control={<Radio size="small" />}
              label="Valor realmente lançado no mês"
            />
            <FormControlLabel
              value="AVERAGE_3M"
              control={<Radio size="small" />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  Média dos últimos 3 meses
                  <Tooltip title="No mês em que a conta de luz ainda não chegou, o custo fixo não despenca e a meta continua realista.">
                    <InfoOutlined sx={{ fontSize: 15, color: 'text.secondary' }} />
                  </Tooltip>
                </Box>
              }
            />
            <FormControlLabel
              value="MANUAL"
              control={<Radio size="small" />}
              label="Valor fixo que eu informo"
            />
          </RadioGroup>
          {mode === 'MANUAL' && (
            <Box sx={{ mt: 1, maxWidth: 220 }}>
              <MoneyField label="Custo fixo mensal" value={manual} onChange={setManual} fullWidth />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ── 2. Meta de ganho por hora ─────────────────────────────────── */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600}>Meta de ganho por hora</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Quanto o ateliê quer ganhar por hora de costura. O painel compara com o realizado
            (o que entrou dividido pelas horas das peças entregues).
          </Typography>

          <Box sx={{ maxWidth: 220, mb: 2 }}>
            <MoneyField label="Meta por hora" value={target} onChange={setTarget} fullWidth />
          </Box>

          <Typography variant="caption" color="text.secondary">Realizado nos últimos meses</Typography>
          <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
            {(data.hourlyRateHistory as any[]).map(h => (
              <Box key={h.month} sx={{ bgcolor: 'background.default', px: 1.5, py: 1, borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" textTransform="capitalize">
                  {MONTH_LABEL(h.month)}
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {h.rate === null ? '—' : `${fmt(h.rate)}/h`}
                </Typography>
              </Box>
            ))}
          </Box>

          {data.servicesWithoutHours > 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {data.servicesWithoutHours} serviço(s) estão sem tempo estimado em
              <strong> Catálogo → Serviços</strong>. As OS feitas só com eles ficam de fora da
              conta de ganho por hora.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* ── 3. Divisão do resultado ───────────────────────────────────── */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600}>Divisão do resultado</Typography>
          <Typography variant="body2" color="text.secondary" mb={1}>
            O percentual de cada sócia e do ateliê é editado na tela
            <strong> Financeiro → Divisão</strong>. Aqui ficam as regras de o que entra no bolo.
          </Typography>

          <FormControlLabel
            control={
              <Checkbox
                checked={excludeSignals}
                onChange={e => setExcludeSignals(e.target.checked)}
              />
            }
            label="Tirar da divisão os sinais de peças ainda não entregues"
          />
          <Typography variant="caption" color="text.secondary" display="block" ml={4} mb={1}>
            Esse dinheiro ainda tem tecido e trabalho pela frente. Volta ao bolo no mês da entrega.
          </Typography>

          <FormControlLabel
            control={
              <Checkbox
                checked={coverLoss}
                onChange={e => setCoverLoss(e.target.checked)}
              />
            }
            label="Cobrir mês negativo com a reserva do ateliê"
          />
          <Box ml={4}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={carryLoss}
                  onChange={e => setCarryLoss(e.target.checked)}
                />
              }
              label="E o que a reserva não cobrir, abater do mês seguinte"
            />
            <Typography variant="caption" color="text.secondary" display="block">
              Desmarcando a opção de cima, o prejuízo vai direto para o mês seguinte sem tocar na
              reserva.
            </Typography>
          </Box>

          <Box sx={{ mt: 2, maxWidth: 260 }}>
            <TextField
              label="Meta de reserva (meses de custo fixo)"
              value={reserveMonths}
              onChange={e => setReserveMonths(Number(e.target.value.replace(/\D/g, '')) || 0)}
              type="number"
              size="small"
              fullWidth
            />
          </Box>
        </CardContent>
      </Card>

      {/* ── 4. Maquininha ─────────────────────────────────────────────── */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600}>Maquininha de cartão</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            A cliente paga um valor e o ateliê recebe outro, dias depois. Informando a taxa e o
            prazo da sua maquininha, a venda entra pelo valor cheio, a taxa vira despesa e o
            dinheiro só conta no saldo quando cai de verdade.
          </Typography>

          <Grid container spacing={2} sx={{ maxWidth: 520 }}>
            <Grid item xs={6}>
              <TextField
                label="Taxa do débito"
                value={debitFee}
                onChange={e => setDebitFee(Number(e.target.value.replace(',', '.')) || 0)}
                type="number"
                size="small"
                fullWidth
                InputProps={{ endAdornment: <Typography variant="caption">%</Typography> }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Prazo do débito"
                value={debitDays}
                onChange={e => setDebitDays(Number(e.target.value.replace(/\D/g, '')) || 0)}
                type="number"
                size="small"
                fullWidth
                InputProps={{ endAdornment: <Typography variant="caption">dias</Typography> }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Taxa do crédito"
                value={creditFee}
                onChange={e => setCreditFee(Number(e.target.value.replace(',', '.')) || 0)}
                type="number"
                size="small"
                fullWidth
                InputProps={{ endAdornment: <Typography variant="caption">%</Typography> }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Prazo do crédito"
                value={creditDays}
                onChange={e => setCreditDays(Number(e.target.value.replace(/\D/g, '')) || 0)}
                type="number"
                size="small"
                fullWidth
                InputProps={{ endAdornment: <Typography variant="caption">dias</Typography> }}
              />
            </Grid>
          </Grid>

          {(creditFee > 0 || debitFee > 0) && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Numa venda de {fmt(200)} no crédito, a taxa fica em{' '}
              <strong>{fmt(200 * (creditFee / 100))}</strong> e caem{' '}
              <strong>{fmt(200 - 200 * (creditFee / 100))}</strong> em {creditDays} dia(s).
            </Alert>
          )}

          <Typography variant="caption" color="text.secondary" display="block" mt={1}>
            Com taxa e prazo zerados, o cartão se comporta como antes: valor cheio, disponível na
            hora. As vendas já registradas não mudam.
          </Typography>
        </CardContent>
      </Card>

      {/* ── 5. Caixa ──────────────────────────────────────────────────── */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600}>Fechamento de caixa</Typography>
          <FormControlLabel
            sx={{ mt: 1 }}
            control={<Checkbox checked={blind} onChange={e => setBlind(e.target.checked)} />}
            label="Conferência às cegas"
          />
          <Typography variant="body2" color="text.secondary">
            O saldo esperado fica escondido até a contagem ser informada. Mostrar o número antes
            transforma ele na resposta — a conferência deixa de conferir.
          </Typography>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          onClick={() => save.mutate()}
          disabled={save.isPending || invalidManual}
        >
          Salvar
        </Button>
        {invalidManual && (
          <Alert severity="warning" sx={{ py: 0 }}>Informe o valor do custo fixo mensal.</Alert>
        )}
      </Box>
    </Box>
  );
}
