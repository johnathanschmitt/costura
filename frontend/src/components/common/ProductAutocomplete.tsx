import { useState } from 'react';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';

export interface Product {
  id: string;
  name: string;
  sku?: string | null;
  unit?: string;
  costPrice?: string | number | null;
}

interface Props {
  value: Product | null;
  onChange: (product: Product | null) => void;
  label?: string;
  required?: boolean;
  error?: boolean;
  helperText?: string;
}

export default function ProductAutocomplete({
  value, onChange, label = 'Produto', required, error, helperText,
}: Props) {
  const [inputValue, setInputValue] = useState('');
  const debouncedInput = useDebounce(inputValue, 350);

  const { data, isFetching } = useQuery({
    queryKey: ['products-search', debouncedInput],
    // /products devolve o array direto, sem envelope de paginação.
    queryFn: () => api.get('/products', { params: { search: debouncedInput } }).then(r => r.data),
    enabled: debouncedInput.length > 0,
  });

  return (
    <Autocomplete
      value={value}
      inputValue={inputValue}
      onInputChange={(_, v) => setInputValue(v)}
      onChange={(_, v) => onChange(v)}
      options={(data as Product[]) ?? []}
      getOptionLabel={o => o.name}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      filterOptions={x => x}
      loading={isFetching}
      noOptionsText={inputValue.length < 1 ? 'Digite para buscar…' : 'Nenhum produto encontrado'}
      renderInput={params => (
        <TextField
          {...params}
          label={label}
          required={required}
          error={error}
          helperText={helperText ?? (value?.unit ? `Unidade: ${value.unit}` : '')}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {isFetching && <CircularProgress size={16} />}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <div>
            <div style={{ fontWeight: 500 }}>{option.name}</div>
            {option.sku && <div style={{ fontSize: 12, color: '#666' }}>SKU: {option.sku}</div>}
          </div>
        </li>
      )}
    />
  );
}
