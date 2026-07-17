import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isDemoMode, DEMO_TRANSCRIPTS } from '../demo/demoData';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { usePageCSS } from '../hooks/usePageCSS';
import transcriptsCssUrl from '../legacy-css/13-transcripts.css?url';

// ── risk colours (verbatim from legacy transcripts.js) ────────────────────────

const SCORE_RISK_COLORS: Record<string, string> = {
  'very low risk':  '#10B981',
  'low risk':       '#22C55E',
  'medium risk':    '#E7762E',
  'high risk':      '#F97316',
  'very high risk': '#EF4444',
};

const SCORE_RISK_GLOWS: Record<string, string> = {
  'very low risk':  'rgba(16, 185, 129, 0.55)',
  'low risk':       'rgba(34, 197, 94,  0.55)',
  'medium risk':    'rgba(231, 118, 46, 0.55)',
  'high risk':      'rgba(249, 115, 22, 0.55)',
  'very high risk': 'rgba(239, 68,  68, 0.55)',
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

// ── utils (verbatim behavior from legacy) ─────────────────────────────────────

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

// ── gauge (legacy score-gauge SVG markup + JS-generated ticks) ────────────────

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
  return <g id="gaugeTicks">{ticks}</g>;
}

function useCountUp(target: number | null) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (typeof target !== 'number') return;
    const DURATION = 1700;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / DURATION, 1);
      setValue(Math.round((1 - Math.pow(1 - progress, 3)) * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}

// ── universal modal (legacy modern-modal markup) ──────────────────────────────

function UniversalModal({ title, onClose, fullScreen, children }: { title: string; onClose: () => void; fullScreen?: boolean; children: ReactNode }) {
  return (
    <div className={`modern-modal-overlay${fullScreen ? ' is-full-screen' : ''}`} onClick={onClose}>
      <div className="modern-modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modern-modal-header">
          <h2 className="modern-modal-title">{title}</h2>
          <button className="modern-modal-close" onClick={onClose}><i className="fas fa-times" /></button>
        </div>
        <div className="modern-modal-body">{children}</div>
      </div>
    </div>
  );
}

// ── eligibility + tips (verbatim thresholds/copy from legacy) ─────────────────

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

// ── main page (legacy transcripts.html markup) ────────────────────────────────

export function TranscriptsPage() {
  usePageCSS(transcriptsCssUrl);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [modal, setModal] = useState<'history' | 'till_slip' | 'bank_statement' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);
  const [gaugeFill, setGaugeFill] = useState(0);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['transcripts'],
    queryFn: isDemoMode() ? () => Promise.resolve(DEMO_TRANSCRIPTS) : fetchTranscripts,
    staleTime: 60_000,
    retry: 1,
  });

  const checks   = data?.checks ?? [];
  const latest   = checks[0] ?? null;
  const score    = latest?.credit_score ?? null;
  const riskText = latest?.risk_category || latest?.score_band || 'Pending';
  const riskKey  = riskText.toLowerCase();
  const color    = SCORE_RISK_COLORS[riskKey] || '#E7762E';
  const glow     = SCORE_RISK_GLOWS[riskKey] || 'rgba(231,118,46,0.55)';

  const displayScore = useCountUp(score);

  // animate gauge like legacy animateGauge (MAX_ARC 377, CIRC 502.65)
  useEffect(() => {
    if (typeof score !== 'number') return;
    const fraction = Math.max(0, Math.min(1, (score - 300) / 699));
    const t = setTimeout(() => setGaugeFill(fraction * 377), 120);
    return () => clearTimeout(t);
  }, [score]);

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
      setAlert({ type: 'success', text: 'Document uploaded successfully!' });
      setTimeout(() => setAlert(null), 3000);
    } catch {
      setAlert({ type: 'error', text: 'Failed to upload document. Please try again.' });
    } finally {
      setUploading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="content-wrapper">
          <div className="transcripts-alert info" style={{ display: 'flex' }}>
            <i className="fas fa-circle-notch fa-spin" />
            <span>Loading your credit data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page-container">
        <div className="content-wrapper">
          <div className="transcripts-alert error" style={{ display: 'flex' }}>
            <i className="fas fa-exclamation-triangle" />
            <span>{error instanceof Error ? error.message : 'Unable to load transcripts.'}</span>
          </div>
        </div>
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
    <div className="page-container">
      <div className="content-wrapper">

        <header className="minimal-header transcripts-header">
          <div className="header-text">
            <h1>Credit Transcripts</h1>
            <p className="page-subtitle">Review bureau decisioning data and access supporting documents.</p>
          </div>
          <button
            className="action-btn primary"
            style={{ height: 48, padding: '0 24px', fontSize: 14, borderRadius: 12 }}
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <i className={`fas ${isFetching ? 'fa-circle-notch fa-spin' : 'fa-rotate'}`} />{' '}
            <span>{isFetching ? 'Refreshing…' : 'Refresh Data'}</span>
          </button>
        </header>

        {alert && (
          <div className={`transcripts-alert ${alert.type}`} style={{ display: 'flex' }}>
            <i className={`fas ${alert.type === 'success' ? 'fa-check-circle' : alert.type === 'error' ? 'fa-exclamation-triangle' : 'fa-circle-notch fa-spin'}`} />
            <span>{alert.text}</span>
          </div>
        )}

        <div className="transcripts-stack">

          {/* Score card (legacy minimalist-score-card markup) */}
          <article className="card minimalist-score-card">
            <div className="msc-header">
              <h2 className="msc-title">Credit Score</h2>
              <span className="msc-date">{latest?.checked_at ? `Updated: ${fmtDate(latest.checked_at)}` : 'No record'}</span>
            </div>

            <div className="msc-content">
              <div className="msc-gauge-container">
                <svg className="score-gauge" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                  <GaugeTicks />
                  <circle className="gauge-track" cx="100" cy="100" r="80" transform="rotate(135, 100, 100)" />
                  <circle
                    className="gauge-glow" cx="100" cy="100" r="80" transform="rotate(135, 100, 100)"
                    style={{ stroke: color, strokeDasharray: `${gaugeFill} 502.65` }}
                  />
                  <circle
                    className="gauge-fill has-value" cx="100" cy="100" r="80" transform="rotate(135, 100, 100)"
                    style={{ stroke: color, strokeDasharray: `${gaugeFill} 502.65`, ['--gauge-glow-color' as string]: glow }}
                  />
                </svg>

                <div className="gauge-center">
                  <span className="gauge-score-label">SCORE</span>
                  <h3 className="msc-score">{typeof score === 'number' ? displayScore : '—'}</h3>
                  <span className="msc-risk" style={{ background: color, boxShadow: `0 4px 16px ${glow}`, color: '#fff' }}>
                    {riskText}
                  </span>
                </div>

                <span className="gauge-label-min">300</span>
                <span className="gauge-label-max">999</span>
              </div>
            </div>

            <div className="msc-footer">
              <i className="fas fa-info-circle" />
              <span>{latest?.recommendation_reason || 'Upload a credit report to see insights.'}</span>
            </div>
          </article>

          {/* Quick actions (legacy markup) */}
          <nav className="quick-actions-row">
            <button className="action-btn-item" onClick={() => setModal('history')}>
              <div className="action-icon-circle"><i className="fas fa-history" /></div>
              <span>History</span>
            </button>
            <button className="action-btn-item" onClick={() => setModal('till_slip')}>
              <div className="action-icon-circle"><i className="fas fa-file-invoice-dollar" /></div>
              <span>Payslip</span>
            </button>
            <button className="action-btn-item" onClick={() => setModal('bank_statement')}>
              <div className="action-icon-circle"><i className="fas fa-building-columns" /></div>
              <span>Bank Stmt</span>
            </button>
            <button className="action-btn-item" onClick={() => navigate('/user-portal/apply')}>
              <div className="action-icon-circle"><i className="fas fa-id-card" /></div>
              <span>ID Doc</span>
            </button>
          </nav>

          {/* Score band ruler (legacy renderScoreBandRuler inline styles) */}
          <div>
            <div style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', border: '1px solid rgba(15,23,42,0.06)', borderRadius: 24, padding: 24, marginTop: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: '0 0 4px', letterSpacing: '-0.01em' }}>Where you stand</h4>
              <p style={{ fontSize: 11, color: '#64748B', margin: '0 0 18px' }}>Your score range on the credit scale</p>

              <div style={{ position: 'relative', height: 14, borderRadius: 99, display: 'flex', background: '#f3f4f6' }}>
                <div style={{ display: 'flex', width: '100%', height: '100%', borderRadius: 99, overflow: 'hidden' }}>
                  {SCORE_BANDS.map(b => (
                    <div key={b.label} style={{ width: `${((b.max - b.min + 1) / 699) * 100}%`, background: b.color, height: '100%' }} />
                  ))}
                </div>
                {typeof score === 'number' && (
                  <div style={{ position: 'absolute', top: -6, left: `${scorePct}%`, transform: 'translate(-50%, -100%)', background: '#0F172A', color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>
                    {score} ▼
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, fontWeight: 700, color: '#94A3B8' }}>
                <span>300</span><span>500</span><span>600</span><span>680</span><span>750</span><span>999</span>
              </div>
            </div>
          </div>

          {/* Loan eligibility (legacy renderEligibility inline styles) */}
          {elig && (
            <div>
              <div style={{ background: elig.bg, borderRadius: 24, padding: 24, marginTop: 16, position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: elig.max > 0 ? 18 : 0 }}>
                  <div style={{ background: 'rgba(255,255,255,0.7)', width: 42, height: 42, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`fas ${elig.icon}`} style={{ fontSize: 20, color: '#0F172A' }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>Your loan eligibility</h4>
                    <p style={{ fontSize: 12, color: '#334155', margin: '4px 0 0', lineHeight: 1.5 }}>{elig.msg}</p>
                  </div>
                </div>

                {elig.max > 0 && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                      <div style={{ background: 'rgba(255,255,255,0.65)', borderRadius: 14, padding: 12, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max Loan</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', marginTop: 4, letterSpacing: '-0.02em' }}>R{(elig.max / 1000).toFixed(0)}k</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.65)', borderRadius: 14, padding: 12, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rate p.a.</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', marginTop: 4, letterSpacing: '-0.02em' }}>{elig.rate}</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.65)', borderRadius: 14, padding: 12, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Term</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginTop: 6, letterSpacing: '-0.01em' }}>{elig.term}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate('/user-portal/apply')}
                      style={{ width: '100%', marginTop: 14, padding: 12, background: '#0F172A', color: '#fff', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 800, cursor: 'pointer', letterSpacing: '-0.01em', fontFamily: 'inherit' }}
                    >
                      Apply Now →
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Detailed metrics (legacy creditDetailsCard markup) */}
          <article className="card" style={{ paddingTop: 24 }}>
            <header className="card-header" style={{ marginBottom: 20 }}>
              <h3>Detailed Metrics</h3>
            </header>
            <div className="metrics-grid">
              {!latest ? (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 20, color: 'var(--text-muted, #8E8E93)' }}>
                  No detailed metrics available yet.
                </div>
              ) : METRICS_CONFIG.map(({ key, label, currency }) => {
                const raw = latest[key];
                const value = raw == null ? '—' : currency ? fmtCurrency(Number(raw)) : fmtNumber(raw);
                return (
                  <div className="metric-tile" key={key}>
                    <h4>{label}</h4>
                    <p>{value}</p>
                  </div>
                );
              })}
            </div>
          </article>

          {/* Improvement tips (legacy renderImprovementTips inline styles) */}
          {tips.length > 0 && (
            <div>
              <div style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.06)', borderRadius: 24, padding: 24, marginTop: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: '0 0 4px', letterSpacing: '-0.01em' }}>How to improve your score</h4>
                <p style={{ fontSize: 11, color: '#64748B', margin: '0 0 18px' }}>Personalised actions based on your credit profile</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {tips.map(t => (
                    <div key={t.title} style={{ display: 'flex', gap: 12, padding: 12, background: t.urgent ? '#FEF2F2' : '#F8FAFC', borderRadius: 14, borderLeft: `3px solid ${t.urgent ? '#EF4444' : '#E7762E'}` }}>
                      <div style={{ background: '#fff', width: 36, height: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <i className={`fas ${t.icon}`} style={{ fontSize: 17, color: t.urgent ? '#EF4444' : '#E7762E' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h5 style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', margin: '0 0 2px', letterSpacing: '-0.01em' }}>{t.title}</h5>
                        <p style={{ fontSize: 11, color: '#64748B', margin: 0, lineHeight: 1.5 }}>{t.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Score history (legacy renderScoreHistory inline styles) */}
          {history.length >= 2 && <ScoreHistoryChart history={history} />}

        </div>
      </div>

      {/* History modal (legacy openHistoryModal markup) */}
      {modal === 'history' && (
        <UniversalModal title="Previous Checks" onClose={() => setModal(null)} fullScreen>
          <div className="full-screen-content-wrapper">
            {checks.length === 0 ? (
              <div className="empty-state">No previous bureau checks have been recorded.</div>
            ) : checks.map(row => (
              <div className="modern-list-item" key={row.id}>
                <div className="modern-item-header">
                  <span className="modern-item-id">{row.bureau_name || 'Bureau Check'}</span>
                  <span className="status-badge" style={{ background: 'rgba(124,58,237,0.1)', color: 'var(--color-primary)' }}>{fmtDate(row.checked_at)}</span>
                </div>
                <div className="modern-item-grid">
                  <div className="modern-grid-col"><div className="label">Score</div><div className="val">{row.credit_score ?? '—'}</div></div>
                  <div className="modern-grid-col"><div className="label">Risk Level</div><div className="val">{row.risk_category || row.score_band || '—'}</div></div>
                  <div className="modern-grid-col" style={{ gridColumn: '1 / -1' }}>
                    <div className="label">Reason</div>
                    <div className="val" style={{ fontWeight: 500, lineHeight: 1.5 }}>{row.recommendation_reason || 'No specific reason provided.'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </UniversalModal>
      )}

      {/* Doc modal (legacy openDocModal markup) */}
      {modal && modal !== 'history' && (
        <UniversalModal title={modalDocTitle} onClose={() => setModal(null)} fullScreen>
          <div className="full-screen-content-wrapper">
            <button
              className="action-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ width: '100%', marginBottom: 8, border: '2px dashed #E5E5EA', background: 'var(--color-white, #fff)', color: 'var(--text-main, #1C1C1E)', height: 64 }}
            >
              <i className={`fas ${uploading ? 'fa-spinner fa-spin' : 'fa-cloud-upload-alt'}`} style={{ color: 'var(--color-primary)' }} />{' '}
              {uploading ? 'Uploading...' : `Upload New ${modalDocTitle}`}
            </button>
            {!modalDoc ? (
              <div className="empty-state">
                <i className="fas fa-file-upload" style={{ fontSize: 48, color: '#E5E5EA', marginBottom: 16, display: 'block' }} />
                No {modalDocTitle.toLowerCase()} uploaded yet.
              </div>
            ) : (
              <div className="modern-list-item" style={{ marginTop: 8 }}>
                <div className="modern-item-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                  <div>
                    <div className="modern-item-id">{modalDoc.file_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted, #8E8E93)', marginTop: 4, fontWeight: 500 }}>Uploaded: {fmtDate(modalDoc.uploaded_at)}</div>
                  </div>
                  <button
                    className="action-btn primary"
                    onClick={() => window.open(modalDoc.file_path, '_blank', 'noopener')}
                    style={{ height: 40, padding: '0 20px', fontSize: 13 }}
                  >
                    <i className="fas fa-download" /> Download
                  </button>
                </div>
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
          </div>
        </UniversalModal>
      )}
    </div>
  );
}

// ── score history chart (legacy renderScoreHistory SVG) ──────────────────────

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
    <div>
      <div style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.06)', borderRadius: 24, padding: 24, marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: '0 0 4px', letterSpacing: '-0.01em' }}>Score trend</h4>
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
            <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={trendColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={trendColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={areaD} fill="url(#scoreGrad)" />
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
    </div>
  );
}
