import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './theme/ThemeProvider';
import { AdminRoute } from './auth/AdminRoute';
import { AdminLayout } from './layout/AdminLayout';
import { ToastProvider } from './components/ui/Toast';
import { DemoPage }               from './pages/DemoPage';
import { DashboardPage }          from './pages/DashboardPage';
import { ApplicationsPage }       from './pages/ApplicationsPage';
import { ApplicationDetailPage }  from './pages/ApplicationDetailPage';
import { MandatesPage }           from './pages/MandatesPage';
import { IncomingPaymentsPage }   from './pages/IncomingPaymentsPage';
import { OutgoingPaymentsPage }   from './pages/OutgoingPaymentsPage';
import { AnalyticsPage }          from './pages/AnalyticsPage';
import { FinancialsPage }         from './pages/FinancialsPage';
import { CreditRulesPage }        from './pages/CreditRulesPage';
import { PortfolioPage }          from './pages/PortfolioPage';
import { LoanBookPage }           from './pages/LoanBookPage';
import { CashLedgerPage }         from './pages/CashLedgerPage';
import { SettingsPage }           from './pages/SettingsPage';
import { CreateApplicationPage }  from './pages/CreateApplicationPage';
import { ArrearsPage }            from './pages/ArrearsPage';
import { CommunicationsPage }     from './pages/CommunicationsPage';
import {
  SACRRAPage, SACRRAValidatorPage, NCRReportingPage,
  NCRRegistersPage, ComplianceTrackerPage, GoAMLPage,
} from './pages/CompliancePage';

const PAGE_TITLES: Record<string, string> = {
  dashboard:          'Dashboard',
  applications:       'Applications',
  'settings/user-management': 'User Management',
  users:              'User Management',
  mandates:           'Mandates',
  'incoming-payments': 'Incoming Payments',
  'outgoing-payments': 'Outgoing Payments',
  analytics:          'Analytics',
  financials:         'Financials',
  'credit-rules':     'Credit Rules',
  portfolio:          'Portfolio',
  'loan-book':        'Loan Book',
  'cash-ledger':      'Cash Ledger',
  settings:           'Settings',
  'create-application': 'New Application',
  sacrra:             'SACRRA',
  'sacrra-validator': 'Migration Validator',
  'ncr-reporting':    'NCR Reporting',
  'ncr-registers':    'NCR Registers',
  'compliance-tracker': 'Compliance Tracker',
  goaml:              'FIC goAML',
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 60_000 } },
});

function AdminShell() {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean);
  const routeKey = parts.join('/') || 'dashboard';
  const title = PAGE_TITLES[routeKey] ?? PAGE_TITLES[parts[0] ?? 'dashboard'] ?? 'Admin';
  return (
    <AdminRoute>
      <AdminLayout title={title}>
        <div key={pathname} style={{ animation: 'pageFadeIn 0.3s cubic-bezier(0.25, 1, 0.5, 1) forwards' }}>
          <Outlet />
        </div>
      </AdminLayout>
    </AdminRoute>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <ToastProvider>
        <BrowserRouter basename="/admin-panel" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/demo" element={<DemoPage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route element={<AdminShell />}>
              <Route path="dashboard"          element={<DashboardPage />} />
              <Route path="applications"       element={<ApplicationsPage />} />
              <Route path="applications/:id"   element={<ApplicationDetailPage />} />
              <Route path="create-application" element={<CreateApplicationPage />} />
              <Route path="settings/user-management" element={<SettingsPage section="user-management" />} />
              <Route path="settings/roles"       element={<SettingsPage section="roles" />} />
              <Route path="settings/permissions" element={<SettingsPage section="permissions" />} />
              <Route path="settings/audit-logs"  element={<SettingsPage section="audit-logs" />} />
              <Route path="users"              element={<Navigate to="/settings/user-management" replace />} />
              <Route path="mandates"           element={<MandatesPage />} />
              <Route path="incoming-payments"  element={<IncomingPaymentsPage />} />
              <Route path="outgoing-payments"  element={<OutgoingPaymentsPage />} />
              <Route path="analytics"          element={<AnalyticsPage />} />
              <Route path="financials"         element={<FinancialsPage />} />
              <Route path="credit-rules"       element={<CreditRulesPage />} />
              <Route path="portfolio"          element={<PortfolioPage />} />
              <Route path="loan-book"          element={<LoanBookPage />} />
              <Route path="cash-ledger"        element={<CashLedgerPage />} />
              <Route path="settings"           element={<SettingsPage />} />
              <Route path="sacrra"             element={<SACRRAPage />} />
              <Route path="sacrra-validator"   element={<SACRRAValidatorPage />} />
              <Route path="ncr-reporting"      element={<NCRReportingPage />} />
              <Route path="ncr-registers"      element={<NCRRegistersPage />} />
              <Route path="compliance-tracker" element={<ComplianceTrackerPage />} />
              <Route path="goaml"              element={<GoAMLPage />} />
              <Route path="arrears"            element={<ArrearsPage />} />
              <Route path="communications"     element={<CommunicationsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
