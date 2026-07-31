import { useState } from 'react';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';

interface Customer { id: string; name: string; phone?: string; email?: string }

interface Props {
  value: Customer | null;
  onChange: (customer: Customer | null) => void;
  required?: boolean;
  error?: boolean;
  helperText?: string;
}

export default function CustomerAutocomplete({ value, onChange, required, error, helperText }: Props) {
  const [inputValue, setInputValue] = useState('');
  const debouncedInput = useDebounce(inputValue, 350);

  const { data, isFetching } = useQuery({
    queryKey: ['customers-search', debouncedInput],
    queryFn: () => api.get('/customers', { params: { search: debouncedInput, limit: 20 } }).then(r => r.data.data),
    enabled: debouncedInput.length > 0,
  });

  return (
    <Autocomplete
      value={value}
      inputValue={inputValue}
      onInputChange={(_, v) => setInputValue(v)}
      onChange={(_, v) => onChange(v)}
      options={(data as Customer[]) ?? []}
      getOptionLabel={o => o.name}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      filterOptions={x => x}
      loading={isFetching}
      noOptionsText={inputValue.length < 2 ? 'Digite para buscar…' : 'Nenhum cliente encontrado'}
      renderInput={params => (
        <TextField
          {...params}
          label="Cliente"
          required={required}
          error={error}
          helperText={helperText ?? (value?.phone ? `Telefone: ${value.phone}` : '')}
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
            {option.phone && <div style={{ fontSize: 12, color: '#666' }}>{option.phone}</div>}
          </div>
        </li>
      )}
    />
  );
}
