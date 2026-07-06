import { supabase } from '../services/supabaseClient.js';
import { ensureThemeLoaded, getCompanyName, DEFAULT_SYSTEM_SETTINGS } from './theme.js';

const appShell = document.getElementById('app-shell');
let userProfile = null;
let userRole = 'borrower';
const DEFAULT_BRAND_LOGO = 'https://static.wixstatic.com/media/f82622_cde1fbd5680141c5b0fccca81fb92ad6~mv2.png';

const escapeAttr = (value = '') => {
  if (!value) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

// ========================================== 
// INITIALIZATION
// ==========================================
export async function initLayout() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.replace('/auth/login.html'); 
    return null; 
  }

  const ADMIN_ROLES = ['base_admin', 'admin', 'super_admin', 'owner'];
  const role = (session.user?.app_metadata?.role || session.user?.user_metadata?.role || 'borrower').toLowerCase();
  const isAllowed = ADMIN_ROLES.includes(role);

  if (!isAllowed) {
    await supabase.auth.signOut();
    window.location.replace('/auth/login.html');
    return null;
  }

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();

  const profile = {
    id: session.user.id,
    email: session.user.email,
    full_name: profileRow?.full_name || session.user?.user_metadata?.full_name || session.user.email,
    avatar_url: profileRow?.avatar_url || null,
    ...(profileRow || {})
  };

  userProfile = profile;
  userRole = role;

  const theme = await ensureThemeLoaded();
  renderAppShell(profile, role, theme);
  attachEventListeners();
  highlightActiveLink();
  
  // INIT NOTIFICATIONS
  initNotifications(role, profile.id);

  return { profile, role };
}

export function getProfile() { return userProfile; }
export function getRole() { return userRole; }

/**
 * GLOBAL TOAST SYSTEM
 * Usage: window.showToast("Message", "success" | "error")
 */
