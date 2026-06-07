// public/layouts/admin-layout.js
import { supabase } from '/Services/supabaseClient.js';
import { ensureThemeLoaded, getCachedTheme, getCompanyName, DEFAULT_SYSTEM_SETTINGS } from '../shared/theme-runtime.js';

const sidebarContainer = document.getElementById('sidebar-container');
const headerContainer = document.getElementById('header-container');
let companyName = DEFAULT_SYSTEM_SETTINGS.company_name;

// ============================================
// AUTH GUARD: This function checks authentication
// Protects ALL admin pages from unauthorized access
// Only admin and super_admin roles can access
// ============================================
export async function initLayout() {
  const { data: { session } } = await supabase.auth.getSession();

  const theme = await ensureThemeLoaded();
  companyName = getCompanyName(theme || getCachedTheme() || DEFAULT_SYSTEM_SETTINGS);

  // If there is NO session, kick the user out.
  if (!session) {
    console.log('⛔ No session - redirecting to login');
    window.location.replace('/auth/login.html');
    return; // Stop execution
  }

  // **FIXED**: Query profiles table directly instead of RPC function
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  // If the query fails OR the returned role is not admin/super_admin, kick the user out.
  if (error || !profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
    console.error('⛔ Access Denied. Signing out.', { error, profile });
    await supabase.auth.signOut();
    window.location.replace('/auth/login.html');
    return; // Stop execution
  }

  console.log('✅ Access granted for admin:', profile.full_name);

  // If all checks pass, render the page components.
  renderSidebar();
  renderHeader(profile);
  attachEventListeners();
  highlightActiveLink();
  
  // Return profile data for modules to use
  return { role: profile.role, profile };
}

// MODIFIED: Updated sidebar with collapsible Payments menu and improved styling
function renderSidebar() {
  if (!sidebarContainer) return;
  sidebarContainer.innerHTML = `
  <div id="sidebar" class="fixed inset-y-0 left-0 z-40 flex flex-col w-64 bg-[#0C0C0C] transition-transform duration-300 ease-in-out md:translate-x-0 -translate-x-full">
    <div class="flex items-center justify-center h-16 bg-black">
      <h1 class="text-xl font-bold text-white tracking-widest">${companyName ? companyName.toUpperCase() : 'COMPANY'}</h1>
    </div>
    <nav class="flex-1 overflow-y-auto">
      <ul class="p-4 space-y-2">
        <li><a href="/admin/pages/dashboard.html" class="nav-link flex items-center p-3 text-sm font-medium rounded-lg text-gray-300 hover:bg-[#1A1A1A] hover:text-white"><i class="fa-solid fa-chart-line w-5 h-5 mr-3"></i>Dashboard</a></li>
        <li><a href="/admin/pages/applications.html" class="nav-link flex items-center p-3 text-sm font-medium rounded-lg text-gray-300 hover:bg-[#1A1A1A] hover:text-white"><i class="fa-solid fa-file-contract w-5 h-5 mr-3"></i>Loan Applications</a></li>
        <li><a href="/admin/pages/users.html" class="nav-link flex items-center p-3 text-sm font-medium rounded-lg text-gray-300 hover:bg-[#1A1A1A] hover:text-white"><i class="fa-solid fa-users w-5 h-5 mr-3"></i>Users & Profiles</a></li>
        <li>
          <button type="button" id="payments-toggle" class="nav-collapsible flex items-center justify-between w-full p-3 text-sm font-medium rounded-lg text-gray-300 hover:bg-[#1A1A1A] hover:text-white">
            <span class="flex items-center"><i class="fa-solid fa-receipt w-5 h-5 mr-3"></i>Payments</span>
            <i class="fa-solid fa-chevron-down transition-transform duration-200"></i>
          </button>
          <ul id="payments-submenu" class="pl-8 mt-1 space-y-1 hidden">
            <li><a href="/admin/pages/incoming-payments.html" class="nav-link flex items-center p-3 text-sm font-medium rounded-lg text-gray-300 hover:bg-[#1A1A1A] hover:text-white">Incoming</a></li>
            <li><a href="/admin/pages/outgoing-payments.html" class="nav-link flex items-center p-3 text-sm font-medium rounded-lg text-gray-300 hover:bg-[#1A1A1A] hover:text-white">Outgoing</a></li>
          </ul>
        </li>
      </ul>
    </nav>
    <div class="p-4 border-t border-gray-700">
      <ul class="space-y-2">
        <li><a href="/admin/pages/settings.html" class="nav-link flex items-center p-3 text-sm font-medium rounded-lg text-gray-300 hover:bg-[#1A1A1A] hover:text-white"><i class="fa-solid fa-gear w-5 h-5 mr-3"></i>Settings</a></li>
        <li><button id="sign-out-btn" class="flex items-center justify-center w-full p-3 text-sm font-medium text-red-400 bg-[#1A1A1A] rounded-lg hover:bg-red-900/50 transition"><i class="fa-solid fa-sign-out-alt w-5 h-5 mr-2"></i>Sign Out</button></li>
      </ul>
    </div>
  </div>
  <div id="sidebar-overlay" class="fixed inset-0 z-30 bg-black opacity-50 md:hidden hidden"></div>
  `;
}

