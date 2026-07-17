import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../api/supabaseClient';

const isDemoMode = () => localStorage.getItem('algolend_demo') === '1';

const ADMIN_ROLES = ['base_admin', 'admin', 'super_admin', 'owner'];

export type AdminSessionStatus = 'loading' | 'authenticated' | 'unauthorized';

export interface AdminSessionState {
  status: AdminSessionStatus;
  session: Session | null;
  role: string;
}

function roleOf(session: Session | null): string {
  return (
    session?.user?.app_metadata?.role ||
    session?.user?.user_metadata?.role ||
    'borrower'
  ).toLowerCase();
}

export function useAdminSession(): AdminSessionState {
  const [state, setState] = useState<AdminSessionState>(() =>
    isDemoMode()
      ? { status: 'authenticated', session: null, role: 'base_admin' }
      : { status: 'loading', session: null, role: 'borrower' }
  );

  useEffect(() => {
    if (isDemoMode()) return;
    let cancelled = false;

    async function evaluate(session: Session | null) {
      if (!session) {
        if (!cancelled) setState({ status: 'unauthorized', session: null, role: 'borrower' });
        window.location.replace('/auth/login');
        return;
      }

      const role = roleOf(session);
      if (!ADMIN_ROLES.includes(role)) {
        await supabase.auth.signOut();
        if (!cancelled) setState({ status: 'unauthorized', session: null, role });
        window.location.replace('/auth/login');
        return;
      }

      if (!cancelled) setState({ status: 'authenticated', session, role });
    }

    supabase.auth.getSession().then(({ data: { session } }) => evaluate(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setState({ status: 'unauthorized', session: null, role: 'borrower' });
        window.location.replace('/auth/login');
        return;
      }
      evaluate(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
