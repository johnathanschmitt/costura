import { useState } from 'react';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';

interface WorkOrder { id: string; number: string; status: string }

interface Props {
  value: WorkOrder | null;
  onChange: (wo: WorkOrder | null) => void;
  customerId?: string;
  disabled?: boolean;
}

export default function WorkOrderAutocomplete({ value, onChange, customerId, disabled }: Props) {
  const [input, setInput] = useState('');
  const debouncedInput = useDebounce(input, 350);

  const { data, isFetching } = useQuery({
    queryKey: ['wo-search', debouncedInput, customerId],
    queryFn: () =>
      api.get('/work-orders', {
        params: { search: debouncedInput || undefined, limit: 20 },
      }).then(r =>
        customerId
          ? r.data.data.filter((w: any) => w.customerId === customerId)
          : r.data.data,
      ),
    enabled: !disabled,
  });

  return (
    <Autocomplete
      value={value}
      inputValue={input}
      onInputChange={(_, v) => setInput(v)}
      onChange={(_, v) => onChange(v)}
      options={(data as WorkOrder[]) ?? []}
      getOptionLabel={o => o.number}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      filterOptions={x => x}
      loading={isFetching}
      disabled={disabled}
      noOptionsText="Nenhuma OS encontrada"
      renderInput={p => (
        <TextField
          {...p}
          label="Ordem de Serviço (opcional)"
          InputProps={{
            ...p.InputProps,
            endAdornment: (
              <>
                {isFetching && <CircularProgress size={16} />}
                {p.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <strong>{option.number}</strong>&nbsp;
          <span style={{ color: '#888', fontSize: 13 }}>— {option.status}</span>
        </li>
      )}
    />
  );
}
