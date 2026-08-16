import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../api/supabaseClient';
import { redirectTo } from '../lib/navigation';

const ALLOWED_PORTAL_ROLES = ['borrower', 'super_admin', 'admin', 'base_admin', 'owner'];

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface SessionState {
  status: SessionStatus;
  session: Session | null;
}

function roleOf(session: Session | null): string {
  return session?.user?.app_metadata?.role || 'borrower';
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading', session: null });

  useEffect(() => {
    let cancelled = false;

    async function evaluate(session: Session | null) {
      if (!session) {
        if (!cancelled) setState({ status: 'unauthenticated', session: null });
        redirectTo('/auth/login');
        return;
      }

      const role = roleOf(session);
      if (!ALLOWED_PORTAL_ROLES.includes(role)) {
        await supabase.auth.signOut();
        if (!cancelled) setState({ status: 'unauthenticated', session: null });
        redirectTo('/auth/login');
        return;
      }

      if (!cancelled) setState({ status: 'authenticated', session });
    }

    supabase.auth.getSession().then(({ data: { session } }) => evaluate(session));

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setState({ status: 'unauthenticated', session: null });
        redirectTo('/auth/login');
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
