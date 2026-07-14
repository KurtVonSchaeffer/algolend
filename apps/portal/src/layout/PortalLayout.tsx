import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { useTheme } from '../theme/ThemeProvider';
import { useProfileCompletion } from '../hooks/useProfileCompletion';

const NAV_ITEMS = [
  { page: 'dashboard',    label: 'Dashboard',       icon: 'fa-chart-line' },
  { page: 'apply',        label: 'Apply for Loan',  icon: 'fa-file-contract' },
  { page: 'calculator',   label: 'Loan Calculator', icon: 'fa-calculator' },
  { page: 'transcripts',  label: 'Transcripts',     icon: 'fa-file-lines' },
  { page: 'transactions', label: 'Transactions',    icon: 'fa-receipt' },
  { page: 'support',      label: 'Support',         icon: 'fa-headset' },
  { page: 'profile',      label: 'Profile',         icon: 'fa-user' },
];

// data-page values used by design-system.css icon colour rules
const LEGACY_PAGE_KEYS: Record<string, string> = {
  dashboard:    'dashboard',
  apply:        'apply-loan',
  calculator:   'loan-calculator',
  transcripts:  'transcripts',
  transactions: 'documents',
  support:      'support',
  profile:      'profile',
};

// 6 items shown in the Luma floating dock on mobile
const LUMA_ITEMS = [
  { page: 'dashboard',    icon: 'fa-house',          tooltip: 'Home'    },
  { page: 'apply',        icon: 'fa-file-contract',  tooltip: 'Apply'   },
  { page: 'transactions', icon: 'fa-receipt',        tooltip: 'Pay'     },
  { page: 'transcripts',  icon: 'fa-chart-line',     tooltip: 'Credit'  },
  { page: 'support',      icon: 'fa-headset',        tooltip: 'Support' },
  { page: 'profile',      icon: 'fa-user',           tooltip: 'Profile' },
];

