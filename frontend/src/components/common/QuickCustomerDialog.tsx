import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Alert,
} from '@mui/material';
import { PhoneField, EmailField } from './fields/MaskedFields';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useToast } from '../../store/toast.store';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Recebe a cliente recém-criada, já pronta para virar a seleção do formulário. */
  onCreated: (customer: any) => void;
  initialName?: string;
}

/**
 * Cadastro mínimo para não interromper o atendimento: só o nome é obrigatório.
 * O restante da ficha se completa depois, em Clientes.
 */
export default function QuickCustomerDialog({ open, onClose, onCreated, initialName }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setName(initialName ?? ''); setPhone(''); setEmail(''); setError(''); }
  }, [open, initialName]);

  const mutation = useMutation({
    mutationFn: () => api.post('/customers', {
      name: name.trim(),
      phone: phone || undefined,
      email: email || undefined,
    }),
    onSuccess: res => {
      qc.invalidateQueries({ queryKey: ['customers-search'] });
      toast('Cliente cadastrada');
      onCreated(res.data);
      onClose();
    },
    onError: (e: any) => {
      const m = e?.response?.data?.message;
      setError(Array.isArray(m) ? m.join('. ') : m ?? 'Erro ao cadastrar a cliente');
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Nova Cliente</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="Nome completo"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          autoFocus
          fullWidth
        />
        <PhoneField label="Telefone" value={phone} onChange={setPhone} fullWidth />
        <EmailField label="E-mail" value={email} onChange={setEmail} fullWidth />
        <Alert severity="info">
          O cadastro completo — medidas, endereço e observações — pode ser preenchido depois.
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() => mutation.mutate()}
          disabled={!name.trim() || mutation.isPending}
        >
          Cadastrar e usar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
