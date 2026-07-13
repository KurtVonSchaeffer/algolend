import type { ReactNode } from 'react';
import { useSession } from './useSession';
import { Loader } from '../components/ui/loader';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useSession();

  if (status === 'loading') {
    return <Loader screen size={120} />;
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return <>{children}</>;
}
