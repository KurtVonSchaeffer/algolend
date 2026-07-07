import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';

const SHADOW_SOFT = '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)';
const RADIUS = 24;

// ── risk colours (SVG needs real hex, no CSS vars) ────────────────────────────

const SCORE_RISK_COLORS: Record<string, string> = {
  'very low risk':  '#10B981',
  'low risk':       '#22C55E',
  'medium risk':    '#E7762E',
  'high risk':      '#F97316',
  'very high risk': '#EF4444',
};

const SCORE_RISK_GLOWS: Record<string, string> = {
  'very low risk':  'rgba(16, 185, 129, 0.55)',
  'low risk':       'rgba(34, 197, 94, 0.55)',
  'medium risk':    'rgba(231, 118, 46, 0.55)',
  'high risk':      'rgba(249, 115, 22, 0.55)',
  'very high risk': 'rgba(239, 68, 68, 0.55)',
};

const SCORE_BANDS = [
  { label: 'Very High Risk', min: 300, max: 499, color: '#EF4444' },
  { label: 'High Risk',      min: 500, max: 599, color: '#F97316' },
  { label: 'Medium Risk',    min: 600, max: 679, color: '#E7762E' },
  { label: 'Low Risk',       min: 680, max: 749, color: '#22C55E' },
  { label: 'Very Low Risk',  min: 750, max: 999, color: '#10B981' },
];

// ── types ─────────────────────────────────────────────────────────────────────

interface CreditCheck {
  id: string;
  credit_score: number | null;
  risk_category: string | null;
  score_band: string | null;
  recommendation_reason: string | null;
  bureau_name: string | null;
  checked_at: string;
  total_accounts: number | null;
  open_accounts: number | null;
  closed_accounts: number | null;
  accounts_with_arrears: number | null;
  total_balance: number | null;
  total_monthly_payment: number | null;
  total_arrears_amount: number | null;
  total_enquiries: number | null;
  total_judgments: number | null;
  total_judgment_amount: number | null;
}

interface DocUpload {
  id: string;
  file_name: string;
  file_type: string;
  file_path: string;
  uploaded_at: string;
}

// ── utils ─────────────────────────────────────────────────────────────────────

const fmtCurrency = (v: unknown) =>
  typeof v === 'number' ? new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(v) : '—';
const fmtNumber = (v: unknown) => (v == null ? '—' : new Intl.NumberFormat('en-ZA').format(Number(v)));
const fmtDate = (v: string | null) =>
  v ? new Intl.DateTimeFormat('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(v)) : '—';

const METRICS_CONFIG: { key: keyof CreditCheck; label: string; currency?: boolean }[] = [
  { key: 'total_accounts',        label: 'Total Accounts' },
  { key: 'open_accounts',         label: 'Open Accounts' },
  { key: 'closed_accounts',       label: 'Closed Accounts' },
  { key: 'accounts_with_arrears', label: 'Accounts In Arrears' },
  { key: 'total_balance',         label: 'Total Balance', currency: true },
  { key: 'total_monthly_payment', label: 'Monthly Instalments', currency: true },
  { key: 'total_arrears_amount',  label: 'Total Arrears', currency: true },
  { key: 'total_enquiries',       label: 'Enquiries (All Time)' },
  { key: 'total_judgments',       label: 'Judgements' },
  { key: 'total_judgment_amount', label: 'Judgement Value', currency: true },
];

// ── data ──────────────────────────────────────────────────────────────────────

async function fetchTranscripts() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in to view your credit transcripts.');
  const uid = session.user.id;

  const [{ data: checks, error }, { data: docs }] = await Promise.all([
    supabase.from('credit_checks').select('*').eq('user_id', uid).order('checked_at', { ascending: false }),
    supabase.from('document_uploads').select('id, file_name, file_type, file_path, uploaded_at')
      .eq('user_id', uid).in('file_type', ['till_slip', 'bank_statement']).order('uploaded_at', { ascending: false }),
  ]);
  if (error) throw error;

  const docMap: Record<string, DocUpload> = {};
  (docs ?? []).forEach(d => { if (!docMap[d.file_type]) docMap[d.file_type] = d; });

  return { checks: (checks ?? []) as CreditCheck[], docMap, userId: uid };
}

// ── gauge ─────────────────────────────────────────────────────────────────────

