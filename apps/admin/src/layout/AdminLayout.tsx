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
    items: [{ href: '/admin/dashboard', icon: 'dashboard', label: 'Dashboard' }],
    submenu: {
      id: 'analytics',
      label: 'Analytics',
      icon: 'bar_chart',
      children: [
        { href: '/admin/analytics', label: 'Customer Analytics' },
        { href: '/admin/financials', label: 'Financials' },
      ],
    },
  },
  {
    section: 'Applications',
    items: [
      { href: '/admin/applications', icon: 'assignment', label: 'Applications' },
      { href: '/admin/create-application', icon: 'add_circle', label: 'New Application' },
    ],
  },
  {
    section: 'Finance',
    items: [
      { href: '/admin/users', icon: 'group', label: 'Users' },
      { href: '/admin/mandates', icon: 'receipt_long', label: 'Mandates' },
    ],
    submenu: {
      id: 'payments',
      label: 'Payments',
      icon: 'payments',
      children: [
        { href: '/admin/incoming-payments', label: 'Incoming' },
        { href: '/admin/outgoing-payments', label: 'Outgoing' },
      ],
    },
  },
  {
    section: 'Tools',
    items: [
      { href: '/admin/credit-rules',  icon: 'rule',                    label: 'Credit Rules' },
      { href: '/admin/portfolio',     icon: 'analytics',               label: 'Portfolio' },
      { href: '/admin/loan-book',     icon: 'menu_book',               label: 'Loan Book' },
      { href: '/admin/cash-ledger',   icon: 'account_balance_wallet',  label: 'Cash Ledger' },
    ],
  },
  {
    section: 'Compliance',
    items: [
      { href: '/admin/sacrra',             icon: 'verified_user',    label: 'SACRRA' },
      { href: '/admin/sacrra-validator',   icon: 'rule_folder',      label: 'Migration Validator' },
      { href: '/admin/ncr-reporting',      icon: 'assignment',       label: 'NCR Reporting' },
      { href: '/admin/ncr-registers',      icon: 'manage_accounts',  label: 'NCR Registers' },
      { href: '/admin/compliance-tracker', icon: 'checklist',        label: 'Compliance Tracker' },
      { href: '/admin/goaml',              icon: 'security',         label: 'FIC goAML' },
    ],
  },
  {
    section: 'System',
    items: [{ href: '/admin/settings', icon: 'settings', label: 'Settings' }],
  },
];

export function AdminLayout({ children, title }: { children: ReactNode; title?: string }) {
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [userName,  setUserName]  = useState('Admin');
  const [initials,  setInitials]  = useState('A');
  const [dropOpen,  setDropOpen]  = useState(false);
  const [expanded,  setExpanded]  = useState<Record<string, boolean>>({});

  const dropRef = useRef<HTMLDivElement>(null);
  const logoUrl = theme.company_logo_url || '/algolend-logo.png';

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const name = (user.user_metadata?.full_name as string) ?? user.email ?? 'Admin';
      setUserName(name);
      const parts = name.trim().split(/\s+/).filter(Boolean);
      setInitials(parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || 'A');
    });
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false);
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
    window.location.replace('/auth/login.html');
  }

  const currentPath = location.pathname;

  function isActive(href: string) {
    return currentPath === href || currentPath.startsWith(href + '/');
  }

  function toggleSubmenu(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div id="admin-shell">
      {/* ── Sidebar ── */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <img
            src={logoUrl} alt="AlgoLend" data-brand-logo
            style={{ height: 36, width: 'auto', objectFit: 'contain', maxWidth: 150 }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        </div>

        <nav className="admin-sidebar-nav">
          {NAV.map(group => (
            <div key={group.section}>
              <p className="nav-section-label">{group.section}</p>

              {group.items.map(item => (
                <NavLink
                  key={item.href}
                  to={item.href}
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
                  <div>
                    <button
                      type="button"
                      className={`nav-link${childActive ? ' nav-link-active' : ''}`}
                      onClick={() => toggleSubmenu(sub.id)}
                      style={{ justifyContent: 'space-between' }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className="material-symbols-outlined">{sub.icon}</span>
                        {sub.label}
                      </span>
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 16, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}
                      >
                        expand_more
                      </span>
                    </button>
                    <ul className={`nav-submenu${open ? ' expanded' : ''}`} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {sub.children.map(child => (
                        <li key={child.href}>
                          <NavLink
                            to={child.href}
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

        <div className="admin-sidebar-footer">
          <button
            type="button"
            className="nav-link"
            onClick={handleSignOut}
            style={{ color: '#EF4444', width: '100%' }}
          >
            <span className="material-symbols-outlined">logout</span>
            Sign Out
          </button>
          <div style={{ textAlign: 'center', padding: '10px 0 0', opacity: 0.4, fontSize: 10, letterSpacing: '0.05em' }}>
            Powered by <strong>Mint Platforms</strong>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="admin-main">
        {/* Top header */}
        <header className="admin-header">
          <span className="admin-header-title">{title ?? 'Admin'}</span>

          <div className="admin-header-actions">
            <button className="admin-icon-btn" title="Notifications">
              <i className="fa-solid fa-bell" style={{ fontSize: 15 }} />
            </button>

            {/* User dropdown */}
            <div style={{ position: 'relative' }} ref={dropRef}>
              <button
                className="user-chip"
                onClick={() => setDropOpen(o => !o)}
                type="button"
              >
                <div className="user-avatar-sm">{initials}</div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                  {userName.split(' ')[0]}
                </span>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-text-muted)' }}>
                  expand_more
                </span>
              </button>

              {dropOpen && (
                <div className="dropdown-menu">
                  <div className="dropdown-user-header">
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{userName}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>Administrator</div>
                  </div>
                  <button className="dropdown-item" onClick={() => { setDropOpen(false); navigate('/admin/settings'); }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>settings</span>
                    Settings
                  </button>
                  <button className="dropdown-item danger" onClick={handleSignOut}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="admin-page">{children}</main>
      </div>
    </div>
  );
}
