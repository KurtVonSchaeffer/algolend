const { createClient } = require('@supabase/supabase-js');

// Supabase credentials. Mirrors the frontend fallback in public/Services/supabaseClient.js
// so backend and frontend stay aligned even if env vars are misconfigured.
const FALLBACK_SUPABASE_URL = "https://jmnjkxfxenrudpvjprcu.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptbmpreGZ4ZW5ydWRwdmpwcmN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxODkzNzUsImV4cCI6MjA4MDc2NTM3NX0.X4ZdxzHF0b9GnHklObpIHqnhWvtKjdZnLoah0EVTvHs";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;
// Service-role key is optional. If not set, fall back to anon key so backend calls succeed
// under RLS policies that allow anon access.
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

// Validate that required credentials are set
if (!supabaseUrl || !supabaseAnonKey) {
        console.error('❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables must be set.');
        process.exit(1);
}

// Create Supabase client for server-side operations
// Note: Using anon key - RLS policies must allow inserts
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseStorage = createClient(supabaseUrl, supabaseServiceRoleKey);
const supabaseService = createClient(supabaseUrl, supabaseServiceRoleKey);

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY is not set. Falling back to anon key for storage operations.');
}

const createAuthedClient = (accessToken) => {
        if (!accessToken) {
                return supabase;
        }

        return createClient(supabaseUrl, supabaseAnonKey, {
                global: {
                        headers: {
                                Authorization: `Bearer ${accessToken}`
                        }
                }
        });
};

module.exports = { supabase, supabaseStorage, supabaseService, createAuthedClient };