function renderHeader(profile) {
  if (!headerContainer) return;
  const displayName = profile?.full_name || 'Admin';
  const avatarUrl = profile?.avatar_url || `https://ui-avatars.com/api/?name=${displayName.replace(' ', '+')}&background=E7762E&color=fff`;
  headerContainer.innerHTML = `
  <div class="fixed top-0 left-0 right-0 z-30 bg-white shadow-md md:left-64">
    <div class="flex items-center justify-between h-16 px-6">
      <button id="sidebar-toggle" class="text-gray-500 md:hidden">
        <i class="fa-solid fa-bars text-xl"></i>
      </button>
      <div class="flex-1"></div> <div class="flex items-center space-x-3">
        <span class="text-gray-600 font-medium hidden sm:block">Hello, ${displayName}   👋  </span>
        <img src="${avatarUrl}" alt="User Avatar" class="w-9 h-9 rounded-full object-cover border-2 border-[#E7762E]" />
      </div>
    </div>
  </div>
  `;
}

function attachEventListeners() {
  const signOutBtn = document.getElementById('sign-out-btn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.replace('/auth/login.html');
    });
  }

  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  if (sidebarToggle && sidebar && sidebarOverlay) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('-translate-x-full');
      sidebarOverlay.classList.toggle('hidden');
    });
    sidebarOverlay.addEventListener('click', () => {
      sidebar.classList.add('-translate-x-full');
      sidebarOverlay.classList.add('hidden');
    });
  }

  const paymentsToggle = document.getElementById('payments-toggle');
  const paymentsSubmenu = document.getElementById('payments-submenu');
  if (paymentsToggle && paymentsSubmenu) {
    paymentsToggle.addEventListener('click', () => {
      paymentsSubmenu.classList.toggle('hidden');
      paymentsToggle.querySelector('i.fa-chevron-down').classList.toggle('rotate-180');
    });
  }
}

function highlightActiveLink() {
  const currentPage = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    const linkPath = new URL(link.href).pathname;
    if (linkPath === currentPage) {
      link.classList.add('bg-[#E7762E]', 'text-white');
      const parentSubmenu = link.closest('ul');
      if (parentSubmenu && parentSubmenu.id === 'payments-submenu') {
        const toggleButton = document.getElementById('payments-toggle');
        parentSubmenu.classList.remove('hidden');
        toggleButton.classList.add('bg-[#1A1A1A]', 'text-white');
        toggleButton.querySelector('i.fa-chevron-down').classList.add('rotate-180');
      }
    }
  });
}
