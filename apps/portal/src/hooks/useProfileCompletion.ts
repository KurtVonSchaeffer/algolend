import { useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient';

export interface ProfileCompletion {
  isComplete: boolean;
  hasFinancialProfile: boolean;
  hasDeclarations: boolean;
  missingItems: string[];
  loading: boolean;
}

export function useProfileCompletion(): ProfileCompletion {
  const [state, setState] = useState<ProfileCompletion>({
    isComplete: true, // optimistic default — avoids blocking nav during load
    hasFinancialProfile: true,
    hasDeclarations: true,
    missingItems: [],
    loading: true,
  });

  useEffect(() => {
    async function check() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setState(s => ({ ...s, loading: false })); return; }
        const uid = session.user.id;

        const [{ data: fp }, { data: decl }] = await Promise.all([
          supabase.from('financial_profiles').select('monthly_income').eq('user_id', uid).maybeSingle(),
          supabase.from('declarations').select('accepted_std_conditions').eq('user_id', uid).maybeSingle(),
        ]);

        const hasFinancialProfile = !!(fp && Number(fp.monthly_income) > 0);
        const hasDeclarations = decl?.accepted_std_conditions === true;
        const missingItems: string[] = [];
        if (!hasFinancialProfile) missingItems.push('Financial Information');
        if (!hasDeclarations) missingItems.push('Declarations');

        setState({ isComplete: missingItems.length === 0, hasFinancialProfile, hasDeclarations, missingItems, loading: false });
      } catch {
        // On error, don't block — fail open
        setState({ isComplete: true, hasFinancialProfile: true, hasDeclarations: true, missingItems: [], loading: false });
      }
    }
    check();
  }, []);

  return state;
}