window.showToast = (message, type = 'success') => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-8 right-8 z-[100] flex flex-col items-end pointer-events-none';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const isSuccess = type === 'success';
    const bg = isSuccess ? 'bg-green-600' : 'bg-red-600';
    const icon = isSuccess ? 'fa-check-circle' : 'fa-circle-exclamation';

    toast.className = `${bg} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 mb-3 pointer-events-auto animate-fade-in-up border border-white/10`;
    toast.innerHTML = `
        <i class="fa-solid ${icon} text-lg"></i>
        <div class="flex flex-col">
            <span class="text-[10px] font-black uppercase tracking-widest opacity-70">${type}</span>
            <span class="text-xs font-bold uppercase tracking-tight">${message}</span>
        </div>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-4');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
};

// ==========================================
// RENDER APP SHELL
// ==========================================
function renderAppShell(profile, role, theme = null) {
  if (!appShell) return;

  const displayName = profile?.full_name || 'Admin';
  const initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const companyName = getCompanyName(theme) || DEFAULT_SYSTEM_SETTINGS.company_name;
  const customLogo = (theme?.company_logo_url || '').trim();
  const logoSrc = escapeAttr(customLogo || DEFAULT_BRAND_LOGO);
  const logoAlt = escapeAttr(companyName || 'Company');
  const logoMarkup = logoSrc
    ? `<img src="${logoSrc}" alt="${logoAlt}" class="h-10 w-auto object-contain max-w-[180px]">`
    : `<div class="flex items-center gap-3">
         <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg" style="background-color: var(--color-primary);">
           ${(companyName || 'A').charAt(0)}
         </div>
         <span class="font-headline font-semibold text-base tracking-tight" style="color: var(--color-primary);">${logoAlt || 'Admin'}</span>
       </div>`;

  appShell.innerHTML = `
    <!-- Sidebar -->
    <aside id="sidebar" class="fixed inset-y-0 left-0 z-50 flex flex-col w-[280px] bg-surface-container-lowest border-r border-outline-variant/20 transition-transform duration-300 ease-in-out md:translate-x-0 -translate-x-full">

      <!-- Logo -->
      <div class="px-8 py-8 flex items-center min-h-[80px]">
        ${logoMarkup}
      </div>

      <!-- Nav -->
      <nav class="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
        ${renderSidebarNav(role)}
      </nav>

      <!-- Sign out -->
      <div class="p-4 border-t border-outline-variant/10">
        <button id="sign-out-btn" class="w-full flex items-center justify-center gap-2 px-4 py-3 text-error bg-error-container/30 rounded-xl hover:bg-error-container/50 transition-all text-xs font-semibold tracking-wide uppercase">
          <span class="material-symbols-outlined text-[18px]">logout</span>
          Sign Out
        </button>
        <p class="text-[10px] text-center mt-4 text-outline opacity-60">Powered by Mint Platforms</p>
      </div>
    </aside>

    <div id="sidebar-overlay" class="fixed inset-0 z-40 bg-black/20 overlay-transition overlay-hidden md:hidden"></div>

    <!-- Main -->
    <div class="flex flex-col flex-1 md:pl-[280px] min-h-screen bg-surface relative">

      <!-- Atmospheric blobs -->
      <div class="fixed top-0 right-0 -z-10 opacity-30 pointer-events-none">
        <div class="w-[600px] h-[600px] rounded-full blur-[120px]" style="background: radial-gradient(circle, color-mix(in srgb, var(--color-primary) 30%, transparent), transparent 70%);"></div>
      </div>
      <div class="fixed bottom-0 left-[280px] -z-10 opacity-20 pointer-events-none">
        <div class="w-[400px] h-[400px] rounded-full blur-[100px]" style="background: radial-gradient(circle, color-mix(in srgb, var(--color-secondary) 25%, transparent), transparent 70%);"></div>
      </div>

      <!-- Top bar -->
      <header class="sticky top-0 z-30 h-16 flex items-center justify-between px-8 bg-surface-container-lowest/80 backdrop-blur-xl border-b border-outline-variant/15">
        <div class="flex items-center gap-4">
          <button id="sidebar-toggle" class="md:hidden p-2 -ml-2 text-on-surface-variant hover:text-on-surface transition-colors">
            <span class="material-symbols-outlined">menu</span>
          </button>
          <h1 id="page-title" class="hidden md:block text-lg font-headline font-semibold text-on-surface"></h1>
        </div>

        <div class="flex items-center gap-5">
          <!-- Notifications -->
          <div class="relative">
            <button id="notif-btn" class="relative p-2 text-on-surface-variant hover:text-on-surface transition-colors focus:outline-none">
              <span class="material-symbols-outlined">notifications</span>
              <span id="notif-badge" class="hidden absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[8px] font-bold text-white border-2 border-white"></span>
            </button>
            <div id="notif-dropdown" class="hidden absolute right-0 mt-3 w-80 bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/20 overflow-hidden z-50">
              <div class="px-5 py-4 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low">
                <h3 class="font-semibold text-on-surface text-sm">Notifications</h3>
                <button id="mark-all-read" class="text-[10px] font-semibold uppercase tracking-wide" style="color: var(--color-primary);">Mark all read</button>
              </div>
              <div id="notif-list" class="max-h-80 overflow-y-auto">
                <div class="p-6 text-center text-outline text-xs italic">Loading…</div>
              </div>
            </div>
          </div>

          <!-- Divider -->
          <div class="h-7 w-px bg-outline-variant/30"></div>

          <!-- Avatar -->
          <div class="flex items-center gap-3">
            <div class="text-right hidden sm:block">
              <p class="text-sm font-semibold text-on-surface leading-none">${displayName.split(' ')[0]}</p>
              <p class="text-[10px] uppercase tracking-wider text-outline mt-0.5">${role.replace('_', ' ')}</p>
            </div>
            <div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold" style="background-color: var(--color-primary);">${initials}</div>
          </div>
        </div>
      </header>

      <main id="main-content" class="flex-1 p-8 relative z-10"></main>
    </div>
  `;
}

// ==========================================
// RENDER NAV LINKS
// ==========================================
function navLink(href, icon, label) {
  return `<li>
    <a href="${href}" class="nav-link flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface text-sm font-medium">
      <span class="material-symbols-outlined text-[22px] leading-none">${icon}</span>
      <span>${label}</span>
    </a>
  </li>`;
}

function navSection(label) {
  return `<p class="px-4 pt-5 pb-2 text-[10px] font-semibold uppercase tracking-widest text-outline">${label}</p>`;
}

function renderSidebarNav(role) {
  const isBaseAdmin = ['base_admin', 'admin', 'super_admin'].includes(role);
  const isAdmin     = ['admin', 'super_admin'].includes(role);
  const isSuperAdmin = role === 'super_admin';

  return `
    <ul class="space-y-0.5">
      ${isBaseAdmin ? `
        ${navSection('Overview')}
        ${navLink('/admin/dashboard', 'dashboard', 'Dashboard')}
        <li>
          <button type="button" id="analytics-toggle" class="nav-link w-full flex items-center justify-between gap-4 px-4 py-3 rounded-xl transition-all duration-200 text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface text-sm font-medium">
            <span class="flex items-center gap-4">
              <span class="material-symbols-outlined text-[22px] leading-none">bar_chart</span>
              Analytics
            </span>
            <span class="material-symbols-outlined text-[16px] transition-transform duration-200" id="analytics-chevron">expand_more</span>
          </button>
          <ul id="analytics-submenu" class="nav-submenu ml-10 mt-0.5 space-y-0.5 border-l-2 border-outline-variant/30 pl-3">
            <li><a href="/admin/analytics.html" class="nav-sublink block py-2 px-3 text-sm text-outline hover:text-on-surface rounded-lg transition-colors">Customer Analytics</a></li>
            <li><a href="/admin/financials.html" class="nav-sublink block py-2 px-3 text-sm text-outline hover:text-on-surface rounded-lg transition-colors">Financials</a></li>
          </ul>
        </li>
        ${navLink('/admin/applications', 'assignment', 'Applications')}
      ` : ''}

      ${isAdmin ? `
        ${navSection('Finance')}
        ${navLink('/admin/users', 'group', 'Users')}
        ${navLink('/admin/mandates.html', 'receipt_long', 'Mandates')}
        <li>
          <button type="button" id="payments-toggle" class="nav-link w-full flex items-center justify-between gap-4 px-4 py-3 rounded-xl transition-all duration-200 text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface text-sm font-medium">
            <span class="flex items-center gap-4">
              <span class="material-symbols-outlined text-[22px] leading-none">payments</span>
              Payments
            </span>
            <span class="material-symbols-outlined text-[16px] transition-transform duration-200" id="payments-chevron">expand_more</span>
          </button>
          <ul id="payments-submenu" class="nav-submenu ml-10 mt-0.5 space-y-0.5 border-l-2 border-outline-variant/30 pl-3">
            <li><a href="/admin/incoming-payments" class="nav-sublink block py-2 px-3 text-sm text-outline hover:text-on-surface rounded-lg transition-colors">Incoming</a></li>
            <li><a href="/admin/outgoing-payments" class="nav-sublink block py-2 px-3 text-sm text-outline hover:text-on-surface rounded-lg transition-colors">Outgoing</a></li>
          </ul>
        </li>
      ` : ''}

      ${isAdmin ? `
        ${navSection('Tools')}
        ${navLink('/admin/credit-rules',  'rule',                    'Credit Rules')}
        ${navLink('/admin/portfolio',      'analytics',               'Portfolio')}
        ${navLink('/admin/loan-book',     'menu_book',               'Loan Book')}
        ${navLink('/admin/cash-ledger',   'account_balance_wallet',  'Cash Ledger')}
      ` : ''}

      ${isAdmin ? `
        ${navSection('Compliance')}
        ${navLink('/admin/sacrra', 'verified_user', 'SACRRA')}
        ${navLink('/admin/sacrra-validator', 'rule_folder', 'Migration Validator')}
        ${navLink('/admin/ncr-reporting', 'assignment', 'NCR Reporting')}
        ${navLink('/admin/ncr-registers', 'manage_accounts', 'NCR Registers')}
        ${navLink('/admin/compliance-tracker', 'checklist', 'Compliance Tracker')}
        ${navLink('/admin/goaml', 'security', 'FIC goAML')}
      ` : ''}

      ${isSuperAdmin ? `
        ${navSection('System')}
        ${navLink('/admin/settings', 'settings', 'Settings')}
      ` : ''}
    </ul>
  `;
}

// ==========================================
// EVENT LISTENERS
// ==========================================
function attachEventListeners() {
  const signOutBtn = document.getElementById('sign-out-btn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Fire signOut but don't block redirect on it; clear storage and navigate immediately
      // so the user is never stuck if the network call hangs.
      try { supabase.auth.signOut(); } catch (_) { /* noop */ }
      try { sessionStorage.clear(); } catch (_) { /* noop */ }
      try { localStorage.clear(); } catch (_) { /* noop */ }
      window.location.replace('/auth/login.html');
    });
  }

  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('-translate-x-full');
      if (sidebarOverlay) {
        sidebarOverlay.classList.toggle('overlay-hidden');
        sidebarOverlay.classList.toggle('overlay-visible');
      }
    });
    sidebarOverlay?.addEventListener('click', () => {
      sidebar.classList.add('-translate-x-full');
      if (sidebarOverlay) {
        sidebarOverlay.classList.add('overlay-hidden');
        sidebarOverlay.classList.remove('overlay-visible');
      }
    });
  }

  const setupDropdown = (toggleId, menuId, chevronId) => {
    const toggle = document.getElementById(toggleId);
    const menu = document.getElementById(menuId);
    const chevron = document.getElementById(chevronId);
    if (toggle && menu) {
        toggle.addEventListener('click', () => {
            menu.classList.toggle('expanded');
            if (chevron) chevron.classList.toggle('rotate-180');
        });
    }
  };
  setupDropdown('payments-toggle', 'payments-submenu', 'payments-chevron');
  setupDropdown('analytics-toggle', 'analytics-submenu', 'analytics-chevron');

  const notifBtn = document.getElementById('notif-btn');
  const notifDropdown = document.getElementById('notif-dropdown');
  if(notifBtn && notifDropdown) {
      notifBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          notifDropdown.classList.toggle('hidden');
      });
      document.addEventListener('click', (e) => {
          if (!notifBtn.contains(e.target) && !notifDropdown.contains(e.target)) {
              notifDropdown.classList.add('hidden');
          }
      });
  }
}

// ==========================================
// ACTIVE LINK HIGHLIGHTING
// ==========================================
function highlightActiveLink() {
  const currentPage = window.location.pathname;
  document.querySelectorAll('.nav-link, .nav-sublink').forEach(link => {
    if (link.tagName !== 'A') return;
    const href = link.getAttribute('href');
    if (!href) return;
    const isActive = currentPage === href || currentPage.startsWith(href + '/') || currentPage.startsWith(href + '.html');
    if (!isActive) return;

    const isSubLink = link.classList.contains('nav-sublink');
    if (isSubLink) {
      link.classList.add('font-semibold', 'text-on-surface');
      link.classList.remove('text-outline');
      // expand parent submenu
      const submenu = link.closest('ul[id$="-submenu"]');
      if (submenu) {
        submenu.classList.add('expanded');
        const chevron = document.getElementById(submenu.id.replace('-submenu', '-chevron'));
        if (chevron) chevron.classList.add('rotate-180');
      }
    } else {
      link.classList.remove('text-on-surface-variant', 'hover:bg-surface-variant/50', 'hover:text-on-surface');
      link.classList.add('nav-link-active', 'text-white', 'shadow-md');
      link.style.backgroundColor = 'var(--color-primary)';
      link.style.boxShadow = '0 4px 14px -2px color-mix(in srgb, var(--color-primary) 40%, transparent)';
    }
  });
}

// ==========================================
// NOTIFICATION SYSTEM
// ==========================================
async function initNotifications(role, userId) {
    const notifBadge = document.getElementById('notif-badge');
    const notifList = document.getElementById('notif-list');
    const markAllReadBtn = document.getElementById('mark-all-read');
    
    const branchId = userProfile?.branch_id || null;

    const fetchNotifications = async () => {
        // 1. FETCH: Use the table directly since the RPC was dropped
        const { data: rawData, error } = await supabase
            .from('admin_notifications')
            .select('*');

        if (error) {
            console.error("Notification Fetch Error:", error);
            return;
        }

        // 2. FILTER & SORT: Handle logic in JS for speed and reliability
        const processed = rawData.filter(n => {
            // Role Match
            let roleMatch = false;
            if (role === 'super_admin') roleMatch = true;
            else if (role === 'admin') roleMatch = ['admin', 'base_admin'].includes(n.target_role);
            else if (role === 'base_admin') roleMatch = n.target_role === 'base_admin';

            // Branch Match (Branch-specific or system-wide)
            const branchMatch = n.branch_id === null || n.branch_id === branchId;

            // Read Check (Is this user NOT in the read_by array?)
            const isUnread = !(n.read_by || []).includes(userId);

            return roleMatch && branchMatch && isUnread;
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // Sort newest first

        updateNotifUI(processed);
    };

    const updateNotifUI = (notifications) => {
        const unreadCount = notifications.length;
        
        // Update Badge UI
        if (unreadCount > 0) {
            notifBadge.classList.remove('hidden');
            notifBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            notifBadge.className = "absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[8px] font-bold text-white border-2 border-white animate-bounce";
        } else {
            notifBadge.classList.add('hidden');
        }

        if (unreadCount === 0) {
          notifList.innerHTML = `
            <div class="flex flex-col items-center justify-center p-10 text-center">
                <div class="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-3">
                    <i class="fa-solid fa-check-double text-xl"></i>
                </div>
                <p class="text-xs font-bold text-gray-800 uppercase tracking-tighter">You're all caught up!</p>
            </div>`;
          return;
        }

        notifList.innerHTML = notifications.map(n => {
            const isUrgent = n.title.toLowerCase().includes('failed') || n.title.toLowerCase().includes('overdue');
            return `
                <div class="p-4 border-b border-gray-50 hover:bg-gray-50 transition-all relative group" data-id="${n.id}">
                    <div class="flex gap-4 pr-6">
                        <div class="shrink-0 w-10 h-10 rounded-xl ${isUrgent ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'} flex items-center justify-center shadow-sm">
                            <i class="fa-solid ${isUrgent ? 'fa-triangle-exclamation' : 'fa-bolt'} text-sm"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <a href="${n.link || '#'}" class="block">
                                <div class="flex justify-between items-start mb-0.5">
                                    <p class="text-xs font-black text-gray-900 truncate pr-2 uppercase tracking-tight">${n.title}</p>
                                    <p class="text-[9px] font-bold text-gray-400 uppercase">${formatRelativeTime(n.created_at)}</p>
                                </div>
                                <p class="text-[10px] text-gray-600 leading-relaxed line-clamp-2">${n.message}</p>
                            </a>
                        </div>
                    </div>
                    <button class="dismiss-notif absolute right-2 top-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1">
                        <i class="fa-solid fa-xmark text-xs"></i>
                    </button>
                </div>
            `;
        }).join('');

        // Re-attach listeners after rendering
        notifList.querySelectorAll('.dismiss-notif').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.closest('[data-id]').dataset.id;
                // FIX: Ensure ID is an integer for the bigint RPC
                const { error } = await supabase.rpc('mark_notification_read_single', { p_notif_id: parseInt(id) });
                if (!error) await fetchNotifications();
            });
        });
    };

    const formatRelativeTime = (date) => {
        const diff = Math.floor((new Date() - new Date(date)) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    };

    // Initial Fetch
    await fetchNotifications();

    // Realtime Listener
    supabase.channel('admin_notif_channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' }, () => fetchNotifications())
      .subscribe();

    if(markAllReadBtn) {
        markAllReadBtn.addEventListener('click', async () => {
            const { data: all } = await supabase
                .from('admin_notifications')
                .select('id, read_by');
            if (!all?.length) return;
            const unread = all.filter(n => !(n.read_by || []).includes(userId));
            if (!unread.length) return;
            await Promise.all(unread.map(n =>
                supabase.from('admin_notifications')
                    .update({ read_by: [...(n.read_by || []), userId] })
                    .eq('id', n.id)
            ));
            await fetchNotifications();
        });
    }
}