function GaugeTicks() {
  const cx = 100, cy = 100, COUNT = 30;
  const ticks = [];
  for (let i = 0; i <= COUNT; i++) {
    const angleRad = (135 + i * (270 / COUNT)) * Math.PI / 180;
    const isMajor = i % 5 === 0;
    const rOuter = isMajor ? 95 : 93;
    const rInner = isMajor ? 88 : 90;
    ticks.push(
      <line
        key={i}
        x1={(cx + rOuter * Math.cos(angleRad)).toFixed(2)}
        y1={(cy + rOuter * Math.sin(angleRad)).toFixed(2)}
        x2={(cx + rInner * Math.cos(angleRad)).toFixed(2)}
        y2={(cy + rInner * Math.sin(angleRad)).toFixed(2)}
        stroke={`rgba(15,23,42,${isMajor ? 0.18 : 0.09})`}
        strokeWidth={isMajor ? 1.8 : 1}
        strokeLinecap="round"
      />
    );
  }
  return <g>{ticks}</g>;
}

function ScoreGauge({ score, color, glow }: { score: number | null; color: string; glow: string }) {
  const MAX_ARC = 377;      // 270° fraction of circumference
  const CIRC = 502.65;      // 2π × 80
  const [fill, setFill] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    if (typeof score !== 'number') return;
    const fraction = Math.max(0, Math.min(1, (score - 300) / 699));
    const t = setTimeout(() => setFill(fraction * MAX_ARC), 120);

    // count-up animation
    const DURATION = 1700;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / DURATION, 1);
      setDisplayScore(Math.round((1 - Math.pow(1 - progress, 3)) * score));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, [score]);

  return (
    <div style={{ position: 'relative', width: 240, height: 240, margin: '0 auto' }}>
      <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%' }}>
        <GaugeTicks />
        <circle cx={100} cy={100} r={80} transform="rotate(135, 100, 100)"
          fill="none" stroke="#f1f5f9" strokeWidth={14} strokeLinecap="round"
          strokeDasharray={`${MAX_ARC} ${CIRC}`} />
        <circle cx={100} cy={100} r={80} transform="rotate(135, 100, 100)"
          fill="none" stroke={color} strokeWidth={14} strokeLinecap="round"
          strokeDasharray={`${fill} ${CIRC}`}
          style={{ transition: 'stroke-dasharray 1.9s cubic-bezier(0.22,1,0.36,1)', filter: `drop-shadow(0 0 8px ${glow})` }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#94A3B8' }}>SCORE</span>
        <span style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-2px', color: '#0F172A', lineHeight: 1 }}>
          {typeof score === 'number' ? displayScore : '—'}
        </span>
      </div>
      <span style={{ position: 'absolute', bottom: 26, left: 30, fontSize: 11, fontWeight: 700, color: '#94A3B8' }}>300</span>
      <span style={{ position: 'absolute', bottom: 26, right: 30, fontSize: 11, fontWeight: 700, color: '#94A3B8' }}>999</span>
    </div>
  );
}

