import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './theme/ThemeProvider';
import { AuthPage } from './auth/AuthPage';
import { SetPasswordPage } from './auth/SetPasswordPage';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { PortalLayout } from './layout/PortalLayout';
import { DashboardPage } from './pages/DashboardPage';
import { LoanCalculatorPage } from './pages/LoanCalculatorPage';
import { SupportPage } from './pages/SupportPage';
import { TranscriptsPage } from './pages/TranscriptsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { ProfilePage } from './pages/ProfilePage';
import { ApplyLoanPage } from './pages/ApplyLoanPage';
import { SignContractPage } from './pages/SignContractPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 60_000 }
  }
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/user-portal/dashboard" replace />} />
            <Route path="/auth/login" element={<AuthPage />} />
            <Route path="/auth/set-password" element={<SetPasswordPage />} />
            <Route
              path="/user-portal"
              element={
                <ProtectedRoute>
                  <PortalLayout><Outlet /></PortalLayout>
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard"    element={<DashboardPage />} />
              <Route path="apply"        element={<ApplyLoanPage />} />
              <Route path="calculator"   element={<LoanCalculatorPage />} />
              <Route path="support"      element={<SupportPage />} />
              <Route path="transcripts"  element={<TranscriptsPage />} />
              <Route path="transactions" element={<TransactionsPage />} />
              <Route path="profile"        element={<ProfilePage />} />
              <Route path="sign-contract" element={<SignContractPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/user-portal/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
