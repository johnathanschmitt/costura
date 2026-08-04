import { Box, Tabs, Tab, Typography } from '@mui/material';
import { Group, Shield, Person, History, Store, Category, WhatsApp, Savings } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import FinancialSettingsTab from './FinancialSettingsTab';
import UsersTab from './UsersTab';
import RolesTab from './RolesTab';
import ProfileTab from './ProfileTab';
import AuditTab from './AuditTab';
import BusinessInfoTab from './BusinessInfoTab';
import CategoriesTab from './CategoriesTab';
import WhatsAppTemplateTab from './WhatsAppTemplateTab';

interface TabPanelProps { children: React.ReactNode; value: number; index: number }
function TabPanel({ children, value, index }: TabPanelProps) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

/**
 * A aba vive no hash da URL para que outras telas possam mandar a usuária
 * direto ao ajuste que falta — o checklist do painel aponta para cá, e "vá em
 * Configurações e procure a aba certa" não é um link.
 */
const TABS = ['negocio', 'usuarios', 'perfis', 'minha-conta', 'categorias', 'financeiro', 'whatsapp', 'auditoria'];

export default function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const fromHash = TABS.indexOf(location.hash.replace('#', ''));
  const tab = fromHash >= 0 ? fromHash : 0;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>Configurações</Typography>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v) => navigate(`#${TABS[v]}`, { replace: true })}>
          <Tab icon={<Store fontSize="small" />} iconPosition="start" label="Negócio" />
          <Tab icon={<Group fontSize="small" />} iconPosition="start" label="Usuários" />
          <Tab icon={<Shield fontSize="small" />} iconPosition="start" label="Perfis" />
          <Tab icon={<Person fontSize="small" />} iconPosition="start" label="Minha conta" />
          <Tab icon={<Category fontSize="small" />} iconPosition="start" label="Categorias" />
          <Tab icon={<Savings fontSize="small" />} iconPosition="start" label="Financeiro" />
          <Tab icon={<WhatsApp fontSize="small" />} iconPosition="start" label="Mensagem WhatsApp" />
          <Tab icon={<History fontSize="small" />} iconPosition="start" label="Auditoria" />
        </Tabs>
      </Box>
      <TabPanel value={tab} index={0}><BusinessInfoTab /></TabPanel>
      <TabPanel value={tab} index={1}><UsersTab /></TabPanel>
      <TabPanel value={tab} index={2}><RolesTab /></TabPanel>
      <TabPanel value={tab} index={3}><ProfileTab /></TabPanel>
      <TabPanel value={tab} index={4}><CategoriesTab /></TabPanel>
      <TabPanel value={tab} index={5}><FinancialSettingsTab /></TabPanel>
      <TabPanel value={tab} index={6}><WhatsAppTemplateTab /></TabPanel>
      <TabPanel value={tab} index={7}><AuditTab /></TabPanel>
    </Box>
  );
}
