import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { useTheme } from '../theme/ThemeProvider';

// Same nav items, icons, and per-page icon colours as the legacy sidebar.html
const NAV_ITEMS = [
  { page: 'dashboard',       label: 'Dashboard',       icon: 'fa-chart-line' },
  { page: 'apply',           label: 'Apply for Loan',  icon: 'fa-file-contract' },
  { page: 'calculator',      label: 'Loan Calculator', icon: 'fa-calculator' },
  { page: 'transcripts',     label: 'Transcripts',     icon: 'fa-file-lines' },
  { page: 'transactions',    label: 'Transactions',    icon: 'fa-receipt' },
  { page: 'support',         label: 'Support',         icon: 'fa-headset' },
  { page: 'profile',         label: 'Profile',         icon: 'fa-user' },
];

// data-page values used by design-system.css icon colour rules
const LEGACY_PAGE_KEYS: Record<string, string> = {
  dashboard: 'dashboard',
  apply: 'apply-loan',
  calculator: 'loan-calculator',
  transcripts: 'transcripts',
  transactions: 'documents',
  support: 'support',
  profile: 'profile',
};

export function PortalLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [userName, setUserName]     = useState('Loading...');
  const [userEmail, setUserEmail]   = useState('Loading...');
  const [initials, setInitials]     = useState('U');
  const [accountOpen, setAccountOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const logoUrl = theme.company_logo_url || '/algolend-logo.png';

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const email = user.email ?? '';
      const name  = (user.user_metadata?.full_name as string) ?? email;
      setUserEmail(email);
      setUserName(name);
      const parts = name.trim().split(/\s+/).filter(Boolean);
      setInitials(parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || 'U');
    });
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/auth/login');
  }

  return (
    <>
      {/* ── Navbar (legacy navbar.html markup) ── */}
      <header className="navbar-desktop">
        <nav className="navbar">
          <div className="navbar-container">
            <button
              className="navbar-icon-btn mobile-nav-burger"
              aria-label="Toggle menu"
              onClick={() => setSidebarOpen(o => !o)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>

            <div className="navbar-logo">
              <img
                src={logoUrl} alt="Logo" data-brand-logo
                style={{ height: 40, width: 'auto', objectFit: 'contain', maxWidth: 160 }}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </div>

            <div className="navbar-search" role="search">
              <input
                type="text"
                className="search-input"
                placeholder="Search modules, pages..."
                autoComplete="off"
                onKeyDown={e => {
                  if (e.key !== 'Enter') return;
                  const q = (e.target as HTMLInputElement).value.toLowerCase();
                  const hit = NAV_ITEMS.find(n => n.label.toLowerCase().includes(q));
                  if (hit) navigate(`/user-portal/${hit.page}`);
                }}
              />
              <button className="search-submit" type="button" aria-label="Run search">
                <svg className="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M12 12l5 5" />
                </svg>
              </button>
            </div>

            <div className="navbar-right">
              <div className="notification-dropdown-container">
                <button className="navbar-icon-btn notification-btn" title="Notifications">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  <span className="notification-badge" style={{ display: 'none' }}>0</span>
                </button>
              </div>

              <div className="account-dropdown-container" ref={accountRef}>
                <button
                  className="navbar-icon-btn account-btn"
                  title="Account"
                  onClick={() => setAccountOpen(o => !o)}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M12 14c-6 0-8 3-8 3v3h16v-3s-2-3-8-3z" />
                  </svg>
                </button>
                <div className="account-dropdown" style={{ display: accountOpen ? 'block' : undefined }} data-open={accountOpen || undefined}>
                  <div className="dropdown-header">
                    <div className="user-avatar"><span>{initials}</span></div>
                    <div className="user-info">
                      <div className="user-name">{userName}</div>
                      <div className="user-email">{userEmail}</div>
                    </div>
                  </div>
                  <div className="dropdown-divider" />
                  <div className="dropdown-body">
                    <button className="dropdown-item" onClick={() => { setAccountOpen(false); navigate('/user-portal/profile'); }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <span>My Profile</span>
                    </button>
                  </div>
                  <div className="dropdown-divider" />
                  <div className="dropdown-footer">
                    <button className="dropdown-item logout-btn" onClick={handleSignOut}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </nav>
      </header>

      {/* ── Sidebar + main content (legacy index.html structure) ── */}
      <div className="dashboard-container">
        <div id="sidebar" className={sidebarOpen ? 'sidebar-open' : ''}>
          <aside className="sidebar">
            <div className="sidebar-container">
              <div className="sidebar-heading">
                <img
                  src={logoUrl} alt="Company logo" className="sidebar-logo-img" data-brand-logo
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              </div>

              <nav className="sidebar-nav">
                <ul className="nav-list">
                  {NAV_ITEMS.map(item => (
                    <li className="nav-item" key={item.page}>
                      <NavLink
                        to={`/user-portal/${item.page}`}
                        className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                        data-page={LEGACY_PAGE_KEYS[item.page]}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <i className={`fa-solid ${item.icon} nav-icon`} />
                        <span className="nav-label">{item.label}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="sidebar-bottom">
                <button className="logout-btn" onClick={handleSignOut}>
                  <i className="fa-solid fa-sign-out-alt" />
                  <span>Sign Out</span>
                </button>
                <div style={{ textAlign: 'center', padding: '10px 0 4px', opacity: 0.45, fontSize: 10, letterSpacing: '0.04em', color: 'inherit' }}>
                  Powered by <strong style={{ opacity: 0.8 }}>Mint Platforms</strong>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <main id="main-content">{children}</main>
      </div>
    </>
  );
}
