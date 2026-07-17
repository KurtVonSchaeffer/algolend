import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCreditRules, upsertCreditRule, deleteCreditRule } from '../services/adminData';

// ── Types ────────────────────────────────────────────────────────────────────

type Rule = {
  id: string;
  name?: string;
  rule_name?: string;
  rule_label?: string;
  category?: string;
  condition?: string;
  rule_key?: string;
  threshold?: number | string;
  threshold_value?: number | string;
  value?: number | string;
  action?: string;
  fail_action?: string;
  decline_reason?: string;
  operator?: string;
  is_active?: boolean;
  // band-specific
  min_score?: number;
  max_score?: number;
  risk_level?: string;
  max_loan_amount?: number;
  interest_rate_pa?: number;
  max_term_months?: number;
  auto_decision?: string;
  first_loan_max_term_months?: number;
  color?: string;
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

function getRuleName(r: Rule) {
  return r.name ?? r.rule_name ?? r.rule_label ?? '—';
}

function isBand(r: Rule) {
  const cat = (r.category ?? '').toLowerCase();
  return cat.includes('band') || cat.includes('score') || (r.min_score != null && r.max_score != null);
}

// ── Simulator (client-side) ──────────────────────────────────────────────────

function runSim(score: number, income: number, debt: number, age: number, employed: boolean, judgment: boolean, debtReview: boolean, firstLoan: boolean, rules: Rule[], bands: Rule[]) {
  const dti = income > 0 ? Math.round((debt / income) * 100) : 999;
  const failures: { label: string; action: string; reason?: string }[] = [];

  for (const rule of rules.filter(r => r.is_active !== false)) {
    const k = rule.rule_key ?? '';
    let val: number | boolean;
    if (k === 'min_credit_score') val = score;
    else if (k === 'min_age') val = age;
    else if (k === 'max_dti_pct') val = dti;
    else if (k === 'min_income') val = income;
    else if (k === 'is_employed') val = employed;
    else if (k === 'no_judgments') val = !judgment;
    else if (k === 'not_under_debt_review') val = !debtReview;
    else continue;

    const threshold = Number(rule.threshold_value ?? rule.threshold ?? rule.value ?? 0);
    let passes: boolean;
    if (rule.operator === 'gte') passes = (val as number) >= threshold;
    else if (rule.operator === 'lte') passes = (val as number) <= threshold;
    else if (rule.operator === 'is_true') passes = val === true;
    else if (rule.operator === 'is_false') passes = val === false;
    else passes = true;

    if (!passes) failures.push({ label: getRuleName(rule), action: rule.fail_action ?? rule.action ?? 'decline', reason: rule.decline_reason });
  }

  const activeBands = bands.filter(b => b.is_active !== false && b.min_score != null && b.max_score != null)
    .sort((a, b) => (a.min_score ?? 0) - (b.min_score ?? 0));
  const matchedBand = activeBands.find(b => score >= (b.min_score ?? 0) && score <= (b.max_score ?? 999));

  const hardDeclines = failures.filter(f => f.action === 'decline');
  const reviewFlags  = failures.filter(f => f.action === 'review');

  let decision: string, color: string, bg: string, icon: string;
  if (hardDeclines.length) {
    decision = 'DECLINED'; color = '#EF4444'; bg = '#FEF2F2'; icon = 'cancel';
  } else if (reviewFlags.length || matchedBand?.auto_decision === 'review') {
    decision = 'MANUAL REVIEW'; color = '#F59E0B'; bg = '#FFFBEB'; icon = 'person_search';
  } else if (matchedBand?.auto_decision === 'decline') {
    decision = 'DECLINED'; color = '#EF4444'; bg = '#FEF2F2'; icon = 'cancel';
  } else if (matchedBand?.auto_decision === 'approve') {
    decision = 'APPROVED'; color = '#10B981'; bg = '#F0FDF4'; icon = 'check_circle';
  } else {
    decision = 'NO MATCHING BAND'; color = '#6B7280'; bg = '#F9FAFB'; icon = 'help';
  }

  const effectiveTerm = firstLoan && matchedBand?.first_loan_max_term_months
    ? Math.min(matchedBand.max_term_months ?? 999, matchedBand.first_loan_max_term_months)
    : matchedBand?.max_term_months;

  return { decision, color, bg, icon, matchedBand, failures, dti, effectiveTerm };
}

// ── Component ────────────────────────────────────────────────────────────────

export function CreditRulesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showSimModal, setShowSimModal] = useState(false);
  const [showBandModal, setShowBandModal] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

  // Simulator state
  const [simScore, setSimScore]     = useState('');
  const [simIncome, setSimIncome]   = useState('');
  const [simDebt, setSimDebt]       = useState('');
  const [simAge, setSimAge]         = useState('');
  const [simEmployed, setSimEmployed]   = useState(true);
  const [simJudgment, setSimJudgment]   = useState(false);
  const [simDebtReview, setSimDebtReview] = useState(false);
  const [simFirstLoan, setSimFirstLoan]   = useState(false);
  const [simResult, setSimResult]   = useState<ReturnType<typeof runSim> | null>(null);

  // Band form state
  const [bandForm, setBandForm] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['admin-credit-rules'],
    queryFn: fetchCreditRules,
    staleTime: 60_000,
  });

  const upsertMut = useMutation({
    mutationFn: (rule: Record<string, unknown>) => upsertCreditRule(rule),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-credit-rules'] }); setShowBandModal(false); setEditingRule(null); setBandForm({}); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCreditRule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-credit-rules'] }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => upsertCreditRule({ id, is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-credit-rules'] }),
  });

  const allRules: Rule[] = (data?.data ?? []).filter((r: Rule) =>
    !search || getRuleName(r).toLowerCase().includes(search.toLowerCase())
  );

  const bands = allRules.filter(isBand);
  const eligibilityRules = allRules.filter(r => !isBand(r));

  function openBandModal(rule?: Rule) {
    setEditingRule(rule ?? null);
    setBandForm(rule ? {
      id: rule.id,
      label: getRuleName(rule),
      min_score: String(rule.min_score ?? ''),
      max_score: String(rule.max_score ?? ''),
      risk_level: rule.risk_level ?? 'medium',
      max_loan_amount: String(rule.max_loan_amount ?? ''),
      interest_rate_pa: String(rule.interest_rate_pa ?? ''),
      max_term_months: String(rule.max_term_months ?? ''),
      auto_decision: rule.auto_decision ?? 'approve',
      first_loan_max_term_months: String(rule.first_loan_max_term_months ?? ''),
      decline_reason: rule.decline_reason ?? '',
      color: rule.color ?? '#10B981',
    } : { risk_level: 'medium', auto_decision: 'approve', color: '#10B981' });
    setShowBandModal(true);
  }

  function saveBand(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      ...bandForm,
      category: 'band',
      name: bandForm.label,
      min_score: Number(bandForm.min_score),
      max_score: Number(bandForm.max_score),
      max_loan_amount: Number(bandForm.max_loan_amount) || null,
      interest_rate_pa: Number(bandForm.interest_rate_pa) || null,
      max_term_months: Number(bandForm.max_term_months) || null,
      first_loan_max_term_months: bandForm.first_loan_max_term_months ? Number(bandForm.first_loan_max_term_months) : null,
      is_active: true,
    };
    if (!editingRule) delete payload.id;
    upsertMut.mutate(payload);
  }

  function handleSimulate() {
    const score = parseInt(simScore) || 0;
    if (!score) return alert('Enter a credit score to simulate.');
    const result = runSim(
      score, Number(simIncome), Number(simDebt), Number(simAge) || 30,
      simEmployed, simJudgment, simDebtReview, simFirstLoan,
      eligibilityRules, bands
    );
    setSimResult(result);
  }

  const RISK_COLORS: Record<string, string> = {
    low: '#10B981', medium: '#F59E0B', high: '#EF4444', declined: '#6B7280',
  };

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Credit Rules</h1>
          <p className="page-subtitle">Configure score bands and eligibility criteria</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSimResult(null); setShowSimModal(true); }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>science</span>
          Simulate
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div className="admin-search">
          <i className="fa-solid fa-search admin-search-icon" />
          <input type="text" placeholder="Search rules…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="spinner" /></div>
      ) : (
        <>
          {/* ── Score Bands ── */}
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.07)', marginBottom: 20, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-primary)' }}>layers</span>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Credit Score Bands</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Define risk levels, max loan amounts and interest rates per score range</div>
                </div>
              </div>
              <button className="btn btn-primary" style={{ padding: '7px 14px', fontSize: 12 }} onClick={() => openBandModal()}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                Add Band
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Band</th>
                    <th>Score Range</th>
                    <th>Risk</th>
                    <th style={{ textAlign: 'right' }}>Max Loan</th>
                    <th style={{ textAlign: 'right' }}>Rate p.a.</th>
                    <th style={{ textAlign: 'right' }}>Max Term</th>
                    <th style={{ textAlign: 'center' }}>Decision</th>
                    <th style={{ textAlign: 'center' }}>1st Loan</th>
                    <th style={{ textAlign: 'center' }}>Active</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bands.length === 0 ? (
                    <tr><td colSpan={10}>
                      <div className="empty-state">
                        <i className="fa-solid fa-layer-group" />
                        <p>No score bands configured.{' '}
                          <button style={{ color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }} onClick={() => openBandModal()}>
                            Add your first band
                          </button>
                        </p>
                      </div>
                    </td></tr>
                  ) : bands.map(b => {
                    const riskColor = RISK_COLORS[(b.risk_level ?? '').toLowerCase()] ?? '#6B7280';
                    const decClass = b.auto_decision === 'approve' ? 'badge-green' : b.auto_decision === 'decline' ? 'badge-red' : 'badge-yellow';
                    return (
                      <tr key={b.id}>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: b.color ?? riskColor, flexShrink: 0 }} />
                            {getRuleName(b)}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--color-text-muted)' }}>
                          {b.min_score} – {b.max_score}
                        </td>
                        <td>
                          <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', background: `${riskColor}20`, color: riskColor }}>
                            {b.risk_level ?? '—'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {b.max_loan_amount ? fmt(Number(b.max_loan_amount)) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
                          {b.interest_rate_pa != null ? `${b.interest_rate_pa}%` : '—'}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
                          {b.max_term_months != null ? `${b.max_term_months} mo` : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${decClass}`} style={{ textTransform: 'uppercase', fontSize: 10 }}>
                            {b.auto_decision ?? '—'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {b.first_loan_max_term_months
                            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, background: '#EFF6FF', color: '#3B82F6', fontSize: 11, fontWeight: 700 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>star</span>
                                {b.first_loan_max_term_months} mo
                              </span>
                            : <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>
                          }
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            style={{
                              width: 40, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                              background: b.is_active !== false ? 'var(--color-primary)' : '#e2e8f0',
                              position: 'relative', transition: 'background 0.2s',
                            }}
                            onClick={() => toggleMut.mutate({ id: b.id, is_active: !(b.is_active !== false) })}
                          >
                            <span style={{
                              position: 'absolute', top: 2, left: b.is_active !== false ? 18 : 2,
                              width: 20, height: 20, borderRadius: '50%', background: '#fff',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                            }} />
                          </button>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <button className="admin-icon-btn" onClick={() => openBandModal(b)}>
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                            </button>
                            <button className="admin-icon-btn" style={{ color: '#EF4444' }}
                              onClick={() => { if (confirm('Delete this band?')) deleteMut.mutate(b.id); }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Eligibility Rules ── */}
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-primary)' }}>shield</span>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Eligibility Rules</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Hard pass/fail criteria checked before score bands</div>
              </div>
            </div>

            {eligibilityRules.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 0' }}>
                <i className="fa-solid fa-shield-halved" />
                <p>No eligibility rules configured</p>
              </div>
            ) : eligibilityRules.map(r => {
              const failBadge = (r.fail_action ?? r.action ?? 'decline') === 'decline' ? 'badge-red' : 'badge-yellow';
              const failLabel = ((r.fail_action ?? r.action ?? 'decline') === 'decline' ? 'Decline' : 'Manual Review');
              const threshold = r.threshold_value ?? r.threshold ?? r.value;
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px 24px', borderBottom: '1px solid #f8fafc' }}>
                  <button
                    style={{
                      marginTop: 2, width: 40, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
                      background: r.is_active !== false ? 'var(--color-primary)' : '#e2e8f0',
                      position: 'relative', transition: 'background 0.2s',
                    }}
                    onClick={() => toggleMut.mutate({ id: r.id, is_active: !(r.is_active !== false) })}
                  >
                    <span style={{
                      position: 'absolute', top: 2, left: r.is_active !== false ? 18 : 2,
                      width: 20, height: 20, borderRadius: '50%', background: '#fff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                    }} />
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, opacity: r.is_active === false ? 0.4 : 1 }}>{getRuleName(r)}</span>
                      {threshold != null && (
                        <span style={{ fontFamily: 'monospace', fontSize: 11, background: '#f1f5f9', color: '#475569', padding: '1px 8px', borderRadius: 6 }}>
                          {r.operator === 'gte' ? '≥' : r.operator === 'lte' ? '≤' : '='} {threshold}
                        </span>
                      )}
                      <span className={`badge ${failBadge}`} style={{ fontSize: 10 }}>
                        Fail → {failLabel.toUpperCase()}
                      </span>
                    </div>
                    {r.condition && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{r.condition}</div>}
                    {r.decline_reason && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontStyle: 'italic' }}>"{r.decline_reason}"</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Simulate Modal ── */}
      {showSimModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowSimModal(false)}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 520, boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: 18 }}>science</span>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Credit Decision Simulator</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Test what decision a borrower would get</div>
                </div>
              </div>
              <button className="admin-icon-btn" onClick={() => setShowSimModal(false)}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Credit Score', value: simScore, set: setSimScore, placeholder: 'e.g. 650', type: 'number' },
                { label: 'Gross Monthly Income (R)', value: simIncome, set: setSimIncome, placeholder: 'e.g. 12000', type: 'number' },
                { label: 'Monthly Debt (R)', value: simDebt, set: setSimDebt, placeholder: 'e.g. 3000', type: 'number' },
                { label: 'Age', value: simAge, set: setSimAge, placeholder: 'e.g. 35', type: 'number' },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{f.label}</label>
                  <input
                    className="admin-input"
                    type={f.type}
                    value={f.value}
                    placeholder={f.placeholder}
                    onChange={e => f.set(e.target.value)}
                  />
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {[
                  { label: 'Employed', val: simEmployed, set: setSimEmployed },
                  { label: 'Has Judgments', val: simJudgment, set: setSimJudgment },
                  { label: 'Debt Review', val: simDebtReview, set: setSimDebtReview },
                  { label: 'First Loan', val: simFirstLoan, set: setSimFirstLoan },
                ].map(f => (
                  <label key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                    <input type="checkbox" checked={f.val} onChange={e => f.set(e.target.checked)} />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', marginBottom: 16, justifyContent: 'center' }} onClick={handleSimulate}>
              Run Simulation
            </button>

            {simResult && (
              <div style={{ borderRadius: 16, padding: 16, border: `1px solid ${simResult.color}40`, background: simResult.bg }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 32, color: simResult.color }}>{simResult.icon}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: simResult.color }}>Decision</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: simResult.color }}>{simResult.decision}</div>
                  </div>
                </div>
                {simResult.matchedBand && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                    {[
                      { label: 'Band', val: simResult.matchedBand ? getRuleName(simResult.matchedBand) : '—' },
                      { label: 'Max Loan', val: simResult.matchedBand?.max_loan_amount ? fmt(Number(simResult.matchedBand.max_loan_amount)) : '—' },
                      { label: 'Max Term', val: simResult.effectiveTerm ? `${simResult.effectiveTerm} mo` : '—' },
                    ].map(k => (
                      <div key={k.label} style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600 }}>{k.label}</div>
                        <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>{k.val}</div>
                      </div>
                    ))}
                  </div>
                )}
                {simResult.failures.length > 0 ? (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--color-text-muted)', marginBottom: 6 }}>Rule Failures</div>
                    {simResult.failures.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: f.action === 'decline' ? '#EF4444' : '#F59E0B', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600 }}>{f.label}</span>
                        <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: f.action === 'decline' ? '#FEE2E2' : '#FEF3C7', color: f.action === 'decline' ? '#DC2626' : '#D97706' }}>
                          {f.action.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: '#10B981', fontWeight: 600 }}>✓ All eligibility rules passed</div>
                )}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.08)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 12, color: 'var(--color-text-muted)' }}>
                  <span>Score: <strong>{simScore}</strong></span>
                  <span>DTI: <strong>{simResult.dti}%</strong></span>
                  <span>Income: <strong>R {Number(simIncome || 0).toLocaleString()}</strong></span>
                  <span>First loan: <strong>{simFirstLoan ? 'Yes' : 'No'}</strong></span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Band Modal ── */}
      {showBandModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowBandModal(false)}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16 }}>{editingRule ? 'Edit Score Band' : 'Add Score Band'}</h3>
              <button className="admin-icon-btn" onClick={() => setShowBandModal(false)}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>

            <form onSubmit={saveBand}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Band Label</label>
                  <input className="admin-input" required placeholder="e.g. Excellent" value={bandForm.label ?? ''} onChange={e => setBandForm(f => ({ ...f, label: e.target.value }))} />
                </div>
                {[
                  { key: 'min_score', label: 'Min Score', placeholder: '300', type: 'number' },
                  { key: 'max_score', label: 'Max Score', placeholder: '999', type: 'number' },
                  { key: 'max_loan_amount', label: 'Max Loan Amount (R)', placeholder: '10000', type: 'number' },
                  { key: 'interest_rate_pa', label: 'Interest Rate p.a. (%)', placeholder: '22.00', type: 'number' },
                  { key: 'max_term_months', label: 'Max Term (months)', placeholder: '12', type: 'number' },
                  { key: 'first_loan_max_term_months', label: 'First Loan Max Term', placeholder: 'Leave blank = no limit', type: 'number' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>{f.label}</label>
                    <input className="admin-input" type={f.type} placeholder={f.placeholder} value={bandForm[f.key] ?? ''} onChange={e => setBandForm(ff => ({ ...ff, [f.key]: e.target.value }))} />
                  </div>
                ))}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Risk Level</label>
                  <select className="admin-select" value={bandForm.risk_level ?? 'medium'} onChange={e => setBandForm(f => ({ ...f, risk_level: e.target.value }))}>
                    {['low', 'medium', 'high', 'declined'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Auto Decision</label>
                  <select className="admin-select" value={bandForm.auto_decision ?? 'approve'} onChange={e => setBandForm(f => ({ ...f, auto_decision: e.target.value }))}>
                    <option value="approve">Approve</option>
                    <option value="review">Manual Review</option>
                    <option value="decline">Decline</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Band Colour</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="color" value={bandForm.color ?? '#10B981'} onChange={e => setBandForm(f => ({ ...f, color: e.target.value }))}
                      style={{ width: 44, height: 44, borderRadius: 8, border: '1px solid var(--color-border)', cursor: 'pointer', padding: 2 }} />
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Shown in UI badges</span>
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Decline Message</label>
                  <input className="admin-input" placeholder="Shown to applicant on decline…" value={bandForm.decline_reason ?? ''} onChange={e => setBandForm(f => ({ ...f, decline_reason: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowBandModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={upsertMut.isPending}>
                  {upsertMut.isPending ? 'Saving…' : 'Save Band'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
