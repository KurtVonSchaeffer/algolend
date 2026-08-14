import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { useTheme } from '../theme/ThemeProvider';
import { ADMIN_NAV, getExpandedNavIds } from './adminNav';
import { CommandPalette } from '../components/CommandPalette';

const isDemoMode = () => localStorage.getItem('algolend_demo') === '1';

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
  const [cmdOpen, setCmdOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const logoUrl = theme.company_logo_url || `${import.meta.env.BASE_URL}algolend-logo.png`;

  useEffect(() => {
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
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { setNotifOpen(false); setCmdOpen(false); }
      if ((e.key === 'k') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen(o => !o);
      }
    }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    setExpanded(prev => ({ ...prev, ...getExpandedNavIds(location.pathname) }));
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
      <a href="#main-content" style={{ position: 'absolute', top: -9999, left: -9999 }}>Skip to content</a>

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
          {ADMIN_NAV.map(group => (
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(o => !o)}
              type="button"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <span className="admin-header-title">{title ?? 'Admin'}</span>
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              title="Search (⌘K)"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 12px 6px 10px',
                borderRadius: 10, border: '1px solid var(--color-border)',
                background: 'var(--color-surface-muted)',
                color: 'var(--color-text-muted)', cursor: 'pointer',
                fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(124,58,237,0.4)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-primary)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)'; }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>search</span>
              Search
              <kbd style={{ padding: '1px 5px', borderRadius: 5, border: '1px solid var(--color-border)', background: 'var(--color-surface-card)', fontSize: 10, fontWeight: 700, fontFamily: 'inherit', lineHeight: 1.6 }}>⌘K</kbd>
            </button>
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
                <span className="notif-badge">3</span>
                <span className="notif-badge-dot"></span>
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
        <main id="main-content" className="admin-page">{children}</main>
      </div>

      {/* Demo banner */}
      {isDemoMode() && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9000, background: 'rgba(124,58,237,0.92)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#fff', letterSpacing: '0.01em' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>science</span>
          Demo Mode — all data is fictional and for demonstration purposes only
          <button
            type="button"
            onClick={() => { localStorage.removeItem('algolend_demo'); window.location.replace('/auth/login'); }}
            style={{ marginLeft: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.35)', background: 'transparent', color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}
          >
            Exit Demo
          </button>
        </div>
      )}

      {/* Toast Container */}
      <div id="toast-container" />

      {/* Command Palette */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}
