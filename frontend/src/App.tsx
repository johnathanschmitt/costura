import { ThemeProvider, CssBaseline } from '@mui/material';
import { Routes, Route, Navigate } from 'react-router-dom';
import theme from './theme/theme';
import { useAuthStore } from './store/auth.store';
import Layout from './components/Layout/Layout';
import LoginPage from './pages/Login/LoginPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import CustomersPage from './pages/Customers/CustomersPage';
import CustomerFormPage from './pages/Customers/CustomerFormPage';
import QuotesPage from './pages/Quotes/QuotesPage';
import QuoteFormPage from './pages/Quotes/QuoteFormPage';
import QuotePrintPage from './pages/Quotes/QuotePrintPage';
import PublicQuotePage from './pages/Quotes/PublicQuotePage';
import WorkOrdersPage from './pages/WorkOrders/WorkOrdersPage';
import WorkOrderFormPage from './pages/WorkOrders/WorkOrderFormPage';
import WorkOrderReceiptPage from './pages/WorkOrders/WorkOrderReceiptPage';
import SchedulePage from './pages/Schedule/SchedulePage';
import InventoryPage from './pages/Inventory/InventoryPage';
import FinancialPage from './pages/Financial/FinancialPage';
import CashClosingReportPage from './pages/Financial/CashClosingReportPage';
import PaymentReceiptPage from './pages/Financial/PaymentReceiptPage';
import MonthlyClosingPage from './pages/Financial/MonthlyClosingPage';
import DistributionPrintPage from './pages/Financial/DistributionPrintPage';
import ServicesPage from './pages/Catalog/ServicesPage';
import ServiceFormPage from './pages/Catalog/ServiceFormPage';
import ProductsPage from './pages/Catalog/ProductsPage';
import ProductFormPage from './pages/Catalog/ProductFormPage';
import ReportsPage from './pages/Reports/ReportsPage';
import SettingsPage from './pages/Settings/SettingsPage';
import GarmentsPage from './pages/Garments/GarmentsPage';
import GarmentFormPage from './pages/Garments/GarmentFormPage';
import NotFoundPage from './pages/NotFound/NotFoundPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/orcamento/:token" element={<PublicQuotePage />} />
        <Route path="/quotes/:id/print" element={<PrivateRoute><QuotePrintPage /></PrivateRoute>} />
        <Route path="/work-orders/:id/receipt" element={<PrivateRoute><WorkOrderReceiptPage /></PrivateRoute>} />
        <Route path="/financial/cash-register/:id/report" element={<PrivateRoute><CashClosingReportPage /></PrivateRoute>} />
        <Route path="/financial/payments/:id/receipt" element={<PrivateRoute><PaymentReceiptPage /></PrivateRoute>} />
        <Route path="/financial/fechamento/:month" element={<PrivateRoute><MonthlyClosingPage /></PrivateRoute>} />
        <Route path="/financial/divisao/:month" element={<PrivateRoute><DistributionPrintPage /></PrivateRoute>} />
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <Layout>
                <Routes>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="customers" element={<CustomersPage />} />
                  <Route path="customers/new" element={<CustomerFormPage />} />
                  <Route path="customers/:id/edit" element={<CustomerFormPage />} />
                  <Route path="quotes" element={<QuotesPage />} />
                  <Route path="quotes/new" element={<QuoteFormPage />} />
                  <Route path="quotes/:id/edit" element={<QuoteFormPage />} />
                  <Route path="work-orders" element={<WorkOrdersPage />} />
                  <Route path="work-orders/new" element={<WorkOrderFormPage />} />
                  <Route path="work-orders/:id/edit" element={<WorkOrderFormPage />} />
                  <Route path="schedule" element={<SchedulePage />} />
                  <Route path="inventory" element={<InventoryPage />} />
                  <Route path="financial/*" element={<FinancialPage />} />
                  <Route path="catalog/services" element={<ServicesPage />} />
                  <Route path="catalog/services/new" element={<ServiceFormPage />} />
                  <Route path="catalog/services/:id/edit" element={<ServiceFormPage />} />
                  <Route path="catalog/products" element={<ProductsPage />} />
                  <Route path="catalog/products/new" element={<ProductFormPage />} />
                  <Route path="catalog/products/:id/edit" element={<ProductFormPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="catalog/garments" element={<GarmentsPage />} />
                  <Route path="catalog/garments/new" element={<GarmentFormPage />} />
                  <Route path="catalog/garments/:id/edit" element={<GarmentFormPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Layout>
            </PrivateRoute>
          }
        />
      </Routes>
    </ThemeProvider>
  );
}
