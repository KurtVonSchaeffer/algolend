import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './theme/ThemeProvider';
import { AdminRoute } from './auth/AdminRoute';
import { AdminLayout } from './layout/AdminLayout';
import { DashboardPage }          from './pages/DashboardPage';
import { ApplicationsPage }       from './pages/ApplicationsPage';
import { ApplicationDetailPage }  from './pages/ApplicationDetailPage';
import { UsersPage }              from './pages/UsersPage';
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
import {
  SACRRAPage, SACRRAValidatorPage, NCRReportingPage,
  NCRRegistersPage, ComplianceTrackerPage, GoAMLPage,
} from './pages/CompliancePage';

const PAGE_TITLES: Record<string, string> = {
  dashboard:          'Dashboard',
  applications:       'Applications',
  users:              'Users',
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
  const { pathname } = { pathname: typeof window !== 'undefined' ? window.location.pathname : '' };
  const seg = pathname.split('/').filter(Boolean)[1] ?? 'dashboard';
  const title = PAGE_TITLES[seg] ?? 'Admin';
  return (
    <AdminRoute>
      <AdminLayout title={title}>
        <Outlet />
      </AdminLayout>
    </AdminRoute>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin" element={<AdminShell />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard"          element={<DashboardPage />} />
              <Route path="applications"       element={<ApplicationsPage />} />
              <Route path="applications/:id"   element={<ApplicationDetailPage />} />
              <Route path="create-application" element={<CreateApplicationPage />} />
              <Route path="users"              element={<UsersPage />} />
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
            </Route>
            <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
