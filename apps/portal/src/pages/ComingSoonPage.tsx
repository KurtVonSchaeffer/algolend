interface ComingSoonPageProps {
  title: string;
  icon: string;
}

export function ComingSoonPage({ title, icon }: ComingSoonPageProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-1px', color: '#1C1C1E', margin: 0 }}>{title}</h1>
      </div>
      <div style={{
        background: '#fff', borderRadius: 24, padding: '64px 24px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)',
        textAlign: 'center'
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18, margin: '0 auto 16px',
          background: 'rgba(91,33,182,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <i className={`fa-solid ${icon}`} style={{ fontSize: 24, color: 'var(--color-primary)' }} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: '0 0 6px' }}>Coming Soon</h2>
        <p style={{ fontSize: 14, color: '#8E8E93', margin: 0 }}>
          The {title} page is being migrated to the new portal.
        </p>
      </div>
    </div>
  );
}
