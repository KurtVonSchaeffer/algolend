import { supabase } from '../services/supabaseClient.js';

/**
 * Authenticated fetch for protected admin API routes.
 * - Attaches Bearer token from current session
 * - On 401: force-refreshes once and retries
 * - If still no session: redirects to login
 */
export async function apiFetch(url, options = {}, _retry = true) {
    let { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        session = refreshed.session;
    }

    if (!session) {
        window.location.replace('/auth/login.html');
        throw new Error('No session — redirecting to login');
    }

    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        Authorization: `Bearer ${session.access_token}`,
    };

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401 && _retry) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (!refreshed.session) {
            window.location.replace('/auth/login.html');
            throw new Error('Session expired — redirecting to login');
        }
        return apiFetch(url, options, false);
    }

    return res;
}
