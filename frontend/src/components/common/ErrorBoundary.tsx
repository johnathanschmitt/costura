import { Component, ReactNode } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { BugReport } from '@mui/icons-material';

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', p: 3 }}>
        <Paper variant="outlined" sx={{ p: 5, maxWidth: 480, textAlign: 'center' }}>
          <BugReport sx={{ fontSize: 56, color: 'error.main', mb: 2 }} />
          <Typography variant="h6" fontWeight={700} mb={1}>Algo deu errado</Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>{this.state.message}</Typography>
          <Button variant="contained" onClick={() => window.location.reload()}>
            Recarregar página
          </Button>
        </Paper>
      </Box>
    );
  }
}
