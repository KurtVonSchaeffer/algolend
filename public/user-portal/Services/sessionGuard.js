/**
 * Session Guard - Production-grade auth validation
 * Runs on every page to ensure valid session + borrower role
 */

import { supabase } from '/Services/supabaseClient.js';

let guardActive = false;

export async function enforceSession() {
  if (guardActive) return; // Prevent multiple simultaneous checks
  guardActive = true;

  try {
    // 1. Check if session exists
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.log('🔒 Session invalid - redirecting to login');
      window.location.replace('/auth/login.html');
      return;
    }

    // 2. Verify user still exists and has borrower role (role lives in JWT app_metadata)
    const role = session.user?.app_metadata?.role || session.user?.user_metadata?.role || 'borrower';
    if (!['borrower','super_admin','admin','base_admin','owner'].includes(role)) {
      console.log('🔒 Not a borrower - access denied. Role:', role);
      await supabase.auth.signOut();
      window.location.replace('/auth/login.html');
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profileError) {
      console.warn('Profile lookup error during session guard:', profileError);
    }
    if (!profile) {
      console.log('🔒 Profile not found - logging out');
      await supabase.auth.signOut();
      window.location.replace('/auth/login.html');
      return;
    }

    // Session is valid
    console.log('✅ Session validated');
  } catch (err) {
    console.error('Session guard error:', err);
    window.location.replace('/auth/login.html');
  } finally {
    guardActive = false;
  }
}

// Auto-run on import (for pages that just import this module)
enforceSession();
