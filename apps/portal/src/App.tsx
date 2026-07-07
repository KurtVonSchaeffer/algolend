import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './theme/ThemeProvider';
import { AuthPage } from './auth/AuthPage';
import { SetPasswordPage } from './auth/SetPasswordPage';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { PortalLayout } from './layout/PortalLayout';
import { PageRedirect } from './layout/PageRedirect';
import { DashboardPage } from './pages/DashboardPage';
import { ComingSoonPage } from './pages/ComingSoonPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 60_000 }
  }
});

const PLACEHOLDER_PAGES = [
  { path: 'apply',        title: 'Apply for Loan',  icon: 'fa-file-contract' },
  { path: 'calculator',   title: 'Loan Calculator', icon: 'fa-calculator' },
  { path: 'transcripts',  title: 'Transcripts',     icon: 'fa-file-lines' },
  { path: 'transactions', title: 'Transactions',    icon: 'fa-receipt' },
  { path: 'support',      title: 'Support',         icon: 'fa-headset' },
  { path: 'profile',      title: 'Profile',         icon: 'fa-user' }
];

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
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
            {PLACEHOLDER_PAGES.map(({ path, title, icon }) => (
              <Route
                key={path}
                path={`/user-portal/${path}`}
                element={
                  <ProtectedRoute>
                    <PortalLayout>
                      <ComingSoonPage title={title} icon={icon} />
                    </PortalLayout>
                  </ProtectedRoute>
                }
              />
            ))}
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
