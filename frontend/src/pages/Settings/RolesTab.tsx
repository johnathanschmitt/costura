import {
  Box, CircularProgress, Alert, Typography,
  Accordion, AccordionSummary, AccordionDetails,
  Chip, Grid,
} from '@mui/material';
import { ExpandMore, Group } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';

const ACTION_LABEL: Record<string, string> = {
  create: 'Criar', read: 'Visualizar', update: 'Editar', delete: 'Excluir',
  approve: 'Aprovar', manage: 'Gerenciar',
};

const RESOURCE_LABEL: Record<string, string> = {
  customers: 'Clientes', quotes: 'Orçamentos', 'work-orders': 'Ordens de Serviço',
  schedule: 'Agenda', financial: 'Financeiro', inventory: 'Estoque',
  catalog: 'Catálogo', reports: 'Relatórios', settings: 'Configurações',
};

export default function RolesTab() {
  const { data: roles = [], isLoading, error } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/settings/roles').then(r => r.data),
  });

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">Erro ao carregar perfis</Alert>;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Perfis são configurados pelo administrador do sistema. As permissões abaixo são somente leitura.
      </Typography>

      {(roles as any[]).map((role: any) => (
        <Accordion key={role.id} variant="outlined" sx={{ mb: 1, '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
              <Group color="primary" fontSize="small" />
              <Typography fontWeight={600}>{role.name}</Typography>
              {role.description && (
                <Typography variant="caption" color="text.secondary">{role.description}</Typography>
              )}
              <Chip
                label={`${role._count?.users ?? 0} usuário(s)`}
                size="small"
                sx={{ ml: 'auto', mr: 1 }}
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={1}>
              {(role.permissions as any[]).map((rp: any, i: number) => {
                const action = ACTION_LABEL[rp.permission.action] ?? rp.permission.action;
                const resource = RESOURCE_LABEL[rp.permission.resource] ?? rp.permission.resource;
                return (
                  <Grid item key={i}>
                    <Chip
                      label={`${action}: ${resource}`}
                      size="small"
                      variant="outlined"
                      color="primary"
                    />
                  </Grid>
                );
              })}
              {role.permissions.length === 0 && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">Nenhuma permissão configurada</Typography>
                </Grid>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}
