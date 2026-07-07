import type { ReactNode } from 'react';
import { useSession } from './useSession';
import { Loader } from '../components/ui/loader';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader size={120} />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return <>{children}</>;
}
