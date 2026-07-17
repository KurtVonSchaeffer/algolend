import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { useTheme } from '../theme/ThemeProvider';

interface NavItem {
  href: string;
  icon: string;
  label: string;
}

interface NavGroup {
  section: string;
  items: NavItem[];
  submenu?: { id: string; label: string; icon: string; children: { href: string; label: string }[] };
}

const NAV: NavGroup[] = [
  {
    section: 'Overview',
    items: [{ href: '/dashboard', icon: 'dashboard', label: 'Dashboard' }],
    submenu: {
      id: 'analytics',
      label: 'Analytics',
      icon: 'bar_chart',
      children: [
        { href: '/analytics', label: 'Customer Analytics' },
        { href: '/financials', label: 'Financials' },
      ],
    },
  },
  {
    section: 'Applications',
    items: [
      { href: '/applications', icon: 'assignment', label: 'Applications' },
      { href: '/create-application', icon: 'add_circle', label: 'New Application' },
    ],
  },
  {
    section: 'Finance',
    items: [
      { href: '/users', icon: 'group', label: 'Users' },
      { href: '/mandates', icon: 'receipt_long', label: 'Mandates' },
    ],
    submenu: {
      id: 'payments',
      label: 'Payments',
      icon: 'payments',
      children: [
        { href: '/incoming-payments', label: 'Incoming' },
        { href: '/outgoing-payments', label: 'Outgoing' },
      ],
    },
  },
  {
    section: 'Tools',
    items: [
      { href: '/credit-rules',  icon: 'rule',                    label: 'Credit Rules' },
      { href: '/portfolio',     icon: 'analytics',               label: 'Portfolio' },
      { href: '/loan-book',     icon: 'menu_book',               label: 'Loan Book' },
      { href: '/cash-ledger',   icon: 'account_balance_wallet',  label: 'Cash Ledger' },
    ],
  },
  {
    section: 'Compliance',
    items: [
      { href: '/sacrra',             icon: 'verified_user',    label: 'SACRRA' },
      { href: '/sacrra-validator',   icon: 'rule_folder',      label: 'Migration Validator' },
      { href: '/ncr-reporting',      icon: 'assignment',       label: 'NCR Reporting' },
      { href: '/ncr-registers',      icon: 'manage_accounts',  label: 'NCR Registers' },
      { href: '/compliance-tracker', icon: 'checklist',        label: 'Compliance Tracker' },
      { href: '/goaml',              icon: 'security',         label: 'FIC goAML' },
    ],
  },
  {
    section: 'System',
    items: [{ href: '/settings', icon: 'settings', label: 'Settings' }],
  },
];

export function AdminLayout({ children, title }: { children: ReactNode; title?: string }) {
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [userName,  setUserName]  = useState('Admin');
  const [userRole,  setUserRole]  = useState('base_admin');
  const [initials,  setInitials]  = useState('A');
  const [expanded,  setExpanded]  = useState<Record<string, boolean>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const logoUrl = theme.company_logo_url || `${import.meta.env.BASE_URL}algolend-logo.png`;

  useEffect(() => {
    const demo = localStorage.getItem('algolend_demo') === '1';
    if (demo) {
      setUserName('Demo Admin');
      setInitials('DA');
      setUserRole('base_admin');
      return;
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const name = (user.user_metadata?.full_name as string) ?? user.email ?? 'Admin';
      const role = (user.app_metadata?.role ?? user.user_metadata?.role ?? 'base_admin') as string;
      setUserName(name);
      setUserRole(role.replace(/_/g, ' '));
      const parts = name.trim().split(/\s+/).filter(Boolean);
      setInitials(parts.slice(0, 2).map((p: string) => p[0]?.toUpperCase() ?? '').join('') || 'A');
    });
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  // Auto-expand submenu if current path matches a child
  useEffect(() => {
    const path = location.pathname;
    const updates: Record<string, boolean> = {};
    if (path.includes('/analytics') || path.includes('/financials')) updates['analytics'] = true;
    if (path.includes('/incoming-payments') || path.includes('/outgoing-payments')) updates['payments'] = true;
    if (Object.keys(updates).length) setExpanded(prev => ({ ...prev, ...updates }));
  }, [location.pathname]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.replace('/auth/login');
  }

  const currentPath = location.pathname;

  function isActive(href: string) {
    return currentPath === href || currentPath.startsWith(href + '/');
  }

  function toggleSubmenu(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div id="admin-shell" style={{ display: 'flex', minHeight: '100vh' }}>

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="admin-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`admin-sidebar${sidebarOpen ? ' open' : ''}`}>

        {/* Logo */}
        <div className="admin-sidebar-logo">
          <img
            src={logoUrl}
            alt="AlgoLend"
            data-brand-logo
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        </div>

        {/* Nav */}
        <nav className="admin-sidebar-nav">
          {NAV.map(group => (
            <div key={group.section}>
              <p className="nav-section-label">{group.section}</p>

              {group.items.map(item => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive: a }) => `nav-link${a ? ' nav-link-active' : ''}`}
                >
                  <span className="material-symbols-outlined">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}

              {group.submenu && (() => {
                const sub = group.submenu!;
                const open = !!expanded[sub.id];
                const childActive = sub.children.some(c => isActive(c.href));
                return (
                  <div key={sub.id}>
                    <button
                      type="button"
                      className={`nav-link${childActive ? ' nav-link-active' : ''}`}
                      onClick={() => toggleSubmenu(sub.id)}
                    >
                      <span className="material-symbols-outlined">{sub.icon}</span>
                      <span style={{ flex: 1, textAlign: 'left' }}>{sub.label}</span>
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 16, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}
                      >
                        expand_more
                      </span>
                    </button>
                    <ul className={`nav-submenu${open ? ' expanded' : ''}`}>
                      {sub.children.map(child => (
                        <li key={child.href}>
                          <NavLink
                            to={child.href}
                            onClick={() => setSidebarOpen(false)}
                            className={({ isActive: a }) => `nav-sublink${a ? ' active' : ''}`}
                          >
                            {child.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="admin-sidebar-footer">
          <button
            type="button"
            className="sign-out-btn"
            onClick={handleSignOut}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
            Sign Out
          </button>
          <p className="powered-by">Powered by <strong>Mint Platforms</strong></p>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="admin-main">

        {/* Atmospheric blobs */}
        <div className="atmo-blob atmo-blob-top" />
        <div className="atmo-blob atmo-blob-bottom" />

        {/* Header */}
        <header className="admin-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(o => !o)}
              type="button"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <span className="admin-header-title">{title ?? 'Admin'}</span>
          </div>

          <div className="admin-header-actions">
            {/* Notifications */}
            <div style={{ position: 'relative' }} ref={notifRef}>
              <button
                className="admin-icon-btn"
                title="Notifications"
                onClick={() => setNotifOpen(o => !o)}
                type="button"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>notifications</span>
              </button>
              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-header">
                    <span>Notifications</span>
                    <button type="button" style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      Mark all read
                    </button>
                  </div>
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                    No new notifications
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="header-divider" />

            {/* User info */}
            <button
              type="button"
              className="user-chip"
              onClick={() => { setNotifOpen(false); navigate('/settings'); }}
            >
              <div style={{ textAlign: 'right' }}>
                <div className="user-chip-name">{userName.split(' ')[0]}</div>
                <div className="user-chip-role">{userRole}</div>
              </div>
              <div className="user-avatar-sm">{initials}</div>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="admin-page">{children}</main>
      </div>
    </div>
  );
}
