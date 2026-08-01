import { Transform } from 'class-transformer';

/**
 * Trata string vazia como filtro ausente.
 *
 * Um `<Select>` sem seleção manda `?status=`, e o axios envia a string vazia.
 * Sem isto, `@IsEnum`/`@IsDateString` rejeitam o valor e a listagem inteira
 * volta 400 — o filtro "Todos" quebraria a tela. Aplicar em todo filtro
 * opcional de query.
 */
export const EmptyToUndefined = () =>
  Transform(({ value }) => (value === '' || value === null ? undefined : value));
