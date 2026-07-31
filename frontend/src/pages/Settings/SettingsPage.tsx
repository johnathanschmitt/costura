import { useState } from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import { Group, Shield, Person, History, Store } from '@mui/icons-material';
import UsersTab from './UsersTab';
import RolesTab from './RolesTab';
import ProfileTab from './ProfileTab';
import AuditTab from './AuditTab';
import BusinessInfoTab from './BusinessInfoTab';

interface TabPanelProps { children: React.ReactNode; value: number; index: number }
function TabPanel({ children, value, index }: TabPanelProps) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

export default function SettingsPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>Configurações</Typography>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab icon={<Store fontSize="small" />} iconPosition="start" label="Negócio" />
          <Tab icon={<Group fontSize="small" />} iconPosition="start" label="Usuários" />
          <Tab icon={<Shield fontSize="small" />} iconPosition="start" label="Perfis" />
          <Tab icon={<Person fontSize="small" />} iconPosition="start" label="Minha conta" />
          <Tab icon={<History fontSize="small" />} iconPosition="start" label="Auditoria" />
        </Tabs>
      </Box>
      <TabPanel value={tab} index={0}><BusinessInfoTab /></TabPanel>
      <TabPanel value={tab} index={1}><UsersTab /></TabPanel>
      <TabPanel value={tab} index={2}><RolesTab /></TabPanel>
      <TabPanel value={tab} index={3}><ProfileTab /></TabPanel>
      <TabPanel value={tab} index={4}><AuditTab /></TabPanel>
    </Box>
  );
}
