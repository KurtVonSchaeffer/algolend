import React from 'react';
import { useNavigate } from 'react-router-dom';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ width: 80, height: 80, background: 'rgba(124,58,237,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--color-primary)' }}>search_off</span>
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-text)', marginBottom: 8 }}>Page Not Found</h1>
      <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 24, maxWidth: 400 }}>
        The page you are looking for does not exist or you do not have permission to access it.
      </p>
      <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>home</span>
        Return to Dashboard
      </button>
    </div>
  );
}
