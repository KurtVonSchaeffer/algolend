import type { FC } from 'react';

// NCA (South Africa) prescribed fee limits — approximate 2026 values
const NCA_MAX_ANNUAL_RATE = 28;   // % p.a. for unsecured credit
const NCA_MAX_SERVICE_FEE = 69;   // R/month

const ncaInitFeeCap = (amount: number): number => {
  if (amount <= 1000) return Math.min(amount * 0.15, 150);
  return Math.min(150 + amount * 0.1, 5750);
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

interface Props {
  principal: number;
  term: number;
  annualRate: number;
  totalInitFees: number;
  totalAdminFees: number;
  monthlyPayment: number;
  salaryNet: number;
  totalExpenses: number;
  creditScore: number;
  creditChecks: any[];
  appStatus: string;
}

export const AutoDecisionEngine: FC<Props> = ({
  principal, term, annualRate, totalInitFees, totalAdminFees,
  monthlyPayment, salaryNet, creditScore, creditChecks, appStatus,
}) => {
  const card: React.CSSProperties = {
    background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden',
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const dti = salaryNet > 0 ? (monthlyPayment / salaryNet) * 100 : 100;
  const monthlyServiceFee = term > 0 ? totalAdminFees / term : 0;
  const hasAdverse = creditChecks.some(c => {
    const adverse = c.adverse_listings ?? c.report_data?.adverse_listings ?? 0;
    return Number(adverse) > 0;
  });

  // ── Scoring ────────────────────────────────────────────────────────────────
  const creditPts = creditScore >= 700 ? 40 : creditScore >= 620 ? 28 : creditScore >= 580 ? 15 : 0;
  const dtiPts    = dti <= 25 ? 30 : dti <= 35 ? 22 : dti <= 45 ? 12 : 0;
  const incomePts = salaryNet >= 15000 ? 20 : salaryNet >= 8000 ? 15 : salaryNet >= 4000 ? 8 : 0;
  const adversePts = hasAdverse ? 0 : 10;
  const score = creditPts + dtiPts + incomePts + adversePts;

  const recommendation: 'APPROVE' | 'REFER' | 'DECLINE' =
    score >= 70 ? 'APPROVE' : score >= 40 ? 'REFER' : 'DECLINE';

  // ── NCA compliance ─────────────────────────────────────────────────────────
  const feeCap = ncaInitFeeCap(principal);
  const rateOk    = annualRate <= NCA_MAX_ANNUAL_RATE;
  const initOk    = totalInitFees <= feeCap;
  const serviceOk = monthlyServiceFee <= NCA_MAX_SERVICE_FEE;
  const ncaOk = rateOk && initOk && serviceOk;

  // ── Reckless lending ───────────────────────────────────────────────────────
  const recklessDTI    = dti > 45;
  const recklessIncome = salaryNet > 0 && salaryNet < 4000;
  const isReckless = recklessDTI || recklessIncome;

  // ── Colour tokens ──────────────────────────────────────────────────────────
  const RC = {
    APPROVE: { fg: '#059669', bg: '#f0fdf4', border: '#bbf7d0', icon: 'check_circle' },
    REFER:   { fg: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: 'manage_search' },
    DECLINE: { fg: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: 'cancel' },
  }[recommendation];

  const gaugeColor = score >= 70 ? '#059669' : score >= 40 ? '#d97706' : '#dc2626';
  const isDecided = ['DECLINED', 'DISBURSED', 'ACTIVE', 'CLOSED'].includes(appStatus);

  const factors = [
    { label: 'Credit Score',         pts: creditPts,  max: 40, sub: creditScore > 0 ? String(creditScore) : 'No data' },
    { label: 'Debt-to-Income',       pts: dtiPts,     max: 30, sub: salaryNet > 0 ? `${dti.toFixed(0)}% DTI` : 'No income data' },
    { label: 'Net Monthly Income',   pts: incomePts,  max: 20, sub: salaryNet > 0 ? `${fmt(salaryNet)}/mo` : 'No data' },
    { label: 'No Adverse Listings',  pts: adversePts, max: 10, sub: hasAdverse ? 'Adverse found' : creditChecks.length ? 'Clean bureau' : 'Not yet checked' },
  ];

  const ncaChecks = [
    { label: 'Annual Interest Rate',  ok: rateOk,    detail: `${annualRate.toFixed(1)}% (cap ${NCA_MAX_ANNUAL_RATE}%)` },
    { label: 'Initiation Fee',        ok: initOk,    detail: `${fmt(totalInitFees)} (cap ${fmt(feeCap)})` },
    { label: 'Monthly Service Fee',   ok: serviceOk, detail: `${fmt(monthlyServiceFee)} (cap R${NCA_MAX_SERVICE_FEE})` },
  ];

  return (
    <div style={card}>
      {/* ── Header ── */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', background: 'linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#7c3aed' }}>psychology</span>
          <h3 style={{ fontSize: 11, fontWeight: 800, margin: 0, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b21a8' }}>
            AI Decision Engine
          </h3>
          <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, background: '#7c3aed', color: '#fff', padding: '2px 7px', borderRadius: 20, letterSpacing: '0.05em' }}>
            BETA
          </span>
        </div>
        {isDecided && (
          <p style={{ fontSize: 10, color: '#9ca3af', margin: '5px 0 0', fontStyle: 'italic' }}>
            Application resolved — shown for reference only.
          </p>
        )}
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Score gauge ── */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, textAlign: 'center' }}>
            Composite Risk Score
          </div>
          <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
            <div style={{ height: '100%', width: `${score}%`, background: gaugeColor, borderRadius: 3, transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#d1d5db' }}>0</span>
            <span style={{ fontSize: 24, fontWeight: 900, color: gaugeColor, lineHeight: 1 }}>
              {score}
              <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>/100</span>
            </span>
            <span style={{ fontSize: 9, color: '#d1d5db' }}>100</span>
          </div>
        </div>

        {/* ── Recommendation ── */}
        <div style={{ padding: '11px 14px', background: RC.bg, border: `1.5px solid ${RC.border}`, borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: RC.fg }}>{RC.icon}</span>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: RC.fg, textTransform: 'uppercase', letterSpacing: '0.1em' }}>AI Recommendation</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: RC.fg }}>{recommendation}</div>
            </div>
          </div>
        </div>

        {/* ── Factor breakdown ── */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Scoring Factors</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {factors.map(f => {
              const pct = (f.pts / f.max) * 100;
              const barColor = f.pts === 0 ? '#fca5a5' : f.pts === f.max ? '#6ee7b7' : '#fbbf24';
              return (
                <div key={f.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#374151' }}>{f.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: f.pts === 0 ? '#dc2626' : f.pts === f.max ? '#059669' : '#d97706' }}>
                      {f.pts}/{f.max}
                    </span>
                  </div>
                  <div style={{ height: 4, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden', marginBottom: 2 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 2, transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ fontSize: 9, color: '#9ca3af' }}>{f.sub}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Reckless lending flag ── */}
        {isReckless && (
          <div style={{ padding: '10px 12px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#c2410c' }}>gavel</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                NCA Reckless Lending Risk
              </span>
            </div>
            {recklessDTI && (
              <p style={{ fontSize: 10, color: '#c2410c', margin: '3px 0 0', lineHeight: 1.4 }}>
                DTI {dti.toFixed(0)}% exceeds 45% — reckless per NCA s.80
              </p>
            )}
            {recklessIncome && (
              <p style={{ fontSize: 10, color: '#c2410c', margin: '3px 0 0', lineHeight: 1.4 }}>
                Net income R{salaryNet.toLocaleString()} — below R4,000 minimum living standard
              </p>
            )}
          </div>
        )}

        {/* ── NCA fee compliance ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em' }}>NCA Fee Compliance</div>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20,
              background: ncaOk ? '#d1fae5' : '#fee2e2',
              color: ncaOk ? '#065f46' : '#991b1b',
            }}>
              {ncaOk ? 'PASS' : 'BREACH'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {ncaChecks.map(c => (
              <div key={c.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '7px 10px', borderRadius: 9,
                background: c.ok ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${c.ok ? '#bbf7d0' : '#fecaca'}`,
              }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: c.ok ? '#065f46' : '#991b1b' }}>{c.label}</div>
                  <div style={{ fontSize: 9, color: c.ok ? '#059669' : '#dc2626' }}>{c.detail}</div>
                </div>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: c.ok ? '#059669' : '#dc2626' }}>
                  {c.ok ? 'check_circle' : 'cancel'}
                </span>
              </div>
            ))}
          </div>
          {!ncaOk && (
            <p style={{ fontSize: 9, color: '#dc2626', marginTop: 6, fontStyle: 'italic', lineHeight: 1.4 }}>
              Fee structure exceeds NCA prescribed limits. Review before disbursing.
            </p>
          )}
        </div>

      </div>
    </div>
  );
};
