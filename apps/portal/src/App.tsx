import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './theme/ThemeProvider';
import { AuthPage } from './auth/AuthPage';
import { SetPasswordPage } from './auth/SetPasswordPage';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { PortalLayout } from './layout/PortalLayout';
import { PageRedirect } from './layout/PageRedirect';
import { DashboardPage } from './pages/DashboardPage';
import { LoanCalculatorPage } from './pages/LoanCalculatorPage';
import { SupportPage } from './pages/SupportPage';
import { TranscriptsPage } from './pages/TranscriptsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { ProfilePage } from './pages/ProfilePage';
import { ApplyLoanPage } from './pages/ApplyLoanPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 60_000 }
  }
});

const PORTAL_PAGES = [
  { path: 'apply',        element: <ApplyLoanPage /> },
  { path: 'calculator',   element: <LoanCalculatorPage /> },
  { path: 'support',      element: <SupportPage /> },
  { path: 'transcripts',  element: <TranscriptsPage /> },
  { path: 'transactions', element: <TransactionsPage /> },
  { path: 'profile',      element: <ProfilePage /> }
];

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<Navigate to="/user-portal/dashboard" replace />} />
            <Route path="/auth/login" element={<AuthPage />} />
            <Route path="/auth/set-password" element={<SetPasswordPage />} />
            <Route path="/user-portal" element={<PageRedirect />} />
            <Route
              path="/user-portal/dashboard"
              element={
                <ProtectedRoute>
                  <PortalLayout>
                    <DashboardPage />
                  </PortalLayout>
                </ProtectedRoute>
              }
            />
            {PORTAL_PAGES.map(({ path, element }) => (
              <Route
                key={path}
                path={`/user-portal/${path}`}
                element={
                  <ProtectedRoute>
                    <PortalLayout>{element}</PortalLayout>
                  </ProtectedRoute>
                }
              />
            ))}
            <Route path="*" element={<Navigate to="/user-portal/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