export function PortalLayout({ children }: { children: ReactNode }) {
  const navigate   = useNavigate();
  const location   = useLocation();
  const { theme }  = useTheme();

  const [userName,    setUserName]    = useState('Loading...');
  const [userEmail,   setUserEmail]   = useState('Loading...');
  const [initials,    setInitials]    = useState('U');
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileAccountOpen, setMobileAccountOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const profileCompletion = useProfileCompletion();

  const accountRef       = useRef<HTMLDivElement>(null);
  const mobileAccountRef = useRef<HTMLDivElement>(null);

  const logoUrl = theme.company_logo_url || '/algolend-logo.png';

  // current page key for Luma active state
  const currentPage = location.pathname.replace('/user-portal/', '').split('/')[0];

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
      if (mobileAccountRef.current && !mobileAccountRef.current.contains(e.target as Node)) setMobileAccountOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  // close more-menu on navigation
  useEffect(() => { setMoreMenuOpen(false); }, [location.pathname]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/auth/login');
  }

  function showProfileIncompleteToast(missing: string[]) {
    const existing = document.querySelector('.profile-incomplete-toast');
    if (existing) { (existing as HTMLElement).style.animation = 'none'; setTimeout(() => { (existing as HTMLElement).style.animation = 'pulse 0.3s ease'; }, 10); return; }
    const toast = document.createElement('div');
    toast.className = 'profile-incomplete-toast';
    toast.style.cssText = 'position:fixed;top:90px;right:20px;background:linear-gradient(135deg,#EF4444,#DC2626);color:white;padding:16px 24px;border-radius:12px;box-shadow:0 8px 24px rgba(239,68,68,0.3);z-index:10000;max-width:400px;font-weight:600;border:2px solid rgba(255,255,255,0.2);font-family:inherit;';
    toast.innerHTML = `<div style="display:flex;align-items:start;gap:12px;"><i class="fa-solid fa-triangle-exclamation" style="font-size:24px;margin-top:2px;"></i><div><div style="font-size:16px;margin-bottom:8px;">Profile Incomplete</div><div style="font-size:13px;opacity:0.95;line-height:1.5;">Please complete: <strong>${missing.join(' &amp; ')}</strong></div><div style="font-size:12px;opacity:0.85;margin-top:6px;">Go to Profile → ${missing[0]}</div></div></div>`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 5000);
  }

  function guardedNavigate(page: string) {
    if (page === 'apply' && !profileCompletion.loading && !profileCompletion.isComplete) {
      showProfileIncompleteToast(profileCompletion.missingItems);
      navigate('/user-portal/profile');
      return;
    }
    navigate(`/user-portal/${page}`);
  }

  function lumaNavigate(page: string) {
    guardedNavigate(page);
  }

  const accountDropdown = (open: boolean, onToggle: () => void, ref: React.RefObject<HTMLDivElement>) => (
    <div className="account-dropdown-container" ref={ref}>
      <button className="navbar-icon-btn account-btn" title="Account" onClick={onToggle}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="8" r="4" />
          <path d="M12 14c-6 0-8 3-8 3v3h16v-3s-2-3-8-3z" />
        </svg>
      </button>
      <div className="account-dropdown" style={{ display: open ? 'block' : undefined }} data-open={open || undefined}>
        <div className="dropdown-header">
          <div className="user-avatar"><span>{initials}</span></div>
          <div className="user-info">
            <div className="user-name">{userName}</div>
            <div className="user-email">{userEmail}</div>
          </div>
        </div>
        <div className="dropdown-divider" />
        <div className="dropdown-body">
          <button className="dropdown-item" onClick={() => { onToggle(); navigate('/user-portal/profile'); }}>
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
  );

  return (
    <>
      {/* ── Desktop Navbar ── */}
      <header className="navbar-desktop">
        <nav className="navbar">
          <div className="navbar-container">
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
              {accountDropdown(accountOpen, () => setAccountOpen(o => !o), accountRef)}
            </div>
          </div>
        </nav>
      </header>

      {/* ── Mobile Navbar ── */}
      <header className="navbar-mobile">
        <nav className="navbar" id="mobileNavbar">
          <div className="navbar-container">
            <div className="navbar-logo">
              <img
                src={logoUrl} alt="Logo" data-brand-logo
                style={{ height: 40, width: 'auto', objectFit: 'contain', maxWidth: 140 }}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </div>

            <div className="navbar-search" role="search">
              <button className="search-submit" type="button" aria-label="Open search">
                <svg className="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M12 12l5 5" />
                </svg>
              </button>
            </div>

            <div className="navbar-right">
              <div className="notification-dropdown-container">
                <button className="navbar-icon-btn notification-btn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  <span className="notification-badge" style={{ display: 'none' }}>0</span>
                </button>
              </div>
              {accountDropdown(mobileAccountOpen, () => setMobileAccountOpen(o => !o), mobileAccountRef)}
            </div>
          </div>
        </nav>
      </header>

      {/* ── Sidebar + main content ── */}
      <div className="dashboard-container">
        <div id="sidebar">
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
                      {item.page === 'apply' ? (
                        <button
                          className={`nav-link${currentPage === 'apply' ? ' active' : ''}`}
                          data-page={LEGACY_PAGE_KEYS[item.page]}
                          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}
                          onClick={() => guardedNavigate('apply')}
                        >
                          <i className={`fa-solid ${item.icon} nav-icon`} />
                          <span className="nav-label">{item.label}</span>
                        </button>
                      ) : (
                        <NavLink
                          to={`/user-portal/${item.page}`}
                          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                          data-page={LEGACY_PAGE_KEYS[item.page]}
                        >
                          <i className={`fa-solid ${item.icon} nav-icon`} />
                          <span className="nav-label">{item.label}</span>
                        </NavLink>
                      )}
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

      {/* ── Luma floating dock (mobile only) ── */}
      <nav className="luma-nav-container" aria-label="Mobile navigation">
        <div className="luma-glow" />
        <div className="luma-dock">
          {LUMA_ITEMS.map(item => (
            <button
              key={item.page}
              className={`luma-item${currentPage === item.page ? ' active' : ''}`}
              data-page={LEGACY_PAGE_KEYS[item.page]}
              onClick={() => lumaNavigate(item.page)}
              aria-label={item.tooltip}
            >
              <i className={`fa-solid ${item.icon}`} />
              <span className="luma-tooltip">{item.tooltip}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ── Full-screen more menu (mobile) ── */}
      <div id="fullScreenMenu" className={`more-menu-overlay${moreMenuOpen ? ' open' : ''}`}>
        <div className="menu-header-wrapper">
          <button className="close-menu-btn" onClick={() => setMoreMenuOpen(false)}>
            <i className="fa-solid fa-arrow-left" />
          </button>
          <div className="menu-title">MENU</div>
          <span />
        </div>

        <div className="menu-list-container">
          <div className={`menu-list-item${currentPage === 'dashboard' ? ' active' : ''}`} onClick={() => lumaNavigate('dashboard')}>
            <span className="menu-label">Dashboard</span>
            <i className="fa-solid fa-chevron-right arrow-icon" />
          </div>

          <div className="menu-section">
            <span className="section-heading">LOAN SERVICES</span>
            <div className={`menu-list-item${currentPage === 'apply' ? ' active' : ''}`} onClick={() => lumaNavigate('apply')}>
              <span className="menu-label">Apply for Loan</span>
              <i className="fa-solid fa-chevron-right arrow-icon" />
            </div>
            <div className={`menu-list-item${currentPage === 'calculator' ? ' active' : ''}`} onClick={() => lumaNavigate('calculator')}>
              <span className="menu-label">Loan Calculator</span>
              <i className="fa-solid fa-chevron-right arrow-icon" />
            </div>
          </div>

          <div className="menu-section">
            <span className="section-heading">ACCOUNT</span>
            <div className={`menu-list-item${currentPage === 'profile' ? ' active' : ''}`} onClick={() => lumaNavigate('profile')}>
              <span className="menu-label">Profile</span>
              <i className="fa-solid fa-chevron-right arrow-icon" />
            </div>
            <div className={`menu-list-item${currentPage === 'transcripts' ? ' active' : ''}`} onClick={() => lumaNavigate('transcripts')}>
              <span className="menu-label">Transcripts</span>
              <i className="fa-solid fa-chevron-right arrow-icon" />
            </div>
            <div className={`menu-list-item${currentPage === 'transactions' ? ' active' : ''}`} onClick={() => lumaNavigate('transactions')}>
              <span className="menu-label">Transactions</span>
              <i className="fa-solid fa-chevron-right arrow-icon" />
            </div>
          </div>

          <div className="menu-section">
            <span className="section-heading">HELP</span>
            <div className={`menu-list-item${currentPage === 'support' ? ' active' : ''}`} onClick={() => lumaNavigate('support')}>
              <span className="menu-label">Support &amp; FAQ</span>
              <i className="fa-solid fa-chevron-right arrow-icon" />
            </div>
          </div>
        </div>

        <div className="menu-footer">
          <button className="menu-logout-btn" onClick={handleSignOut}>
            <i className="fa-solid fa-sign-out-alt" />
            <span>Sign Out</span>
          </button>
          <div style={{ textAlign: 'center', padding: '12px 0 4px', opacity: 0.4, fontSize: 10, letterSpacing: '0.04em' }}>
            Powered by <strong>Mint Platforms</strong>
          </div>
        </div>
      </div>
    </>
  );
}
