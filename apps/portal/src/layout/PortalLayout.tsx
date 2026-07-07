import { useState, useEffect, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';

const NAV = [
  { label: 'Dashboard',       icon: 'fa-chart-line',    to: '/user-portal/dashboard',    color: 'var(--color-primary)' },
  { label: 'Apply for Loan',  icon: 'fa-file-contract', to: '/user-portal/apply',         color: '#10b981' },
  { label: 'Loan Calculator', icon: 'fa-calculator',    to: '/user-portal/calculator',    color: '#3b82f6' },
  { label: 'Transcripts',     icon: 'fa-file-lines',    to: '/user-portal/transcripts',   color: '#8b5cf6' },
  { label: 'Transactions',    icon: 'fa-receipt',       to: '/user-portal/transactions',  color: '#f59e0b' },
  { label: 'Support',         icon: 'fa-headset',       to: '/user-portal/support',       color: '#ec4899' },
  { label: 'Profile',         icon: 'fa-user',          to: '/user-portal/profile',       color: '#06b6d4' },
];

function NavItem({ label, icon, to, color }: { label: string; icon: string; to: string; color: string }) {
  return (
    <NavLink to={to} style={{ textDecoration: 'none', display: 'block', marginBottom: 2 }}>
      {({ isActive }) => (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '11px 16px', borderRadius: 10,
          background: isActive
            ? 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)'
            : 'transparent',
          color: isActive ? '#fff' : '#6b7280',
          fontWeight: isActive ? 600 : 500,
          fontSize: 14,
          transition: 'all 0.2s ease',
          boxShadow: isActive ? '0 2px 8px rgba(91,33,182,0.22)' : 'none',
        }}>
          <i
            className={`fa-solid ${icon}`}
            style={{ width: 18, textAlign: 'center', color: isActive ? '#fff' : color, fontSize: 14, flexShrink: 0 }}
          />
          <span>{label}</span>
        </div>
      )}
    </NavLink>
  );
}

export function PortalLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [initials, setInitials] = useState('U');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const email = user.email ?? '';
      const name  = user.user_metadata?.full_name ?? '';
      setUserEmail(email);
      setUserName(name);
      if (name) {
        setInitials(name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase());
      } else if (email) {
        setInitials(email[0].toUpperCase());
      }
    });
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/auth/login');
  }

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div style={{
        height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderBottom: '1px solid rgba(0,0,0,0.06)', flexShrink: 0
      }}>
        <img src="/algolend-logo.png" alt="AlgoLend"
          style={{ height: 36, width: 'auto', objectFit: 'contain', maxWidth: '80%' }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
        {NAV.map(item => <NavItem key={item.to} {...item} />)}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '12px', borderTop: '1px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
        {userName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 4 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0
            }}>
              {initials}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userName}</div>
              <div style={{ fontSize: 11, color: '#8E8E93', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userEmail}</div>
            </div>
          </div>
        )}
        <button
          onClick={handleSignOut}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 16px', borderRadius: 10, border: 'none',
            background: 'transparent', color: '#8E8E93',
            fontSize: 14, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'all 0.2s'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#fff1f2'; e.currentTarget.style.color = '#ef4444'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8E8E93'; }}
        >
          <i className="fa-solid fa-right-from-bracket" style={{ width: 18, textAlign: 'center' }} />
          <span>Sign Out</span>
        </button>
        <p style={{ textAlign: 'center', fontSize: 10, color: '#8E8E93', opacity: 0.45, margin: '8px 0 0', letterSpacing: '0.04em' }}>
          Powered by <strong>Mint Platforms</strong>
        </p>
      </div>
    </>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* ── Desktop Sidebar ── */}
      <aside style={{
        width: 260, flexShrink: 0, background: '#fff',
        borderRight: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '2px 0 16px rgba(0,0,0,0.04)',
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
        zIndex: 30,
      }} className="hidden md:flex">
        <SidebarContent />
      </aside>

      {/* ── Mobile sidebar overlay ── */}
      {mobileMenuOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside
            style={{
              width: 280, height: '100%', background: '#fff',
              display: 'flex', flexDirection: 'column', boxShadow: '4px 0 24px rgba(0,0,0,0.12)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main column ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <header style={{
          height: 64,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px',
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(24px) saturate(2)',
          WebkitBackdropFilter: 'blur(24px) saturate(2)',
          borderBottom: '1px solid rgba(91,33,182,0.10)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.8), 0 4px 24px rgba(0,0,0,0.05)',
          position: 'sticky', top: 0, zIndex: 40,
          flexShrink: 0,
        }}>
          {/* Left — mobile hamburger + mobile logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="md:hidden"
              onClick={() => setMobileMenuOpen(true)}
              style={{ width: 38, height: 38, borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', fontSize: 16 }}
            >
              <i className="fa-solid fa-bars" />
            </button>
            <img src="/algolend-logo.png" alt="AlgoLend"
              style={{ height: 30, width: 'auto', objectFit: 'contain' }}
              className="md:hidden"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          </div>

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button style={{
              width: 38, height: 38, borderRadius: 10, border: 'none',
              background: 'transparent', color: '#8E8E93', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
            }}>
              <i className="fa-regular fa-bell" />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'default'
              }}>
                {initials}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: '28px 24px', overflowX: 'hidden' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
