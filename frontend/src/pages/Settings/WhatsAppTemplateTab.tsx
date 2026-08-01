import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, TextField, Typography, Button, Grid, Chip,
  Alert, Divider, Tooltip, CircularProgress,
} from '@mui/material';
import { Save, RestartAlt, WhatsApp } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useToast } from '../../store/toast.store';

/** Exemplo usado só na prévia — nada aqui vai para o banco. */
const PREVIEW = {
  cliente: 'Ana',
  numero: 'ORC-00042',
  total: 'R$ 850,00',
  validade: '15/08/2026',
  atelie: 'Ateliê de Costura',
  link: 'https://seu-atelie.com.br/orcamento/abc123',
};

export default function WhatsAppTemplateTab() {
  const qc = useQueryClient();
  const toast = useToast();
  const [template, setTemplate] = useState('');
  const [touched, setTouched] = useState(false);

  const { data: biz, isLoading } = useQuery({
    queryKey: ['business-info'],
    queryFn: () => api.get('/settings/business').then(r => r.data),
  });

  useEffect(() => {
    if (biz && !touched) setTemplate(biz.whatsappTemplate ?? biz.whatsappTemplateDefault ?? '');
  }, [biz, touched]);

  const mutation = useMutation({
    mutationFn: (value: string | null) => api.patch('/settings/business', { whatsappTemplate: value }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-info'] });
      setTouched(false);
      toast('Mensagem salva');
    },
    onError: () => toast('Erro ao salvar a mensagem', 'error'),
  });

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }

  const vars: { key: string; description: string }[] = biz?.whatsappTemplateVars ?? [];
  const isDefault = !biz?.whatsappTemplate;

  // A prévia troca os marcadores pelos valores de exemplo, igual ao envio real.
  const preview = (template || biz?.whatsappTemplateDefault || '').replace(
    /\{(\w+)\}/g,
    (m: string, k: string) => (k in PREVIEW ? PREVIEW[k as keyof typeof PREVIEW] : m),
  );

  const insertVar = (key: string) => {
    setTemplate(t => `${t}{${key}}`);
    setTouched(true);
  };

  return (
    <Box>
      <Typography variant="h6" mb={0.5}>Mensagem do WhatsApp</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        É o texto que abre pronto ao enviar um orçamento. O PDF vai anexado à parte.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="subtitle1" fontWeight={600}>Modelo</Typography>
                {isDefault && <Chip label="usando o padrão" size="small" variant="outlined" />}
              </Box>

              <TextField
                value={template}
                onChange={e => { setTemplate(e.target.value); setTouched(true); }}
                fullWidth
                multiline
                rows={10}
                placeholder="Escreva a mensagem…"
              />

              <Typography variant="caption" color="text.secondary" display="block" mt={1.5} mb={0.5}>
                Clique para inserir no final do texto:
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                {vars.map(v => (
                  <Tooltip key={v.key} title={v.description}>
                    <Chip
                      label={`{${v.key}}`}
                      size="small"
                      onClick={() => insertVar(v.key)}
                      sx={{ fontFamily: 'monospace', cursor: 'pointer' }}
                    />
                  </Tooltip>
                ))}
              </Box>

              <Alert severity="info" sx={{ mt: 2 }}>
                Evite emoji: alguns aparelhos e fontes mostram “�” quando o texto chega pelo link
                do WhatsApp. Se o seu exibe corretamente, pode usar à vontade.
              </Alert>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={() => mutation.mutate(template.trim() || null)}
                  disabled={mutation.isPending || !touched}
                >
                  Salvar mensagem
                </Button>
                <Button
                  startIcon={<RestartAlt />}
                  onClick={() => {
                    setTemplate(biz?.whatsappTemplateDefault ?? '');
                    setTouched(true);
                  }}
                  disabled={mutation.isPending}
                >
                  Restaurar padrão
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ position: 'sticky', top: 16 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <WhatsApp color="success" />
                <Typography variant="subtitle1" fontWeight={600}>Como a cliente vai ver</Typography>
              </Box>

              {/* Balão parecido com o do WhatsApp, para a leitura ficar realista */}
              <Box sx={{ bgcolor: '#ece5dd', p: 2, borderRadius: 2 }}>
                <Box
                  sx={{
                    bgcolor: '#d9fdd3', p: 1.5, borderRadius: 2, borderTopRightRadius: 4,
                    ml: 'auto', maxWidth: '92%', boxShadow: 1,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ whiteSpace: 'pre-wrap', color: '#111', wordBreak: 'break-word' }}
                  >
                    {preview || <em>(mensagem vazia)</em>}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    bgcolor: '#fff', p: 1.25, borderRadius: 2, mt: 1, ml: 'auto',
                    maxWidth: '92%', display: 'flex', alignItems: 'center', gap: 1, boxShadow: 1,
                  }}
                >
                  <Box sx={{ bgcolor: '#f15c6d', color: '#fff', px: 0.75, py: 0.25, borderRadius: 0.5, fontSize: 10, fontWeight: 700 }}>
                    PDF
                  </Box>
                  <Typography variant="caption" sx={{ color: '#111' }}>
                    Orcamento-ORC-00042-Ana.pdf
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" display="block" textAlign="right" mt={0.5}>
                  o arquivo é anexado por você na conversa
                </Typography>
              </Box>

              <Typography variant="caption" color="text.secondary" display="block" mt={1.5}>
                Os valores acima são de exemplo. No envio real, cada marcador é trocado pelos
                dados do orçamento.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
