import { useState, useEffect, useRef } from 'react';
import {
  Box, Button, Card, CardContent, TextField, Typography,
  Grid, Avatar, IconButton, Divider, CircularProgress, InputAdornment,
} from '@mui/material';
import { PhoneField, EmailField } from '../../components/common/fields/MaskedFields';
import {
  Save, Upload, Delete, WhatsApp, Instagram, Facebook, MusicNote,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useToast } from '../../store/toast.store';

interface BusinessForm {
  name: string;
  tagline: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  taxId: string;
  footerText: string;
  logoBase64: string | null;
}

const EMPTY: BusinessForm = {
  name: '', tagline: '', address: '', city: '', phone: '',
  email: '', website: '', taxId: '', footerText: '', logoBase64: null,
  whatsapp: '', instagram: '', facebook: '', tiktok: '',
};

export default function BusinessInfoTab() {
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<BusinessForm>(EMPTY);

  const { data, isLoading } = useQuery({
    queryKey: ['business-info'],
    queryFn: () => api.get('/settings/business').then(r => r.data),
  });

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name ?? '',
        tagline: data.tagline ?? '',
        address: data.address ?? '',
        city: data.city ?? '',
        phone: data.phone ?? '',
        email: data.email ?? '',
        website: data.website ?? '',
        whatsapp: data.whatsapp ?? '',
        instagram: data.instagram ?? '',
        facebook: data.facebook ?? '',
        tiktok: data.tiktok ?? '',
        taxId: data.taxId ?? '',
        footerText: data.footerText ?? '',
        logoBase64: data.logoBase64 ?? null,
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (payload: BusinessForm) => api.patch('/settings/business', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-info'] });
      toast('Dados salvos com sucesso', 'success');
    },
    onError: () => toast('Erro ao salvar', 'error'),
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast('A logo deve ter no máximo 2 MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, logoBase64: ev.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const set = (field: keyof BusinessForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} mb={2}>Logotipo</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Avatar
              src={form.logoBase64 ?? undefined}
              variant="rounded"
              sx={{ width: 120, height: 80, bgcolor: 'grey.100', fontSize: 14, color: 'text.secondary' }}
            >
              {!form.logoBase64 && 'Sem logo'}
            </Avatar>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                style={{ display: 'none' }}
                onChange={handleLogoUpload}
              />
              <Button variant="outlined" startIcon={<Upload />} onClick={() => fileRef.current?.click()}>
                Enviar imagem
              </Button>
              {form.logoBase64 && (
                <Button
                  color="error"
                  startIcon={<Delete />}
                  onClick={() => setForm(f => ({ ...f, logoBase64: null }))}
                >
                  Remover
                </Button>
              )}
              <Typography variant="caption" color="text.secondary">
                PNG, JPG, SVG ou WebP · máx. 2 MB
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} mb={2}>Dados do negócio</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <TextField
                label="Nome do ateliê / empresa"
                value={form.name}
                onChange={set('name')}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="CNPJ / CPF"
                value={form.taxId}
                onChange={set('taxId')}
                fullWidth
                placeholder="00.000.000/0001-00"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Slogan / tagline"
                value={form.tagline}
                onChange={set('tagline')}
                fullWidth
                placeholder="Ex: Alta costura sob medida"
              />
            </Grid>

            <Grid item xs={12}><Divider><Typography variant="caption" color="text.secondary">Contato</Typography></Divider></Grid>

            <Grid item xs={12} md={4}>
              <PhoneField label="Telefone / WhatsApp" value={form.phone} onChange={v => set('phone')({ target: { value: v } } as any)} fullWidth />
            </Grid>
            <Grid item xs={12} md={4}>
              <EmailField label="E-mail" value={form.email} onChange={v => set('email')({ target: { value: v } } as any)} fullWidth />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField label="Website" value={form.website} onChange={set('website')} fullWidth placeholder="www.seuatelie.com.br" />
            </Grid>

            <Grid item xs={12}><Divider><Typography variant="caption" color="text.secondary">Endereço</Typography></Divider></Grid>

            <Grid item xs={12} md={8}>
              <TextField label="Endereço" value={form.address} onChange={set('address')} fullWidth placeholder="Rua, número, bairro" />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField label="Cidade / UF" value={form.city} onChange={set('city')} fullWidth placeholder="São Paulo - SP" />
            </Grid>

            <Grid item xs={12}>
              <Divider><Typography variant="caption" color="text.secondary">Redes sociais</Typography></Divider>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">
                Aparecem no orçamento que a cliente abre pelo link e nos documentos impressos.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <PhoneField
                label="WhatsApp comercial"
                value={form.whatsapp}
                onChange={v => set('whatsapp')({ target: { value: v } } as any)}
                fullWidth
                InputProps={{ startAdornment: <InputAdornment position="start"><WhatsApp fontSize="small" color="success" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Instagram"
                value={form.instagram}
                onChange={set('instagram')}
                fullWidth
                placeholder="@seuatelie"
                InputProps={{ startAdornment: <InputAdornment position="start"><Instagram fontSize="small" sx={{ color: '#C13584' }} /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Facebook"
                value={form.facebook}
                onChange={set('facebook')}
                fullWidth
                placeholder="facebook.com/seuatelie"
                InputProps={{ startAdornment: <InputAdornment position="start"><Facebook fontSize="small" sx={{ color: '#1877F2' }} /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="TikTok"
                value={form.tiktok}
                onChange={set('tiktok')}
                fullWidth
                placeholder="@seuatelie"
                InputProps={{ startAdornment: <InputAdornment position="start"><MusicNote fontSize="small" /></InputAdornment> }}
              />
            </Grid>

            <Grid item xs={12}><Divider><Typography variant="caption" color="text.secondary">Orçamentos e documentos</Typography></Divider></Grid>

            <Grid item xs={12}>
              <TextField
                label="Texto do rodapé"
                value={form.footerText}
                onChange={set('footerText')}
                fullWidth
                multiline
                rows={2}
                placeholder="Ex: Obrigado pela preferência! Orçamento válido por 15 dias."
              />
            </Grid>
          </Grid>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending}
            >
              Salvar alterações
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