// ── modal shell ───────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(244,240,234,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 32, width: '100%', maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 60px rgba(0,0,0,0.10)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '28px 32px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1C1C1E', margin: 0, letterSpacing: '-0.5px' }}>{title}</h2>
          <button onClick={onClose} style={{ background: '#FAFAFA', border: 'none', width: 40, height: 40, borderRadius: '50%', color: '#1C1C1E', cursor: 'pointer', fontSize: 15 }}>
            <i className="fas fa-times" />
          </button>
        </div>
        <div style={{ padding: '0 32px 32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── eligibility tiers (verbatim thresholds from legacy) ───────────────────────

function eligibilityForScore(score: number) {
  if (score < 500) return {
    max: 0, rate: '—', term: '—', icon: 'fa-ban',
    msg: 'Loans currently unavailable. Focus on settling existing debt to rebuild your score.',
    bg: 'linear-gradient(135deg,#FEE2E2,#FECACA)',
  };
  if (score < 600) return {
    max: 2000, rate: '32%', term: '1-3 months', icon: 'fa-triangle-exclamation',
    msg: 'Small short-term loans available. Demonstrate good repayment history to unlock larger amounts.',
    bg: 'linear-gradient(135deg,#FFEDD5,#FED7AA)',
  };
  if (score < 680) return {
    max: 8000, rate: '28%', term: '1-6 months', icon: 'fa-thumbs-up',
    msg: 'You qualify for our standard loan range. Good payment history will increase your limits.',
    bg: 'linear-gradient(135deg,#FFF7ED,#FFEDD5)',
  };
  if (score < 750) return {
    max: 15000, rate: '24%', term: '1-12 months', icon: 'fa-circle-check',
    msg: 'Excellent standing! You qualify for our premium loans with competitive rates.',
    bg: 'linear-gradient(135deg,#D1FAE5,#A7F3D0)',
  };
  return {
    max: 25000, rate: '20%', term: '1-24 months', icon: 'fa-star',
    msg: 'Top tier credit. You qualify for our highest loan amounts with our best rates.',
    bg: 'linear-gradient(135deg,#A7F3D0,#6EE7B7)',
  };
}

function improvementTips(score: number | null, latest: CreditCheck | null) {
  const arrears   = Number(latest?.accounts_with_arrears ?? 0);
  const judgments = Number(latest?.total_judgments ?? 0);
  const enquiries = Number(latest?.total_enquiries ?? 0);
  const tips: { icon: string; title: string; desc: string; urgent: boolean }[] = [];

  if (arrears > 0) tips.push({ icon: 'fa-circle-exclamation', title: 'Settle accounts in arrears', desc: `You have ${arrears} account${arrears > 1 ? 's' : ''} in arrears. Bringing these up to date is the single biggest boost to your score.`, urgent: true });
  if (judgments > 0) tips.push({ icon: 'fa-gavel', title: 'Resolve judgements', desc: `${judgments} judgement${judgments > 1 ? 's' : ''} on your record. Contact a debt counsellor to negotiate settlement and have these removed.`, urgent: true });
  if (enquiries > 6) tips.push({ icon: 'fa-eye-slash', title: 'Limit credit applications', desc: `You have ${enquiries} bureau enquiries. Too many credit applications in a short period hurt your score. Avoid applying for new credit for 3-6 months.`, urgent: false });
  if (typeof score === 'number' && score < 680) {
    tips.push({ icon: 'fa-calendar-check', title: 'Pay every account on time', desc: 'Set up debit orders to ensure no payments are missed. Even one late payment can drop your score by 50-100 points.', urgent: false });
    tips.push({ icon: 'fa-arrow-trend-down', title: 'Keep balances low', desc: 'Use less than 30% of any available credit limit. High utilisation signals risk to lenders.', urgent: false });
  }
  if (tips.length === 0 && typeof score === 'number') {
    tips.push({ icon: 'fa-circle-check', title: "You're doing great!", desc: 'Continue paying all accounts on time and your score will keep growing. Avoid unnecessary credit applications.', urgent: false });
  }
  return tips.slice(0, 4);
}

// ── main page ─────────────────────────────────────────────────────────────────

export function TranscriptsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [modal, setModal] = useState<'history' | 'till_slip' | 'bank_statement' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['transcripts'],
    queryFn: fetchTranscripts,
    staleTime: 60_000,
    retry: 1,
  });

  const checks  = data?.checks ?? [];
  const latest  = checks[0] ?? null;
  const score   = latest?.credit_score ?? null;
  const riskText = latest?.risk_category || latest?.score_band || 'Pending';
  const riskKey  = riskText.toLowerCase();
  const color    = SCORE_RISK_COLORS[riskKey] || '#E7762E';
  const glow     = SCORE_RISK_GLOWS[riskKey] || 'rgba(231,118,46,0.55)';

  async function handleUpload(file: File) {
    if (!data?.userId || !modal || modal === 'history') return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${data.userId}/${modal}_${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage.from('documents').upload(path, file);
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);

      const { error: dbErr } = await supabase.from('document_uploads').insert([{
        user_id: data.userId, file_name: file.name, file_type: modal, file_path: publicUrl,
      }]);
      if (dbErr) throw dbErr;

      await queryClient.invalidateQueries({ queryKey: ['transcripts'] });
      setNotice({ type: 'success', text: 'Document uploaded successfully!' });
      setTimeout(() => setNotice(null), 3000);
    } catch (e) {
      setNotice({ type: 'error', text: e instanceof Error ? e.message : 'Failed to upload document. Please try again.' });
    } finally {
      setUploading(false);
    }
  }

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}><i className="fas fa-circle-notch fa-spin" style={{ fontSize: 28, color: 'var(--color-primary)' }} /></div>;
  }

  if (isError) {
    return (
      <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: RADIUS, padding: 24, color: '#be123c', fontSize: 14 }}>
        <i className="fas fa-exclamation-triangle" style={{ marginRight: 8 }} />
        {error instanceof Error ? error.message : 'Unable to load transcripts.'}
      </div>
    );
  }

  const elig = typeof score === 'number' ? eligibilityForScore(score) : null;
  const tips = improvementTips(score, latest);
  const history = checks.filter(c => typeof c.credit_score === 'number').slice(0, 6).reverse();
  const scorePct = typeof score === 'number' ? Math.max(0, Math.min(100, ((score - 300) / 699) * 100)) : 0;

  const modalDoc = modal && modal !== 'history' ? data?.docMap[modal] : undefined;
  const modalDocTitle = modal === 'till_slip' ? 'Payslip Document' : 'Bank Statement';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 860 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-1px', color: '#1C1C1E', margin: 0 }}>Credit Transcripts</h1>
          <p style={{ fontSize: 14, color: '#8E8E93', margin: '4px 0 0', fontWeight: 500 }}>
            Review bureau decisioning data and access supporting documents.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          style={{ height: 46, padding: '0 22px', borderRadius: 12, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: isFetching ? 'default' : 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(91,33,182,0.35)' }}
        >
          <i className={`fas ${isFetching ? 'fa-circle-notch fa-spin' : 'fa-rotate'}`} style={{ marginRight: 8 }} />
          {isFetching ? 'Refreshing…' : 'Refresh Data'}
        </button>
      </div>

      {/* Notice */}
      {notice && (
        <div style={{
          background: notice.type === 'success' ? '#f0fdf4' : '#fff1f2',
          border: `1px solid ${notice.type === 'success' ? '#bbf7d0' : '#fecdd3'}`,
          borderRadius: 14, padding: '12px 16px', fontSize: 13, fontWeight: 600,
          color: notice.type === 'success' ? '#166534' : '#be123c',
        }}>
          <i className={`fas ${notice.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'}`} style={{ marginRight: 8 }} />
          {notice.text}
        </div>
      )}

      {/* Score card */}
      <div style={{ background: '#fff', borderRadius: RADIUS, padding: 28, boxShadow: SHADOW_SOFT }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: 0, letterSpacing: '-0.3px' }}>Credit Score</h2>
          <span style={{ fontSize: 12, color: '#8E8E93', fontWeight: 500 }}>
            {latest?.checked_at ? `Updated: ${fmtDate(latest.checked_at)}` : 'No record'}
          </span>
        </div>

        <ScoreGauge score={score} color={color} glow={glow} />

        <div style={{ textAlign: 'center', marginTop: -16 }}>
          <span style={{ display: 'inline-block', background: color, color: '#fff', fontSize: 12, fontWeight: 700, padding: '5px 16px', borderRadius: 20, boxShadow: `0 4px 16px ${glow}`, textTransform: 'capitalize' }}>
            {riskText}
          </span>
        </div>

        <p style={{ fontSize: 13, color: '#64748B', margin: '18px 0 0', textAlign: 'center' }}>
          <i className="fas fa-info-circle" style={{ marginRight: 6 }} />
          {latest?.recommendation_reason || 'Upload a credit report to see detailed insights.'}
        </p>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { icon: 'fa-history',             label: 'History',   action: () => setModal('history') },
          { icon: 'fa-file-invoice-dollar', label: 'Payslip',   action: () => setModal('till_slip') },
          { icon: 'fa-building-columns',    label: 'Bank Stmt', action: () => setModal('bank_statement') },
          { icon: 'fa-id-card',             label: 'ID Doc',    action: () => navigate('/user-portal/apply') },
        ].map(a => (
          <button
            key={a.label}
            onClick={a.action}
            style={{ background: '#fff', border: 'none', borderRadius: 18, padding: '16px 8px', boxShadow: SHADOW_SOFT, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
          >
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(91,33,182,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className={`fas ${a.icon}`} style={{ color: 'var(--color-primary)', fontSize: 16 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1C1C1E' }}>{a.label}</span>
          </button>
        ))}
      </div>

      {/* Score band ruler */}
      <div style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', border: '1px solid rgba(15,23,42,0.06)', borderRadius: RADIUS, padding: 24 }}>
        <h4 style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: '0 0 4px' }}>Where you stand</h4>
        <p style={{ fontSize: 11, color: '#64748B', margin: '0 0 18px' }}>Your score range on the credit scale</p>
        <div style={{ position: 'relative', height: 14, borderRadius: 99, display: 'flex', overflow: 'visible', background: '#f3f4f6' }}>
          <div style={{ display: 'flex', width: '100%', height: '100%', borderRadius: 99, overflow: 'hidden' }}>
            {SCORE_BANDS.map(b => (
              <div key={b.label} style={{ width: `${((b.max - b.min + 1) / 699) * 100}%`, background: b.color, height: '100%' }} />
            ))}
          </div>
          {typeof score === 'number' && (
            <div style={{ position: 'absolute', top: -28, left: `${scorePct}%`, transform: 'translateX(-50%)', background: '#0F172A', color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>
              {score} ▼
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, fontWeight: 700, color: '#94A3B8' }}>
          <span>300</span><span>500</span><span>600</span><span>680</span><span>750</span><span>999</span>
        </div>
      </div>

      {/* Eligibility */}
      {elig && (
        <div style={{ background: elig.bg, borderRadius: RADIUS, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: elig.max > 0 ? 18 : 0 }}>
            <div style={{ background: 'rgba(255,255,255,0.7)', width: 42, height: 42, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`fas ${elig.icon}`} style={{ fontSize: 18, color: '#0F172A' }} />
            </div>
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: 0 }}>Your loan eligibility</h4>
              <p style={{ fontSize: 12, color: '#334155', margin: '4px 0 0', lineHeight: 1.5 }}>{elig.msg}</p>
            </div>
          </div>
          {elig.max > 0 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {[
                  { label: 'Max Loan', value: `R${(elig.max / 1000).toFixed(0)}k` },
                  { label: 'Rate p.a.', value: elig.rate },
                  { label: 'Term', value: elig.term },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: 'rgba(255,255,255,0.65)', borderRadius: 14, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#0F172A', marginTop: 4 }}>{value}</div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate('/user-portal/apply')}
                style={{ width: '100%', marginTop: 14, padding: 12, background: '#0F172A', color: '#fff', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Apply Now →
              </button>
            </>
          )}
        </div>
      )}

      {/* Detailed metrics */}
      <div style={{ background: '#fff', borderRadius: RADIUS, padding: 28, boxShadow: SHADOW_SOFT }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: '0 0 18px' }}>Detailed Metrics</h3>
        {!latest ? (
          <p style={{ textAlign: 'center', padding: 20, color: '#8E8E93', fontSize: 14, margin: 0 }}>No detailed metrics available yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {METRICS_CONFIG.map(({ key, label, currency }) => {
              const raw = latest[key];
              const value = raw == null ? '—' : currency ? fmtCurrency(Number(raw)) : fmtNumber(raw);
              return (
                <div key={key} style={{ background: '#FAFAFA', borderRadius: 14, padding: '14px 16px' }}>
                  <h4 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8E8E93', margin: '0 0 4px' }}>{label}</h4>
                  <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>{value}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Improvement tips */}
      {tips.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.06)', borderRadius: RADIUS, padding: 24 }}>
          <h4 style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: '0 0 4px' }}>How to improve your score</h4>
          <p style={{ fontSize: 11, color: '#64748B', margin: '0 0 18px' }}>Personalised actions based on your credit profile</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tips.map(t => (
              <div key={t.title} style={{ display: 'flex', gap: 12, padding: 12, background: t.urgent ? '#FEF2F2' : '#F8FAFC', borderRadius: 14, borderLeft: `3px solid ${t.urgent ? '#EF4444' : '#E7762E'}` }}>
                <div style={{ background: '#fff', width: 36, height: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={`fas ${t.icon}`} style={{ fontSize: 15, color: t.urgent ? '#EF4444' : '#E7762E' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h5 style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', margin: '0 0 2px' }}>{t.title}</h5>
                  <p style={{ fontSize: 11, color: '#64748B', margin: 0, lineHeight: 1.5 }}>{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Score history */}
      {history.length >= 2 && <ScoreHistoryChart history={history} />}

      {/* Modals */}
      {modal === 'history' && (
        <Modal title="Previous Checks" onClose={() => setModal(null)}>
          {checks.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#8E8E93', fontSize: 14 }}>No previous bureau checks have been recorded.</p>
          ) : checks.map(row => (
            <div key={row.id} style={{ background: '#FAFAFA', borderRadius: 16, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E' }}>{row.bureau_name || 'Bureau Check'}</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(91,33,182,0.10)', color: 'var(--color-primary)' }}>
                  {fmtDate(row.checked_at)}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: '#fff', padding: 14, borderRadius: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: '#8E8E93' }}>Score</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E', marginTop: 2 }}>{row.credit_score ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: '#8E8E93' }}>Risk Level</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E', marginTop: 2, textTransform: 'capitalize' }}>{row.risk_category || row.score_band || '—'}</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: '#8E8E93' }}>Reason</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1C1C1E', marginTop: 2, lineHeight: 1.5 }}>{row.recommendation_reason || 'No specific reason provided.'}</div>
                </div>
              </div>
            </div>
          ))}
        </Modal>
      )}

      {modal && modal !== 'history' && (
        <Modal title={modalDocTitle} onClose={() => setModal(null)}>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ width: '100%', border: '2px dashed #E5E5EA', background: '#fff', color: '#1C1C1E', height: 64, borderRadius: 14, fontSize: 14, fontWeight: 600, cursor: uploading ? 'default' : 'pointer', fontFamily: 'inherit' }}
          >
            <i className={`fas ${uploading ? 'fa-spinner fa-spin' : 'fa-cloud-upload-alt'}`} style={{ color: 'var(--color-primary)', marginRight: 8 }} />
            {uploading ? 'Uploading…' : `Upload New ${modalDocTitle}`}
          </button>
          {!modalDoc ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#8E8E93', fontSize: 14 }}>
              <i className="fas fa-file-upload" style={{ fontSize: 44, color: '#E5E5EA', marginBottom: 14, display: 'block' }} />
              No {modalDocTitle.toLowerCase()} uploaded yet.
            </div>
          ) : (
            <div style={{ background: '#FAFAFA', borderRadius: 16, padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{modalDoc.file_name}</div>
                <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 4, fontWeight: 500 }}>Uploaded: {fmtDate(modalDoc.uploaded_at)}</div>
              </div>
              <a
                href={modalDoc.file_path}
                target="_blank"
                rel="noopener noreferrer"
                style={{ background: 'var(--color-primary)', color: '#fff', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}
              >
                <i className="fas fa-download" style={{ marginRight: 6 }} /> Download
              </a>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = '';
            }}
          />
        </Modal>
      )}
    </div>
  );
}

// ── score history chart ───────────────────────────────────────────────────────

function ScoreHistoryChart({ history }: { history: CreditCheck[] }) {
  const scores = history.map(h => h.credit_score as number);
  const min = Math.min(...scores) - 20;
  const max = Math.max(...scores) + 20;
  const range = Math.max(1, max - min);

  const width = 100, height = 60, pad = 2;
  const pts = history.map((h, i) => ({
    x: pad + ((width - pad * 2) / (history.length - 1)) * i,
    y: pad + (height - pad * 2) * (1 - ((h.credit_score as number) - min) / range),
  }));

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaD = `${pathD} L${pts[pts.length - 1].x},${height} L${pts[0].x},${height} Z`;

  const delta = scores[scores.length - 1] - scores[0];
  const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';
  const trendColor = trend === 'up' ? '#10B981' : trend === 'down' ? '#EF4444' : '#64748B';

  return (
    <div style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.06)', borderRadius: RADIUS, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <h4 style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: '0 0 4px' }}>Score trend</h4>
          <p style={{ fontSize: 11, color: '#64748B', margin: 0 }}>Your last {history.length} credit checks</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: trendColor, letterSpacing: '-0.02em' }}>
            {trend === 'up' ? '+' : ''}{delta}
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
            {trend === 'up' ? 'Improving' : trend === 'down' ? 'Declining' : 'Stable'}
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 120 }}>
        <defs>
          <linearGradient id="transcripts-score-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={trendColor} stopOpacity={0.3} />
            <stop offset="100%" stopColor={trendColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#transcripts-score-grad)" />
        <path d={pathD} fill="none" stroke={trendColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={1.5} fill="#fff" stroke={trendColor} strokeWidth={1.2} />)}
      </svg>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        {history.map(h => (
          <div key={h.id} style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600 }}>
            {fmtDate(h.checked_at).split(' ').slice(0, 2).join(' ')}
          </div>
        ))}
      </div>
    </div>
  );
}
