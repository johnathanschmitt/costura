import { useState } from 'react';
import {
  Box, Typography, Button, TextField, Grid, Card, CardContent,
  CardActions, CardMedia, Chip, IconButton, InputAdornment,
  Select, MenuItem, FormControl, InputLabel, Skeleton, Tooltip,
  ToggleButton, ToggleButtonGroup, alpha, useTheme,
} from '@mui/material';
import {
  Add, Search, Edit, Delete, GridView, TableRows,
  CheckroomOutlined,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import ConfirmDialog from '../../components/common/ConfirmDialog';

export const CATEGORIES = [
  'Vestido', 'Blusa / Camisa', 'Calça', 'Saia', 'Casaco / Jaqueta',
  'Conjunto', 'Roupa Infantil', 'Moda Festa', 'Moda Praia', 'Outro',
];

export const CATEGORY_COLOR: Record<string, string> = {
  'Vestido': '#7B3F8C',
  'Blusa / Camisa': '#2a78d6',
  'Calça': '#eb6834',
  'Saia': '#e87ba4',
  'Casaco / Jaqueta': '#1baf7a',
  'Conjunto': '#eda100',
  'Roupa Infantil': '#e34948',
  'Moda Festa': '#4a3aa7',
  'Moda Praia': '#1baf7a',
  'Outro': '#898781',
};

function GarmentCard({ garment, onEdit, onDelete }: { garment: any; onEdit: () => void; onDelete: () => void }) {
  const theme = useTheme();
  const color = CATEGORY_COLOR[garment.category] ?? '#898781';

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        opacity: garment.active ? 1 : 0.55,
        transition: 'box-shadow 0.15s',
        '&:hover': { boxShadow: 3 },
      }}
    >
      {garment.imageUrl ? (
        <CardMedia
          component="img"
          height={160}
          image={garment.imageUrl}
          alt={garment.name}
          sx={{ objectFit: 'cover' }}
        />
      ) : (
        <Box
          sx={{
            height: 160,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(color, 0.08),
            borderBottom: `3px solid ${alpha(color, 0.3)}`,
          }}
        >
          <CheckroomOutlined sx={{ fontSize: 64, color: alpha(color, 0.35) }} />
        </Box>
      )}

      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1.3 }}>
            {garment.name}
          </Typography>
          {!garment.active && <Chip label="Inativo" size="small" sx={{ ml: 1, flexShrink: 0 }} />}
        </Box>
        {garment.category && (
          <Chip
            label={garment.category}
            size="small"
            sx={{ mb: 1, bgcolor: alpha(color, 0.12), color, fontWeight: 500, border: 'none' }}
          />
        )}
        {garment.description && (
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {garment.description}
          </Typography>
        )}
      </CardContent>

      <CardActions sx={{ justifyContent: 'flex-end', pt: 0, px: 1.5, pb: 1 }}>
        <Tooltip title="Editar">
          <IconButton size="small" onClick={onEdit}><Edit fontSize="small" /></IconButton>
        </Tooltip>
        <Tooltip title="Excluir">
          <IconButton size="small" color="error" onClick={onDelete}><Delete fontSize="small" /></IconButton>
        </Tooltip>
      </CardActions>
    </Card>
  );
}

export default function GarmentsPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [active, setActive] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const debouncedSearch = useDebounce(search, 400);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['garments', debouncedSearch, category, active],
    queryFn: () => api.get('/garments', { params: { search: debouncedSearch, category, active } }).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/garments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garments'] });
      setDeleteTarget(null);
    },
  });

  const garments: any[] = data?.data ?? [];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Catálogo de Peças</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/catalog/garments/new')}>
          Nova Peça
        </Button>
      </Box>

      {/* Filtros */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Buscar por nome ou descrição…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          size="small"
          sx={{ flex: 1, minWidth: 200 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Categoria</InputLabel>
          <Select value={category} label="Categoria" onChange={e => setCategory(e.target.value)}>
            <MenuItem value="">Todas</MenuItem>
            {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Status</InputLabel>
          <Select value={active} label="Status" onChange={e => setActive(e.target.value)}>
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="true">Ativo</MenuItem>
            <MenuItem value="false">Inativo</MenuItem>
          </Select>
        </FormControl>
        <ToggleButtonGroup
          size="small"
          value={viewMode}
          exclusive
          onChange={(_, v) => v && setViewMode(v)}
        >
          <ToggleButton value="grid"><GridView fontSize="small" /></ToggleButton>
          <ToggleButton value="list"><TableRows fontSize="small" /></ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Contagem */}
      {!isLoading && (
        <Typography variant="caption" color="text.secondary" mb={2} display="block">
          {data?.total ?? 0} peça(s) encontrada(s)
        </Typography>
      )}

      {/* Grid */}
      {isLoading ? (
        <Grid container spacing={2}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Grid item key={i} xs={12} sm={6} md={4} lg={3}>
              <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      ) : garments.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CheckroomOutlined sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography color="text.secondary">Nenhuma peça encontrada</Typography>
          <Button variant="outlined" sx={{ mt: 2 }} onClick={() => navigate('/catalog/garments/new')}>
            Cadastrar primeira peça
          </Button>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {garments.map(g => (
            <Grid item key={g.id} xs={12} sm={viewMode === 'grid' ? 6 : 12} md={viewMode === 'grid' ? 4 : 12} lg={viewMode === 'grid' ? 3 : 12}>
              {viewMode === 'grid' ? (
                <GarmentCard
                  garment={g}
                  onEdit={() => navigate(`/catalog/garments/${g.id}/edit`)}
                  onDelete={() => setDeleteTarget(g)}
                />
              ) : (
                <Card variant="outlined" sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, opacity: g.active ? 1 : 0.55 }}>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" fontWeight={600}>{g.name}</Typography>
                    {g.description && <Typography variant="caption" color="text.secondary">{g.description}</Typography>}
                  </Box>
                  {g.category && (
                    <Chip label={g.category} size="small" sx={{ mr: 2 }} />
                  )}
                  {!g.active && <Chip label="Inativo" size="small" sx={{ mr: 2 }} />}
                  <IconButton size="small" onClick={() => navigate(`/catalog/garments/${g.id}/edit`)}><Edit fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => setDeleteTarget(g)}><Delete fontSize="small" /></IconButton>
                </Card>
              )}
            </Grid>
          ))}
        </Grid>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir peça"
        message={`Deseja excluir "${deleteTarget?.name}"?`}
        confirmColor="error"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
      />
    </Box>
  );
}
