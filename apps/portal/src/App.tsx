import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './theme/ThemeProvider';
import { AuthPage } from './auth/AuthPage';
import { SetPasswordPage } from './auth/SetPasswordPage';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { PortalLayout } from './layout/PortalLayout';
import { PageRedirect } from './layout/PageRedirect';
import { DashboardPage } from './pages/DashboardPage';

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
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
