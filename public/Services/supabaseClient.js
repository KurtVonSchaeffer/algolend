import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = import.meta?.env?.VITE_SUPABASE_URL ||"https://yakhrwrfmdrnhfgzfiwm.supabase.co" ;
//"
const supabaseAnonKey = import.meta?.env?.VITE_SUPABASE_ANON_KEY|| "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlha2hyd3JmbWRybmhmZ3pmaXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMjAwMTYsImV4cCI6MjA5NTg5NjAxNn0.lgm1jvglC16RtqbGdiDNJcyLfobX-4F5AlKmoHZPCG4" ;
//
// --- Sanity Check ---
// This check ensures the variables are filled.
if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('YOUR_SUPABASE_URL')) {
    // A more visible error for the user in case keys are still missing.
    const body = document.querySelector('body');
    if (body) {
        body.innerHTML = `
            <div style="padding: 2rem; text-align: center; font-family: sans-serif; background-color: #fff5f5; color: #c53030; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 9999;">
                <h1 style="font-size: 1.5rem; font-weight: bold;">Configuration Error</h1>
                <p>Your Supabase URL and Key are not set correctly. Please update them in <strong>public/Services/supabaseClient.js</strong>.</p>
            </div>
        `;
    }
    throw new Error("Supabase credentials are missing or are still placeholders!");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: window.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    if (!window.location.pathname.includes('/auth/login')) {
      window.location.replace('/auth/login.html');
    }
  }
});
