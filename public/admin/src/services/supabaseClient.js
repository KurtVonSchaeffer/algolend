import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || "https://yakhrwrfmdrnhfgzfiwm.supabase.co";
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlha2hyd3JmbWRybmhmZ3pmaXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMjAwMTYsImV4cCI6MjA5NTg5NjAxNn0.lgm1jvglC16RtqbGdiDNJcyLfobX-4F5AlKmoHZPCG4";

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('YOUR_SUPABASE_URL')) {
    const body = document.querySelector('body');
    if (body) {
        body.innerHTML = `
            <div style="padding: 2rem; text-align: center; font-family: sans-serif; background-color: #fff5f5; color: #c53030; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 9999;">
                <h1 style="font-size: 1.5rem; font-weight: bold;">Configuration Error</h1>
                <p>Supabase credentials are not set correctly in <strong>supabaseClient.js</strong>.</p>
            </div>
        `;
    }
    throw new Error("Supabase credentials are missing or are still placeholders!");
}

// localStorage so session persists across page navigations and new tabs
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: window.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Only redirect on explicit sign-out — TOKEN_REFRESHED fires spuriously on init
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    if (!window.location.pathname.includes('/auth/login')) {
      localStorage.clear();
      window.location.replace('/auth/login.html');
    }
  }
});

// Catch stale/invalid refresh tokens from a different Supabase project
supabase.auth.getSession().then(({ error }) => {
  if (error?.status === 400 || error?.message?.includes('Invalid Refresh Token')) {
    localStorage.clear();
    if (!window.location.pathname.includes('/auth/login')) {
      window.location.replace('/auth/login.html');
    }
  }
});
