import { supabase } from '../services/supabaseClient.js';

export async function apiFetch(url, options = {}, _retry = true) {
  let { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    session = refreshed?.session ?? null;
  }
  if (!session?.access_token) {
    window.location.replace('/auth/login.html');
    throw new Error('Session expired. Please log in again.');
  }
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${session.access_token}`
  };
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 && _retry) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed?.session?.access_token) {
      return apiFetch(url, options, false);
    }
    window.location.replace('/auth/login.html');
    throw new Error('Session expired. Please log in again.');
  }
  if (response.status === 401) {
    window.location.replace('/auth/login.html');
    throw new Error('Session expired. Please log in again.');
  }
  return response;
}
