/**
 * Admin Session Guard - Production-grade auth validation
 * Runs on every admin page to ensure valid session + admin role
 */

import { supabase } from '../services/supabaseClient.js';

let guardActive = false;

export async function enforceAdminSession() {
  if (guardActive) return; // Prevent multiple simultaneous checks
  guardActive = true;

  try {
    // 1. Check if session exists
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.log('🔒 Admin session invalid - redirecting to login');
      window.location.replace('/auth/login.html');
      return;
    }

    // 2. Verify user has admin role (read from JWT app_metadata; RPC fallback)
    const ADMIN_ROLES = ['base_admin', 'admin', 'super_admin', 'owner'];
    const jwtRole = (session.user?.app_metadata?.role || session.user?.user_metadata?.role || '').toLowerCase();
    let isAllowed = ADMIN_ROLES.includes(jwtRole);

    if (!isAllowed) {
      const { data: rpcAllowed, error: roleError } = await supabase.rpc('is_role_or_higher', {
        p_min_role: 'base_admin'
      });
      if (!roleError && rpcAllowed) isAllowed = true;
    }

    if (!isAllowed) {
      console.log('🔒 Not an admin - access denied. Role:', jwtRole);
      await supabase.auth.signOut();
      window.location.replace('/auth/login.html');
      return;
    }

    // Session is valid
    console.log('✅ Admin session validated');
  } catch (err) {
    console.error('Admin session guard error:', err);
    window.location.replace('/auth/login.html');
  } finally {
    guardActive = false;
  }
}

// Auto-run on import (for pages that just import this module)
enforceAdminSession();
