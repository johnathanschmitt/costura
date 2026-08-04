import { useState, useEffect } from 'react';
import {
  Box, Drawer, AppBar, Toolbar, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Typography, IconButton, Avatar,
  Divider, Tooltip, Collapse, useMediaQuery, useTheme,
} from '@mui/material';
import {
  Dashboard, People, RequestQuote, Assignment, CalendarMonth,
  Inventory2, AccountBalance, Menu as MenuIcon,
  Logout, ChevronLeft, ContentCut,
  ExpandLess, ExpandMore, MiscellaneousServices, Category, BarChart, Settings,
  CheckroomOutlined,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import NotificationBell from './NotificationBell';
import SearchBar from './SearchBar';

const DRAWER_WIDTH = 240;

const navItems = [
  { label: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
  { label: 'Clientes', icon: <People />, path: '/customers' },
  { label: 'Orçamentos', icon: <RequestQuote />, path: '/quotes' },
  { label: 'Ordens de Serviço', icon: <Assignment />, path: '/work-orders' },
  { label: 'Agenda', icon: <CalendarMonth />, path: '/schedule' },
  { label: 'Estoque', icon: <Inventory2 />, path: '/inventory' },
  // O financeiro só aparece para quem tem permissão de leitura. Esconder é só
  // UX: o backend recusa a chamada de quem não pode, de qualquer jeito.
  { label: 'Financeiro', icon: <AccountBalance />, path: '/financial', permission: 'read:financial' },
  { label: 'Relatórios', icon: <BarChart />, path: '/reports' },
  { label: 'Configurações', icon: <Settings />, path: '/settings' },
  {
    label: 'Catálogo',
    icon: <ContentCut />,
    path: '/catalog',
    children: [
      { label: 'Serviços', icon: <MiscellaneousServices />, path: '/catalog/services' },
      { label: 'Produtos', icon: <Category />, path: '/catalog/products' },
      { label: 'Peças', icon: <CheckroomOutlined />, path: '/catalog/garments' },
    ],
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  // No celular o menu não pode ocupar espaço fixo: vira gaveta sobreposta, que
  // começa fechada e se fecha sozinha ao navegar.
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [open, setOpen] = useState(!isMobile);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  /**
   * Sessão antiga (gravada antes de as permissões existirem no login) não tem a
   * lista: nesse caso o item aparece, e quem barra é o backend. Esconder um
   * módulo de quem tem acesso seria pior do que mostrar um que dá 403.
   */
  const canSee = (item: { permission?: string }) =>
    !item.permission || !user?.permissions || user.permissions.includes(item.permission);

  // Ao girar o aparelho ou redimensionar, o menu acompanha o formato da tela.
  useEffect(() => { setOpen(!isMobile); }, [isMobile]);

  const go = (path: string) => {
    navigate(path);
    if (isMobile) setOpen(false);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: t => t.zIndex.drawer + 1, bgcolor: 'primary.main' }}>
        <Toolbar sx={{ gap: 1 }}>
          <IconButton color="inherit" onClick={() => setOpen(o => !o)} edge="start">
            {open ? <ChevronLeft /> : <MenuIcon />}
          </IconButton>
          <Typography variant="h6" sx={{ flexShrink: 0, display: { xs: 'none', sm: 'block' } }}>Ateliê</Typography>

          <SearchBar />

          <NotificationBell />
          <Tooltip title="Sair">
            <IconButton color="inherit" onClick={logout}><Logout /></IconButton>
          </Tooltip>
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main', fontSize: 14 }}>
            {user?.name?.charAt(0).toUpperCase()}
          </Avatar>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isMobile ? 'temporary' : 'persistent'}
        open={open}
        onClose={() => setOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: open && !isMobile ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            // Na gaveta sobreposta o menu começa no topo, sem o vão do AppBar.
            mt: isMobile ? 0 : '64px',
          },
        }}
      >
        <Box sx={{ overflow: 'auto', py: 1 }}>
          <List dense>
            {navItems.filter(canSee).map(item => {
              const active = location.pathname.startsWith(item.path);
              if (item.children) {
                return (
                  <Box key={item.path}>
                    <ListItem disablePadding>
                      <ListItemButton
                        onClick={() => setCatalogOpen(o => !o)}
                        sx={{ mx: 1, borderRadius: 2 }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                        <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14 }} />
                        {catalogOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                      </ListItemButton>
                    </ListItem>
                    <Collapse in={catalogOpen}>
                      <List dense disablePadding>
                        {item.children.map(child => {
                          const childActive = location.pathname.startsWith(child.path);
                          return (
                            <ListItem key={child.path} disablePadding>
                              <ListItemButton
                                onClick={() => go(child.path)}
                                selected={childActive}
                                sx={{
                                  mx: 1, pl: 4, borderRadius: 2,
                                  '&.Mui-selected': { bgcolor: 'primary.main', color: 'white', '& .MuiListItemIcon-root': { color: 'white' } },
                                }}
                              >
                                <ListItemIcon sx={{ minWidth: 32 }}>{child.icon}</ListItemIcon>
                                <ListItemText primary={child.label} primaryTypographyProps={{ fontSize: 13 }} />
                              </ListItemButton>
                            </ListItem>
                          );
                        })}
                      </List>
                    </Collapse>
                  </Box>
                );
              }
              return (
                <ListItem key={item.path} disablePadding>
                  <ListItemButton
                    onClick={() => go(item.path)}
                    selected={active}
                    sx={{
                      mx: 1, borderRadius: 2,
                      '&.Mui-selected': { bgcolor: 'primary.main', color: 'white', '& .MuiListItemIcon-root': { color: 'white' } },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14 }} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="caption" color="text.secondary">{user?.name}</Typography>
            <Typography variant="caption" display="block" color="text.disabled">{user?.role}</Typography>
          </Box>
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          // Sem `minWidth: 0` um item de flex não encolhe abaixo do próprio
          // conteúdo: uma tela larga (o quadro de OS, uma tabela grande) empurra
          // o layout inteiro e cria rolagem horizontal na página.
          minWidth: 0,
          p: { xs: 1.5, sm: 3 },
          mt: '64px',
          bgcolor: 'background.default',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
