import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';

type Props = {
  type: 'INCOME' | 'EXPENSE';
  value: string;
  onChange: (value: string) => void;
  label?: string;
  /** Opção vazia no topo — usada nos filtros ("Todas"). */
  emptyLabel?: string;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  required?: boolean;
};

/**
 * Seletor único de categoria, alimentado pela tabela de categorias.
 *
 * Antes cada tela tinha a sua lista: contas a pagar traziam uma lista fixa no
 * código ("Material", "Energia") e o caixa aceitava texto livre. Como o DRE
 * agrupa pelo nome, "Material" e "Materiais" viravam duas linhas diferentes.
 */
export default function CategorySelect({
  type, value, onChange, label = 'Categoria', emptyLabel,
  size = 'small', fullWidth = true, required = false,
}: Props) {
  const { data: categories = [] } = useQuery({
    queryKey: ['financial-categories', type],
    queryFn: () => api.get('/financial/categories', { params: { type } }).then(r => r.data),
    staleTime: 5 * 60_000,
  });

  const active = (categories as any[]).filter(c => c.active || c.name === value);

  return (
    <FormControl size={size} fullWidth={fullWidth} required={required}>
      <InputLabel>{label}</InputLabel>
      <Select value={value} label={label} onChange={e => onChange(e.target.value)}>
        {emptyLabel !== undefined && <MenuItem value="">{emptyLabel}</MenuItem>}
        {active.map(c => (
          <MenuItem key={c.id} value={c.name}>
            {c.name}
            {c.isFixed && type === 'EXPENSE' ? ' · fixa' : ''}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
