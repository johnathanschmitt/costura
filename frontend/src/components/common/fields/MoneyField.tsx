import { TextField, InputAdornment, TextFieldProps } from '@mui/material';

/**
 * Campo de dinheiro no padrão brasileiro, com os centavos entrando da direita
 * para a esquerda: digitar 1, 2, 3, 4, 5, 6 mostra 0,01 → 0,12 → 1,23 → 12,34
 * → 123,45 → 1.234,56.
 *
 * É como as maquininhas e os caixas funcionam, e evita o erro clássico de
 * digitar "1234" esperando R$ 1.234,00 e receber R$ 12,34 — ou o contrário.
 *
 * Substitui o `type="number"`, que aceitava ponto decimal, notação científica
 * ("1e5") e mostrava setinhas de incremento, nada disso fazendo sentido aqui.
 */

const MAX_DIGITS = 11; // até 999.999.999,99

const format = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Props = Omit<TextFieldProps, 'value' | 'onChange'> & {
  /** Valor em reais. `null` representa campo vazio. */
  value: number | null;
  onChange: (value: number | null) => void;
};

export default function MoneyField({ value, onChange, InputProps, ...rest }: Props) {
  // Arredonda na entrada para não arrastar imprecisão de ponto flutuante.
  const cents = value === null || value === undefined ? null : Math.round(value * 100);
  const display = cents === null ? '' : format(cents);

  const handle = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, MAX_DIGITS);
    onChange(digits === '' ? null : Number(digits) / 100);
  };

  return (
    <TextField
      {...rest}
      value={display}
      onChange={e => handle(e.target.value)}
      InputProps={{
        ...InputProps,
        startAdornment: <InputAdornment position="start">R$</InputAdornment>,
      }}
      inputProps={{
        inputMode: 'decimal',
        // O cursor fica sempre no fim: a digitação empurra os dígitos.
        onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
          const el = e.target;
          requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
        },
        ...rest.inputProps,
      }}
    />
  );
}
