import { useEffect, useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Alert, Box, Typography, Divider, InputAdornment, IconButton, Tooltip,
  CircularProgress, Link,
} from '@mui/material';
import { WhatsApp, ContentCopy, PictureAsPdf, CheckCircle } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useToast } from '../../store/toast.store';
import QuoteDocument from './QuoteDocument';
import { generateQuotePdf, quoteFileName } from './generateQuotePdf';

const apiError = (e: any, fallback: string) => {
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m.join('. ') : m ?? fallback;
};

interface Props {
  quote: any | null;
  onClose: () => void;
}

export default function ShareDialog({ quote, onClose }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const docRef = useRef<HTMLDivElement>(null);

  const open = Boolean(quote);

  const { data: biz } = useQuery({
    queryKey: ['business-info'],
    queryFn: () => api.get('/settings/business').then(r => r.data),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setPhone(quote?.customer?.phone ?? '');
      setResult(null);
      setError('');
      setBlocked(null);
    }
  }, [open, quote]);

  const shareMutation = useMutation({
    mutationFn: (targetPhone: string) =>
      api.post(`/quotes/${quote.id}/share`, { channel: 'WHATSAPP', phone: targetPhone || undefined }),
  });

  /**
   * O `window.open` precisa acontecer dentro do clique — se esperarmos a
   * requisição e o PDF, o navegador trata como popup e bloqueia. Por isso a
   * aba é aberta em branco já aqui e só depois recebe o endereço.
   */
  const handleSend = async () => {
    setError('');
    setBlocked(null);
    const tab = window.open('', '_blank');
    setBusy(true);

    try {
      const res = await shareMutation.mutateAsync(phone);
      setResult(res.data);
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['quote', quote.id] });

      if (docRef.current) {
        await generateQuotePdf(
          docRef.current,
          quoteFileName(quote.number, quote.customer?.name),
        );
      }

      if (tab && !tab.closed) {
        tab.location.href = res.data.whatsappUrl;
      } else {
        // Popup bloqueado: oferecemos o link para a atendente abrir na mão.
        setBlocked(res.data.whatsappUrl);
      }
    } catch (e: any) {
      tab?.close();
      setError(apiError(e, 'Erro ao preparar o envio'));
    } finally {
      setBusy(false);
    }
  };

  const copy = (text: string, what: string) => {
    navigator.clipboard.writeText(text);
    toast(`${what} copiado`);
  };

  return (
    <>
      <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Enviar {quote?.number} por WhatsApp</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {!result ? (
            <>
              <Alert severity="info" icon={<PictureAsPdf />}>
                Ao enviar, o <strong>PDF do orçamento é baixado</strong> e o WhatsApp abre na
                conversa da cliente com a mensagem pronta. Basta anexar o arquivo baixado
                (o WhatsApp não permite anexar por link).
              </Alert>

              <TextField
                label="Número da cliente"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="(11) 98765-4321"
                helperText={
                  quote?.customer?.phone
                    ? 'Telefone cadastrado — pode trocar se ela usar outro número'
                    : 'Esta cliente não tem telefone cadastrado'
                }
                fullWidth
                autoFocus
                disabled={busy}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><WhatsApp color="success" /></InputAdornment>,
                }}
              />
            </>
          ) : (
            <>
              <Alert severity="success" icon={<CheckCircle />}>
                PDF baixado e WhatsApp aberto. Agora é só <strong>anexar o arquivo</strong> na conversa.
              </Alert>

              {blocked && (
                <Alert severity="warning">
                  O navegador bloqueou a abertura automática.{' '}
                  <Link href={blocked} target="_blank" rel="noopener" fontWeight={700}>
                    Clique aqui para abrir o WhatsApp
                  </Link>
                </Alert>
              )}

              <Box>
                <Typography variant="caption" color="text.secondary">Mensagem enviada</Typography>
                <Box sx={{ bgcolor: 'background.default', p: 1.5, borderRadius: 2, mt: 0.5 }}>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{result.message}</Typography>
                </Box>
                <Button size="small" startIcon={<ContentCopy />} onClick={() => copy(result.message, 'Mensagem')} sx={{ mt: 0.5 }}>
                  Copiar mensagem
                </Button>
              </Box>

              <Divider />

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Link do orçamento — opcional, caso prefira mandar em vez do arquivo
                </Typography>
                <TextField
                  value={result.link}
                  fullWidth
                  size="small"
                  sx={{ mt: 0.5 }}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Copiar link">
                          <IconButton size="small" onClick={() => copy(result.link, 'Link')}>
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>{result ? 'Fechar' : 'Cancelar'}</Button>
          {!result && (
            <Button
              variant="contained"
              color="success"
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <WhatsApp />}
              onClick={handleSend}
              disabled={!phone.trim() || busy}
            >
              {busy ? 'Gerando PDF…' : 'Baixar PDF e abrir WhatsApp'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/*
        O documento fica renderizado fora da tela só para o html2canvas capturar
        — na largura exata de uma folha A4, para o PDF sair fiel à impressão.
      */}
      {open && quote && (
        <Box
          sx={{
            position: 'fixed', left: -10000, top: 0, width: 794,
            bgcolor: '#fff', pointerEvents: 'none',
          }}
          aria-hidden
        >
          <div ref={docRef}>
            <QuoteDocument quote={quote} business={biz} variant="public" />
          </div>
        </Box>
      )}
    </>
  );
}
