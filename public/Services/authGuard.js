// Auth Guard - Protects pages from unauthorized access
import { supabase } from '/Services/supabaseClient.js';

/**
 * Check if user is authenticated
 * Redirects to login if not authenticated
 */
export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    console.log('No session - redirecting to login');
    window.location.replace('/auth/login.html');
    return null;
  }
  
  return session;
}

/**
 * Check if user has specific role(s)
 * @param {string|string[]} allowedRoles - Role or array of roles allowed
 */
export async function requireRole(allowedRoles) {
  const session = await requireAuth();
  if (!session) return null;
  
  // Get user profile
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();
  
  if (error || !profile) {
    console.error('Error fetching profile:', error);
    await supabase.auth.signOut();
    window.location.replace('/auth/login.html');
    return null;
  }
  
  // Check if user has allowed role
  const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  if (!rolesArray.includes(profile.role)) {
    console.error('Access denied. Required role:', allowedRoles, 'User role:', profile.role);
    alert('Access denied. You do not have permission to view this page.');
    
    // Redirect based on actual role
    if (profile.role === 'admin' || profile.role === 'super_admin') {
      window.location.replace('/admin/pages/dashboard.html');
    } else if (profile.role === 'borrower') {
      window.location.replace('/user-portal/index.html');
    } else {
      await supabase.auth.signOut();
      window.location.replace('/auth/login.html');
    }
    return null;
  }
  
  return profile;
}

/**
 * Redirect authenticated users away from auth pages
 */
export async function redirectIfAuthenticated() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    if (profile) {
      // Redirect based on role
      if (profile.role === 'admin' || profile.role === 'super_admin') {
        window.location.replace('/admin/pages/dashboard.html');
      } else if (profile.role === 'borrower') {
        window.location.replace('/user-portal/index.html');
      }
    }
  }
}
