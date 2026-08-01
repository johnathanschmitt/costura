import { forwardRef } from 'react';
import { TextField, TextFieldProps } from '@mui/material';
import { IMaskInput } from 'react-imask';

/**
 * Campos com formato fixo. Todos guardam o valor **já formatado** — é assim que
 * o telefone e o CPF sempre foram salvos no banco, e é assim que aparecem nos
 * documentos impressos. O backend normaliza o telefone quando precisa (o envio
 * por WhatsApp tira a máscara antes de montar o link).
 */

function maskInput(mask: any, extra: Record<string, unknown> = {}) {
  return forwardRef<HTMLInputElement, any>(function Masked(props, ref) {
    const { onChange, ...other } = props;
    return (
      <IMaskInput
        {...other}
        {...extra}
        mask={mask}
        inputRef={ref}
        onAccept={(value: string) => onChange(value)}
        overwrite
      />
    );
  });
}

// Fixo e celular convivem: a máscara escolhe pelo comprimento digitado.
const PhoneMask = maskInput([
  { mask: '(00) 0000-0000' },
  { mask: '(00) 00000-0000' },
]);

// CPF vira CNPJ ao passar de 11 dígitos.
const DocumentMask = maskInput([
  { mask: '000.000.000-00', maxLength: 11 },
  { mask: '00.000.000/0000-00' },
]);

const CepMask = maskInput('00000-000');

type Props = Omit<TextFieldProps, 'value' | 'onChange'> & {
  value: string;
  onChange: (value: string) => void;
};

function build(Mask: any, defaults: Partial<TextFieldProps> = {}) {
  return function Field({ value, onChange, InputProps, ...rest }: Props) {
    return (
      <TextField
        {...defaults}
        {...rest}
        value={value ?? ''}
        onChange={undefined}
        InputProps={{
          ...InputProps,
          inputComponent: Mask,
          onChange: ((v: unknown) => onChange(String(v ?? ''))) as any,
        }}
        inputProps={{ inputMode: 'numeric', ...rest.inputProps }}
      />
    );
  };
}

export const PhoneField = build(PhoneMask, { placeholder: '(11) 98765-4321' });
export const DocumentField = build(DocumentMask, { placeholder: '000.000.000-00' });
export const CepField = build(CepMask, { placeholder: '00000-000' });

/**
 * Quantidade com vírgula decimal. Aceita fração porque estoque de tecido é
 * medido em metros — "2,5 m" é entrada legítima.
 */
const QuantityMask = forwardRef<HTMLInputElement, any>(function QuantityMask(props, ref) {
  const { onChange, ...other } = props;
  return (
    <IMaskInput
      {...other}
      mask={Number}
      scale={3}
      radix=","
      mapToRadix={['.']}
      thousandsSeparator=""
      normalizeZeros={false}
      min={0}
      inputRef={ref}
      onAccept={(_v: string, mask: any) => onChange(mask.unmaskedValue)}
    />
  );
});

type NumProps = Omit<TextFieldProps, 'value' | 'onChange'> & {
  value: number | null;
  onChange: (value: number | null) => void;
};

export function QuantityField({ value, onChange, InputProps, ...rest }: NumProps) {
  return (
    <TextField
      {...rest}
      value={value === null || value === undefined ? '' : String(value)}
      onChange={undefined}
      InputProps={{
        ...InputProps,
        inputComponent: QuantityMask as any,
        onChange: ((raw: unknown) => {
          const text = String(raw ?? '');
          onChange(text === '' ? null : Number(text));
        }) as any,
      }}
      inputProps={{ inputMode: 'decimal', ...rest.inputProps }}
    />
  );
}

/**
 * E-mail não tem máscara — formato livre demais. O que dá para fazer é validar
 * e avisar assim que a pessoa sai do campo, em vez de deixar salvar errado.
 */
export function EmailField({ value, onChange, helperText, ...rest }: Props & { helperText?: string }) {
  const invalid = value.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  return (
    <TextField
      {...rest}
      type="email"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      error={invalid || rest.error}
      helperText={invalid ? 'E-mail incompleto — falta algo como "nome@provedor.com"' : helperText}
      inputProps={{ inputMode: 'email', autoCapitalize: 'none', ...rest.inputProps }}
    />
  );
}
