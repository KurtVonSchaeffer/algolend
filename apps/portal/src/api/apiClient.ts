import { supabase } from './supabaseClient';
import { redirectTo } from '../lib/navigation';
import { isDemoMode } from '../demo/demoData';

async function getAccessToken(): Promise<string | null> {
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;

  const { data: refreshed } = await supabase.auth.refreshSession();
  return refreshed?.session?.access_token ?? null;
}

export async function apiFetch(path: string, options: RequestInit = {}, _retry = true): Promise<Response> {
  if (isDemoMode()) {
    return new Response(JSON.stringify(null), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  const token = await getAccessToken();
  if (!token) {
    redirectTo('/auth/login');
    throw new Error('Session expired. Please log in again.');
  }

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`
  };

  const response = await fetch(path, { ...options, headers });

  if (response.status === 401 && _retry) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed?.session?.access_token) {
      return apiFetch(path, options, false);
    }
    redirectTo('/auth/login');
    throw new Error('Session expired. Please log in again.');
  }

  if (response.status === 401) {
    redirectTo('/auth/login');
    throw new Error('Session expired. Please log in again.');
  }

  return response;
}
