import type { ReactNode } from 'react';
import { useAdminSession } from './useAdminSession';

export function AdminRoute({ children }: { children: ReactNode }) {
  const { status } = useAdminSession();

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (status === 'unauthorized') return null;

  return <>{children}</>;
}
