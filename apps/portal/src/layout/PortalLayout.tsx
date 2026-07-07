import type { ReactNode } from 'react';
import { supabase } from '../api/supabaseClient';
import { Button } from '../components/ui/button';

export function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <img src="/algolend-logo.png" alt="AlgoLend" className="h-8 object-contain" />
        <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()}>
          Sign Out
        </Button>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
