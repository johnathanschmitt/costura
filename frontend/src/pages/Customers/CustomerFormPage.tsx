import { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Button, Grid, TextField, Card, CardContent,
  Alert, Breadcrumbs, Link,
} from '@mui/material';
import { PhoneField, DocumentField, CepField, EmailField } from '../../components/common/fields/MaskedFields';
import { Save, ArrowBack } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs, { Dayjs } from 'dayjs';
import api from '../../services/api';
import { useAutosave } from '../../hooks/useAutosave';
import AutosaveIndicator from '../../components/common/AutosaveIndicator';
import MeasurementsCard from './MeasurementsCard';
import CustomerFinancialCard from './CustomerFinancialCard';
import CustomerWorkOrdersCard from './CustomerWorkOrdersCard';

interface CustomerForm {
  name: string;
  email: string;
  phone: string;
  phone2: string;
  cpf: string;
  birthDate: Dayjs | null;
  notes: string;
  address: {
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    zip: string;
  };
}

const EMPTY: CustomerForm = {
  name: '', email: '', phone: '', phone2: '', cpf: '', birthDate: null, notes: '',
  address: { street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zip: '' },
};

export default function CustomerFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState<CustomerForm>(EMPTY);
  const [error, setError] = useState('');

  const { data: existing } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get(`/customers/${id}`).then(r => r.data),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name ?? '',
        email: existing.email ?? '',
        phone: existing.phone ?? '',
        phone2: existing.phone2 ?? '',
        cpf: existing.cpf ?? '',
        birthDate: existing.birthDate ? dayjs(existing.birthDate) : null,
        notes: existing.notes ?? '',
        address: existing.address ?? EMPTY.address,
      });
    }
  }, [existing]);

  const set = (field: keyof CustomerForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const setAddr = (field: keyof CustomerForm['address']) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, address: { ...f.address, [field]: e.target.value } }));

  const buildPayload = useCallback((f: CustomerForm) => ({
    ...f,
    birthDate: f.birthDate?.toISOString() ?? null,
    email: f.email || null,
    phone: f.phone || null,
    phone2: f.phone2 || null,
    cpf: f.cpf || null,
  }), []);

  const saveFn = useCallback(async (f: CustomerForm) => {
    if (!f.name.trim()) return;
    if (isEdit && id) {
      await api.put(`/customers/${id}`, buildPayload(f));
    } else {
      const res = await api.post('/customers', buildPayload(f));
      navigate(`/customers/${res.data.id}/edit`, { replace: true });
    }
    qc.invalidateQueries({ queryKey: ['customers'] });
  }, [isEdit, id, buildPayload, navigate, qc]);

  const { status: saveStatus, saveNow } = useAutosave(form, saveFn, { enabled: isEdit });

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Nome é obrigatório'); return; }
    setError('');
    try {
      await saveNow();
      if (!isEdit) navigate('/customers');
    } catch {
      setError('Erro ao salvar cliente');
    }
  };

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link component="button" variant="body2" onClick={() => navigate('/customers')} underline="hover" color="inherit">
          Clientes
        </Link>
        <Typography variant="body2" color="text.primary">{isEdit ? 'Ficha' : 'Novo'}</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button size="small" startIcon={<ArrowBack />} onClick={() => navigate('/customers')}>Voltar</Button>
          {/* O nome da cliente é o título: a mesma tela é aberta pelo olho e
              pelo lápis, e "Editar Cliente" em cima de quem só quis consultar
              soa como se algo já tivesse sido mexido. */}
          <Typography variant="h5">
            {isEdit ? (existing?.name || 'Ficha da cliente') : 'Novo Cliente'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {isEdit && <AutosaveIndicator status={saveStatus} />}
          <Button variant="contained" startIcon={<Save />} onClick={handleSave}>
            {isEdit ? 'Salvar' : 'Criar Cliente'}
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2}>
        {/* Dados pessoais */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} mb={2}>Dados Pessoais</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label="Nome completo"
                    value={form.name}
                    onChange={set('name')}
                    required
                    fullWidth
                    autoFocus={!isEdit}
                    error={!form.name && !!error}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <EmailField label="E-mail" value={form.email} onChange={v => set('email')({ target: { value: v } } as any)} fullWidth />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <DocumentField label="CPF" value={form.cpf} onChange={v => set('cpf')({ target: { value: v } } as any)} fullWidth />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <PhoneField label="Telefone" value={form.phone} onChange={v => set('phone')({ target: { value: v } } as any)} fullWidth />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <PhoneField label="Telefone 2" value={form.phone2} onChange={v => set('phone2')({ target: { value: v } } as any)} fullWidth />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <DatePicker
                    label="Data de nascimento"
                    value={form.birthDate}
                    onChange={v => setForm(f => ({ ...f, birthDate: v }))}
                    slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Observações */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} mb={2}>Observações</Typography>
              <TextField
                label="Observações internas"
                value={form.notes}
                onChange={set('notes')}
                fullWidth
                multiline
                rows={6}
                placeholder="Preferências, histórico, alertas…"
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Peças, financeiro e medidas — só existem depois que a cliente existe */}
        {isEdit && id && (
          <Grid item xs={12}>
            <CustomerWorkOrdersCard customerId={id} />
          </Grid>
        )}

        {isEdit && id && (
          <Grid item xs={12}>
            <CustomerFinancialCard customerId={id} />
          </Grid>
        )}

        {isEdit && id && (
          <Grid item xs={12}>
            <MeasurementsCard customerId={id} />
          </Grid>
        )}

        {/* Endereço */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} mb={2}>Endereço</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={3}>
                  <CepField label="CEP" value={form.address.zip} onChange={v => setAddr('zip')({ target: { value: v } } as any)} fullWidth />
                </Grid>
                <Grid item xs={12} sm={7}>
                  <TextField label="Rua / Logradouro" value={form.address.street} onChange={setAddr('street')} fullWidth />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField label="Número" value={form.address.number} onChange={setAddr('number')} fullWidth />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField label="Complemento" value={form.address.complement} onChange={setAddr('complement')} fullWidth />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField label="Bairro" value={form.address.neighborhood} onChange={setAddr('neighborhood')} fullWidth />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField label="Cidade" value={form.address.city} onChange={setAddr('city')} fullWidth />
                </Grid>
                <Grid item xs={12} sm={1}>
                  <TextField label="UF" value={form.address.state} onChange={setAddr('state')} fullWidth inputProps={{ maxLength: 2 }} />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
