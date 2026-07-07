import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://yakhrwrfmdrnhfgzfiwm.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlha2hyd3JmbWRybmhmZ3pmaXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMjAwMTYsImV4cCI6MjA5NTg5NjAxNn0.lgm1jvglC16RtqbGdiDNJcyLfobX-4F5AlKmoHZPCG4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: window.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});
