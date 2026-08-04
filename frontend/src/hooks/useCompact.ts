import { useMediaQuery, useTheme } from '@mui/material';

/**
 * Abaixo de `md` a tela é um telefone, e telefone é onde ela está: no balcão,
 * de pé, com a cliente esperando. Tabela de cinco colunas ali vira rolagem
 * horizontal — cada linha precisa virar um cartão.
 *
 * Fica num hook só para as telas concordarem sobre onde é "estreito".
 */
export const useCompact = () => useMediaQuery(useTheme().breakpoints.down('md'));
