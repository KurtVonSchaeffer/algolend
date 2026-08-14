import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function DemoPage() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  function enterDemo() {
    localStorage.setItem('algolend_demo', '1');
    navigate('/dashboard', { replace: true });
  }

  useEffect(() => {
    if (countdown <= 0) { enterDemo(); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  const features = [
    { icon: 'dashboard',      label: 'Dashboard',         desc: 'Live KPIs, charts & portfolio overview' },
    { icon: 'assignment',     label: 'Applications',      desc: 'Review, approve & decline loan applications' },
    { icon: 'verified',       label: 'Mandates',          desc: 'DebiCheck mandate management' },
    { icon: 'payments',       label: 'Payments',          desc: 'Incoming collections & outgoing disbursements' },
    { icon: 'analytics',      label: 'Analytics',         desc: 'Customer analytics & growth trends' },
    { icon: 'gavel',          label: 'Compliance',        desc: 'SACRRA, NCR & FIC goAML reporting' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0720 0%, #1a0a3d 50%, #0a1628 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @keyframes floatIn { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse-ring { 0%,100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.4); } 50% { box-shadow: 0 0 0 16px rgba(124,58,237,0); } }
        .demo-enter-btn:hover { background: rgba(124,58,237,0.9) !important; transform: translateY(-2px); box-shadow: 0 12px 40px rgba(124,58,237,0.5) !important; }
        .demo-feature-card:hover { background: rgba(124,58,237,0.12) !important; border-color: rgba(124,58,237,0.3) !important; }
      `}</style>

      <div style={{ maxWidth: 720, width: '100%', animation: 'floatIn 0.6s ease-out' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 100, padding: '6px 16px', marginBottom: 24 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', display: 'inline-block', animation: 'pulse-ring 2s infinite' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Interactive Demo</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#7C3AED,#6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#fff' }}>account_balance</span>
            </div>
            <div style={{ textAlign: 'left' }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>AlgoLend Admin</h1>
              <p style={{ fontSize: 13, color: '#A78BFA', margin: 0, fontWeight: 500 }}>by Mint Platforms</p>
            </div>
          </div>

          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.7)', margin: '0 auto', maxWidth: 480, lineHeight: 1.6 }}>
            Explore a fully-functional lending management platform — complete with demo data. No sign-up required.
          </p>
        </div>

        {/* Feature grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 40 }}>
          {features.map(f => (
            <div
              key={f.label}
              className="demo-feature-card"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 12, transition: 'all 0.2s', cursor: 'default' }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(124,58,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#A78BFA' }}>{f.icon}</span>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: '0 0 3px' }}>{f.label}</p>
                <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.4 }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            className="demo-enter-btn"
            onClick={enterDemo}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 32px', borderRadius: 14, border: 'none', background: 'rgba(124,58,237,0.8)', color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 8px 30px rgba(124,58,237,0.35)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>play_circle</span>
            Enter Demo
            <span style={{ fontSize: 12, opacity: 0.75, fontWeight: 500 }}>({countdown}s)</span>
          </button>
          <p style={{ marginTop: 16, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            All data is fictional and for demonstration purposes only.
          </p>
        </div>
      </div>
    </div>
  );
}
