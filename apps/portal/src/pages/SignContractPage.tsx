import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../auth/useSession';
import { supabase } from '../api/supabaseClient';
import { apiFetch } from '../api/apiClient';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

export function SignContractPage() {
  const { session, status } = useSession();
  const navigate = useNavigate();

  const [app, setApp] = useState<any>(null);
  const [loadingApp, setLoadingApp] = useState(true);
  const [noApp, setNoApp] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  // Fetch user's pending application
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return;
    (async () => {
      const { data } = await supabase
        .from('loan_applications')
        .select('id, status, amount, offer_principal, offer_monthly_repayment, offer_total_repayment, offer_total_interest, offer_total_initiation_fees, term_months, offer_interest_rate, contract_signed_at')
        .eq('user_id', session.user.id)
        .in('status', ['OFFERED', 'CONTRACT_SIGN'])
        .is('contract_signed_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setApp(data ?? null);
      setNoApp(!data);
      setLoadingApp(false);
    })();
  }, [status, session?.user?.id]);

  // Initialise canvas drawing style
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
  }, [app]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawingRef.current = true;
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!drawingRef.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => { drawingRef.current = false; };

  const clearCanvas = () => {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSign = async () => {
    if (!canvasRef.current || !app?.id || !hasDrawn) return;
    setSigning(true);
    setSignError(null);
    try {
      const signatureDataUrl = canvasRef.current.toDataURL('image/png');
      const res = await apiFetch('/api/contracts/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: app.id, signatureDataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signing failed. Please try again.');
      setSigned(true);
      setTimeout(() => navigate('/user-portal/dashboard'), 4000);
    } catch (err: any) {
      setSignError(err.message);
    } finally {
      setSigning(false);
    }
  };

  const principal = Number(app?.offer_principal ?? app?.amount ?? 0);
  const monthly   = Number(app?.offer_monthly_repayment ?? 0);
  const total     = Number(app?.offer_total_repayment ?? 0);
  const term      = Number(app?.term_months ?? 0);

  if (status === 'loading' || loadingApp) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
        Loading your agreement…
      </div>
    );
  }

  if (noApp) {
    return (
      <div style={{ maxWidth: 480, margin: '48px auto', padding: 32, textAlign: 'center' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#d1d5db', display: 'block', marginBottom: 16 }}>task_alt</span>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>No pending agreement</h2>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 24px' }}>You don't have a loan agreement waiting to be signed right now.</p>
        <button onClick={() => navigate('/user-portal/dashboard')}
          style={{ padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--color-primary, #7c3aed)', color: '#fff', fontWeight: 700, fontSize: 14 }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (signed) {
    return (
      <div style={{ maxWidth: 480, margin: '48px auto', padding: 32, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 36, color: '#059669' }}>check_circle</span>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#111827', margin: '0 0 8px' }}>Agreement Signed!</h2>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 8px' }}>Your loan agreement has been signed successfully. A copy will be emailed to you.</p>
        <p style={{ fontSize: 12, color: '#9ca3af' }}>Redirecting to your dashboard…</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px 64px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: '0 0 4px' }}>Sign Your Loan Agreement</h1>
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px' }}>Review the terms below and draw your signature to confirm.</p>

      {/* Loan Summary */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>Loan Summary</h3>
        {[
          { label: 'Principal Amount', value: fmt(principal), highlight: true },
          { label: 'Term', value: `${term} month${term !== 1 ? 's' : ''}` },
          { label: 'Monthly Repayment', value: fmt(monthly) },
          { label: 'Total Repayable', value: fmt(total) },
        ].map(({ label, value, highlight }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f3f4f6', fontSize: 14 }}>
            <span style={{ color: '#6b7280' }}>{label}</span>
            <span style={{ fontWeight: highlight ? 900 : 700, color: highlight ? 'var(--color-primary, #7c3aed)' : '#111827' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* NCA Disclosure */}
      <div style={{ background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16, marginBottom: 20, fontSize: 11, color: '#6b7280', lineHeight: 1.6 }}>
        <strong style={{ color: '#374151' }}>National Credit Act Disclosure:</strong> By signing below you confirm you have read and understood the pre-agreement statement and you agree to the terms of this loan. You have the right to refer this matter to a debt counsellor or dispute resolution agent.
      </div>

      {/* Signature Canvas */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Your Signature</label>
          {hasDrawn && (
            <button onClick={clearCanvas} style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>
              Clear
            </button>
          )}
        </div>
        <canvas
          ref={canvasRef}
          width={520}
          height={140}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
          style={{
            width: '100%', height: 140, display: 'block',
            border: `1.5px dashed ${hasDrawn ? '#a78bfa' : '#d1d5db'}`,
            borderRadius: 10, cursor: 'crosshair', touchAction: 'none',
            background: '#fafafa',
          }}
        />
        {!hasDrawn && (
          <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', margin: '8px 0 0' }}>Draw your signature above</p>
        )}
      </div>

      {signError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#dc2626' }}>
          {signError}
        </div>
      )}

      <button
        onClick={handleSign}
        disabled={!hasDrawn || signing}
        style={{
          width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 800,
          cursor: hasDrawn && !signing ? 'pointer' : 'not-allowed',
          background: hasDrawn && !signing ? 'var(--color-primary, #7c3aed)' : '#e5e7eb',
          color: hasDrawn && !signing ? '#fff' : '#9ca3af',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: hasDrawn && !signing ? '0 4px 14px rgba(124,58,237,0.3)' : 'none',
          transition: 'all 0.15s',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
          {signing ? 'hourglass_top' : 'draw'}
        </span>
        {signing ? 'Signing…' : 'Confirm & Sign Agreement'}
      </button>
    </div>
  );
}
