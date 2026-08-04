import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Table, TableBody,
  TableCell, TableHead, TableRow, Typography, Chip, Tooltip, IconButton, Box,
  Stack, Divider,
} from '@mui/material';
import { Undo, Receipt } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import ReversePaymentDialog from './ReversePaymentDialog';
import { fmt, METHOD_LABELS } from './format';
import { useCompact } from '../../hooks/useCompact';

/**
 * Baixas já registradas de uma conta, com a opção de estornar a que foi lançada
 * errado. Sem esta tela, um recebimento digitado errado não tinha como ser
 * desfeito — ficava para sempre no saldo e no caixa.
 */
export default function PaymentsHistoryDialog({ account, onClose }: { account: any | null; onClose: () => void }) {
  const navigate = useNavigate();
  const compact = useCompact();
  const [reversing, setReversing] = useState<any | null>(null);
  const payments = account?.payments ?? [];

  return (
    <>
      <Dialog open={Boolean(account)} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          Baixas de {account?.description}
          <Typography variant="caption" color="text.secondary" display="block">
            {fmt(account?.paidAmount)} recebidos de {fmt(account?.amount)}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {payments.length === 0 ? (
            <Box sx={{ py: 3 }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                Nenhuma baixa registrada nesta conta ainda.
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Cada recebimento aparece aqui com data, forma e valor — é daqui que se estorna uma
                baixa lançada errada.
              </Typography>
            </Box>
          ) : compact ? (
            /* No telefone o diálogo já é estreito: as quatro colunas viram uma
               linha por baixa, com o valor em destaque e as ações embaixo. */
            <Stack divider={<Divider />}>
              {payments.map((p: any) => (
                <Box key={p.id} sx={{ py: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                    <Box>
                      <Typography variant="body2">
                        {dayjs(p.paidAt).format('DD/MM/YY [às] HH:mm')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {METHOD_LABELS[p.method] ?? p.method}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography
                        variant="body1"
                        fontWeight={700}
                        sx={{ textDecoration: p.reversedAt ? 'line-through' : undefined }}
                      >
                        {fmt(p.amount)}
                      </Typography>
                      {p.reversedAt && (
                        <Chip size="small" color="warning" variant="outlined" label="estornada" />
                      )}
                    </Box>
                  </Box>
                  {p.reversedAt ? (
                    p.reversedReason && (
                      <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                        {p.reversedReason}
                      </Typography>
                    )
                  ) : (
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                      <Button
                        size="small"
                        startIcon={<Receipt />}
                        onClick={() => navigate(`/financial/payments/${p.id}/receipt`)}
                      >
                        Comprovante
                      </Button>
                      <Button size="small" color="warning" startIcon={<Undo />} onClick={() => setReversing(p)}>
                        Estornar
                      </Button>
                    </Box>
                  )}
                </Box>
              ))}
            </Stack>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Data</TableCell>
                  <TableCell>Forma</TableCell>
                  <TableCell align="right">Valor</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payments.map((p: any) => (
                  <TableRow key={p.id} hover>
                    <TableCell>{dayjs(p.paidAt).format('DD/MM/YY HH:mm')}</TableCell>
                    <TableCell>{METHOD_LABELS[p.method] ?? p.method}</TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{ textDecoration: p.reversedAt ? 'line-through' : undefined }}
                      >
                        {fmt(p.amount)}
                      </Typography>
                      {p.reversedAt && (
                        <Tooltip title={p.reversedReason ?? ''}>
                          <Chip size="small" color="warning" variant="outlined" label="estornada" />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        <Tooltip title="Comprovante">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/financial/payments/${p.id}/receipt`)}
                          >
                            <Receipt fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {!p.reversedAt && (
                          <Tooltip title="Estornar esta baixa">
                            <IconButton size="small" color="warning" onClick={() => setReversing(p)}>
                              <Undo fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Fechar</Button>
        </DialogActions>
      </Dialog>

      <ReversePaymentDialog
        payment={reversing}
        onClose={() => { setReversing(null); onClose(); }}
      />
    </>
  );
}
