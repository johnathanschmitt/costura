import { createTheme, Theme } from '@mui/material/styles';
import { ptBR } from '@mui/material/locale';

export function buildTheme(mode: 'light' | 'dark'): Theme {
  const isDark = mode === 'dark';
  return createTheme(
    {
      palette: {
        mode,
        primary: { main: '#7B3F8C', light: '#9C5CAD', dark: '#5A2E68', contrastText: '#fff' },
        secondary: { main: '#E91E8C', contrastText: '#fff' },
        background: {
          default: isDark ? '#121212' : '#F5F4F7',
          paper: isDark ? '#1E1E1E' : '#FFFFFF',
        },
      },
      typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        h5: { fontWeight: 600 },
        h6: { fontWeight: 600 },
      },
      shape: { borderRadius: 10 },
      components: {
        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } },
        },
        MuiCard: {
          styleOverrides: {
            root: { boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.08)' },
          },
        },
        MuiTextField: { defaultProps: { size: 'small', variant: 'outlined' } },
        MuiTableCell: {
          styleOverrides: {
            head: { fontWeight: 600, backgroundColor: isDark ? '#2A2A2A' : '#F5F4F7' },
          },
        },
      },
    },
    ptBR,
  );
}

export default buildTheme('light');
