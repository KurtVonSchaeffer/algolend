import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';

// ── Constants ─────────────────────────────────────────────────────────────────

const BANK_BRANCH_CODES: Record<string, string> = {
  'FNB': '250655',
  'Standard Bank': '051001',
  'ABSA': '632005',
  'Nedbank': '198765',
  'Capitec': '470010',
  'Investec': '580105',
  'TymeBank': '678910',
  'Discovery Bank': '679000',
  'African Bank': '430000',
};

const LOAN_PURPOSES = [
  'Personal Loan', 'Medical Expenses', 'Education', 'Home Improvement',
  'Debt Consolidation', 'Funeral', 'Vehicle', 'Business', 'Emergency', 'Other',
];

const WIZARD_STEPS = [
  { id: 1, title: 'Client',       icon: 'person' },
  { id: 2, title: 'Bureau',       icon: 'manage_search' },
  { id: 3, title: 'Financials',   icon: 'pie_chart' },
  { id: 4, title: 'Declarations', icon: 'description' },
  { id: 5, title: 'Loan',         icon: 'tune' },
  { id: 6, title: 'Docs',         icon: 'receipt_long' },
  { id: 7, title: 'Confirm',      icon: 'task_alt' },
];

const SA_HOLIDAYS: Record<number, string[]> = {};
function getSAHolidays(year: number) {
  if (SA_HOLIDAYS[year]) return SA_HOLIDAYS[year];
  SA_HOLIDAYS[year] = [
    `${year}-01-01`, `${year}-03-21`, `${year}-04-18`, `${year}-04-21`,
    `${year}-04-27`, `${year}-04-28`, `${year}-05-01`, `${year}-06-16`,
    `${year}-08-09`, `${year}-09-24`, `${year}-12-16`, `${year}-12-25`, `${year}-12-26`,
  ];
  return SA_HOLIDAYS[year];
}

function validateRepaymentDate(dateStr: string): { valid: boolean; reason?: string } {
  if (!dateStr) return { valid: false, reason: 'Please select a date.' };
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return { valid: false, reason: 'Repayments cannot be on weekends.' };
  const formatted = d.toISOString().split('T')[0];
  if (getSAHolidays(d.getUTCFullYear()).includes(formatted)) {
    return { valid: false, reason: 'Selected date is a South African Public Holiday.' };
  }
  return { valid: true };
}

function calculateLoan(amount: number, period: number, startDate: string, historyCount = 0, isFirstLoanOfYear = false) {
  const r = 0.05, cpi = 0.0045, init = 0.15, svcM = 69, vat = 0.15;
  const waiveInit = isFirstLoanOfYear || historyCount === 0;

  let totalSvc = 0;
  if (startDate) {
    const now = new Date();
    const pay = new Date(startDate);
    const days = Math.max(1, Math.ceil((pay.getTime() - now.getTime()) / 86400000));
    const firstM = (svcM / 30) * Math.min(days, 30);
    totalSvc = firstM + (period > 1 ? svcM * (period - 1) : 0);
  } else {
    totalSvc = svcM * period;
  }

  const totalInterest = amount * r * period;
  const totalInit = waiveInit ? 0 : amount * init;
  const totalCpi = amount * cpi * period;
  const monthCpi = amount * cpi;
  const vatAmt = (totalInit + totalSvc) * vat;
  const totalCost = totalInterest + totalInit + totalSvc + totalCpi + vatAmt;
  const totalRepay = amount + totalCost;
  const monthly = totalRepay / period;

  return {
    totalInterest, totalInit, totalSvc, totalCpi, monthCpi,
    vatAmt, totalCost, totalRepay, monthly,
    interestRate: r, initiationRate: waiveInit ? 0 : init,
    totalRate: r + (waiveInit ? 0 : init), waiveInit,
  };
}

function fmt(n: number) {
  return 'R ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ── Wizard state type ──────────────────────────────────────────────────────────

type Profile = { id: string; full_name: string; identity_number?: string; cell_tel_no?: string; email?: string };
type BankAccount = { id: string; bank_name: string; account_number: string; account_type?: string; branch_code?: string };
type LoanApp = { id: string; status: string; amount: number; term_months: number; created_at: string };

interface WizardState {
  targetUser: Profile | null;
  applicationId: string | null;
  creditScore: number | null;
  creditCheckValid: boolean;
  affordabilityLimit: number;
  historyCount: number;
  isFirstLoanOfYear: boolean;
  loanConfig: { amount: number; period: number; startDate: string; reason: string; maxPeriod: number };
  declarations: {
    marital: string; home: string; qualification: string; disadvantaged: boolean;
    referralProvided: boolean; referralName: string; referralPhone: string;
    termsAccepted: boolean; truthAccepted: boolean;
  };
  financials: { salary: string; other: string; housing: string; school: string; transport: string; food: string };
  docs: { idcard: boolean; till_slip: boolean; bank_statement: boolean };
  selectedBankId: string;
  adminConsent: boolean;
}

const defaultState = (): WizardState => {
  const d = new Date(); d.setDate(d.getDate() + 7);
  const pad = (n: number) => String(n).padStart(2, '0');
  const defaultDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return {
    targetUser: null, applicationId: null, creditScore: null, creditCheckValid: false,
    affordabilityLimit: 0, historyCount: 0, isFirstLoanOfYear: true,
    loanConfig: { amount: 1000, period: 1, startDate: defaultDate, reason: 'Personal Loan', maxPeriod: 1 },
    declarations: {
      marital: 'single', home: 'rent', qualification: 'matric', disadvantaged: false,
      referralProvided: false, referralName: '', referralPhone: '',
      termsAccepted: false, truthAccepted: false,
    },
    financials: { salary: '', other: '', housing: '', school: '', transport: '', food: '' },
    docs: { idcard: false, till_slip: false, bank_statement: false },
    selectedBankId: '', adminConsent: false,
  };
};

// ── Toast helper ───────────────────────────────────────────────────────────────

function toast(msg: string, type: 'success' | 'error' | 'warning' = 'success') {
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;
    font-size:13px;font-weight:600;color:#fff;max-width:320px;
    background:${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#F59E0B'};
    box-shadow:0 4px 16px rgba(0,0,0,0.18);`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function CreateApplicationPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(defaultState());
  const [loading, setLoading] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const update = (patch: Partial<WizardState>) => setState(prev => ({ ...prev, ...patch }));

  function handleCancel() {
    if (!cancelConfirm) {
      setCancelConfirm(true);
      toast('Unsaved progress will be lost. Click again to exit.', 'warning');
      setTimeout(() => setCancelConfirm(false), 3000);
    } else {
      navigate('/applications');
    }
  }

  async function goToNext() {
    if (step < 7) { setStep(s => s + 1); }
  }
  function goToPrev() { if (step > 1) setStep(s => s - 1); }

  return (
    <div style={{ minHeight: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
        padding: '12px 24px', marginBottom: 0, borderRadius: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleCancel}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: cancelConfirm ? '#EF4444' : 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
            {cancelConfirm ? 'Click again to Confirm' : 'Cancel'}
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>In-Branch Application Mode</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, border: '1px solid var(--color-primary)', color: 'var(--color-primary)', fontSize: 11, fontWeight: 700 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>store</span>
          Branch Terminal
        </div>
      </div>

      {/* Stepper */}
      <div style={{
        display: 'flex', alignItems: 'center', overflowX: 'auto',
        padding: '16px 24px', background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        {WIZARD_STEPS.map((s, i) => {
          const isActive = s.id === step;
          const isDone = s.id < step;
          const isLast = i === WIZARD_STEPS.length - 1;
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 60 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 700,
                  border: `2px solid ${isActive ? 'var(--color-primary)' : isDone ? '#10B981' : 'var(--color-border)'}`,
                  background: isActive ? 'var(--color-primary)' : isDone ? '#10B981' : 'var(--color-surface)',
                  color: (isActive || isDone) ? '#fff' : 'var(--color-text-muted)',
                }}>
                  {isDone
                    ? <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>
                    : <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{s.icon}</span>}
                </div>
                <span style={{
                  fontSize: 11, fontWeight: isActive ? 700 : 500, whiteSpace: 'nowrap',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                }}>{s.title}</span>
              </div>
              {!isLast && (
                <div style={{ width: 28, height: 3, background: isDone ? '#10B981' : 'var(--color-border)', margin: '0 4px', borderRadius: 4, marginBottom: 16 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div style={{ padding: '24px' }}>
        {step === 1 && <StepClient state={state} update={update} onNext={goToNext} />}
        {step === 2 && <StepBureau state={state} update={update} onNext={goToNext} />}
        {step === 3 && <StepFinancials state={state} update={update} onNext={goToNext} />}
        {step === 4 && <StepDeclarations state={state} update={update} onNext={goToNext} />}
        {step === 5 && <StepLoan state={state} update={update} onNext={goToNext} />}
        {step === 6 && <StepDocs state={state} update={update} onNext={goToNext} />}
        {step === 7 && <StepConfirm state={state} update={update} loading={loading} setLoading={setLoading} navigate={navigate} />}
      </div>

      {/* Bottom Nav */}
      {step !== 3 && step !== 4 && step !== 5 && step !== 7 && (
        <div style={{
          position: 'sticky', bottom: 0, background: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border)', padding: '12px 24px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <button
            onClick={goToPrev}
            style={{ visibility: step > 1 ? 'visible' : 'hidden', padding: '8px 20px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            Back
          </button>
          <button
            onClick={goToNext}
            disabled={step === 1 && !state.targetUser}
            style={{ padding: '10px 28px', borderRadius: 10, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: (step === 1 && !state.targetUser) ? 0.5 : 1 }}
          >
            Next Step →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Step 1: Client ─────────────────────────────────────────────────────────────

function StepClient({ state, update, onNext }: { state: WizardState; update: (p: Partial<WizardState>) => void; onNext: () => void }) {
  const [tab, setTab] = useState<'search' | 'create'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [loanHistory, setLoanHistory] = useState<LoanApp[]>([]);
  const [activeLoan, setActiveLoan] = useState<LoanApp | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', id: '', phone: '', email: '' });
  const [creating, setCreating] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (state.targetUser) loadHistory(state.targetUser.id);
  }, [state.targetUser]);

  async function loadHistory(uid: string) {
    setLoadingHistory(true);
    const { data } = await supabase.from('loan_applications').select('id,status,amount,term_months,created_at').eq('user_id', uid).order('created_at', { ascending: false });
    const apps = (data ?? []) as LoanApp[];
    setLoanHistory(apps);
    const active = apps.find(a => !['REPAID', 'DECLINED', 'ERROR', 'DISBURSED'].includes(a.status));
    setActiveLoan(active ?? null);
    setLoadingHistory(false);
  }

  function handleSearch(val: string) {
    setQuery(val);
    clearTimeout(searchTimer.current);
    if (val.length < 2) { setResults([]); setShowResults(false); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('*').or(`full_name.ilike.%${val}%,identity_number.ilike.%${val}%`).limit(5);
      setResults((data ?? []) as Profile[]);
      setShowResults(true);
      setSearching(false);
    }, 400);
  }

  function selectUser(user: Profile) {
    update({ targetUser: user });
    setResults([]); setShowResults(false); setQuery('');
  }

  async function handleCreateClient() {
    if (!newClient.name || !newClient.id) { toast('Name and ID Number are required.', 'warning'); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.from('profiles').insert([{
        full_name: newClient.name, identity_number: newClient.id,
        cell_tel_no: newClient.phone, email: newClient.email || null,
      }]).select().single();
      if (error) throw error;
      update({ targetUser: data as Profile });
      toast('Client created!', 'success');
    } catch (e: any) { toast(e.message, 'error'); }
    setCreating(false);
  }

  const card: React.CSSProperties = {
    maxWidth: 640, margin: '0 auto', background: 'var(--color-surface)',
    border: '1px solid var(--color-border)', borderRadius: 16,
    padding: 32, boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  };

  return (
    <div style={card}>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--color-border)', marginBottom: 24 }}>
        {(['search', 'create'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600,
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: tab === t ? 'var(--color-primary)' : 'var(--color-text-muted)',
            marginBottom: -2,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 6 }}>
              {t === 'search' ? 'search' : 'person_add'}
            </span>
            {t === 'search' ? 'Search Existing' : 'New Walk-in Client'}
          </button>
        ))}
      </div>

      {tab === 'search' && (
        <>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>Find Client</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>Search by name, email, or ID number.</p>
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: 18 }}>search</span>
            <input
              className="admin-input"
              style={{ paddingLeft: 40 }}
              placeholder="Start typing name or ID..."
              value={query}
              onChange={e => handleSearch(e.target.value)}
              onFocus={() => results.length > 0 && setShowResults(true)}
            />
            {searching && <span className="material-symbols-outlined" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-primary)', fontSize: 18, animation: 'spin 1s linear infinite' }}>progress_activity</span>}
          </div>

          {showResults && results.length > 0 && (
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, background: 'var(--color-surface)', boxShadow: '0 6px 24px rgba(0,0,0,0.12)', marginTop: -8, marginBottom: 16, maxHeight: 240, overflowY: 'auto', zIndex: 10, position: 'relative' }}>
              {results.map(u => (
                <div key={u.id} onClick={() => selectUser(u)} style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(109,40,217,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{u.full_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>ID: {u.identity_number || 'N/A'}</div>
                </div>
              ))}
            </div>
          )}

          {showResults && results.length === 0 && !searching && (
            <div style={{ padding: '12px 0', fontSize: 13, color: 'var(--color-text-muted)' }}>No clients found.</div>
          )}
        </>
      )}

      {tab === 'create' && (
        <>
          <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="material-symbols-outlined" style={{ color: '#C2410C', fontSize: 18 }}>storefront</span>
            <span style={{ fontSize: 13, color: '#92400E' }}>You are registering a <strong>Walk-in Client</strong>.</span>
          </div>
          {[
            { label: 'Full Name *', key: 'name', type: 'text', placeholder: 'e.g. John Doe' },
            { label: 'ID Number *', key: 'id', type: 'text', placeholder: '13-digit SA ID' },
            { label: 'Phone', key: 'phone', type: 'tel', placeholder: '082...' },
            { label: 'Email (Optional)', key: 'email', type: 'email', placeholder: 'Leave empty if none' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>{f.label}</label>
              <input className="admin-input" type={f.type} placeholder={f.placeholder}
                value={(newClient as any)[f.key]} onChange={e => setNewClient(p => ({ ...p, [f.key]: e.target.value }))} />
            </div>
          ))}
          <button onClick={handleCreateClient} disabled={creating} style={{ width: '100%', padding: '12px 0', borderRadius: 10, background: '#111827', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', marginTop: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15, verticalAlign: 'middle', marginRight: 6 }}>person_add</span>
            {creating ? 'Creating...' : 'Create & Select Client'}
          </button>
        </>
      )}

      {/* Selected user card */}
      {state.targetUser && (
        <div style={{ marginTop: 24 }}>
          <div style={{ background: 'rgba(109,40,217,0.06)', border: '1px solid rgba(109,40,217,0.2)', borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(109,40,217,0.15)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700 }}>
                {state.targetUser.full_name?.charAt(0) || 'U'}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{state.targetUser.full_name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>ID: {state.targetUser.identity_number || 'N/A'}</div>
              </div>
            </div>
            <button onClick={() => { update({ targetUser: null }); setLoanHistory([]); setActiveLoan(null); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
            </button>
          </div>

          {/* New loan action */}
          <div
            onClick={() => { if (!activeLoan) onNext(); }}
            style={{
              border: `2px dashed ${activeLoan ? 'var(--color-border)' : 'var(--color-primary)'}`,
              borderRadius: 16, padding: 20, cursor: activeLoan ? 'not-allowed' : 'pointer',
              background: activeLoan ? 'var(--color-surface-muted)' : 'var(--color-surface)',
              opacity: activeLoan ? 0.6 : 1, marginBottom: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase' }}>Start New Loan Application</div>
                <div style={{ fontSize: 10, color: activeLoan ? '#EF4444' : '#10B981', fontWeight: 700, textTransform: 'uppercase' }}>
                  {activeLoan ? `⚠ Active loan: ${activeLoan.status}` : 'Ready for new application'}
                </div>
              </div>
            </div>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: 20 }}>chevron_right</span>
          </div>

          {/* Loan history */}
          <div style={{ marginTop: 8 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }}>Resume / Update Existing</p>
            {loadingHistory
              ? <div style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)', fontSize: 13 }}>Loading...</div>
              : loanHistory.length === 0
                ? <p style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center', padding: 16 }}>No history found.</p>
                : loanHistory.map(app => (
                  <div key={app.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 8, background: 'var(--color-surface)' }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{fmt(app.amount)}</span>
                      <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginLeft: 8, fontFamily: 'monospace' }}>{new Date(app.created_at).toLocaleDateString('en-ZA')}</span>
                      <div style={{ marginTop: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, background: '#F3F4F6', color: '#374151', padding: '2px 8px', borderRadius: 20 }}>{app.status}</span>
                      </div>
                    </div>
                    {!['REPAID', 'DECLINED', 'ERROR', 'DISBURSED'].includes(app.status) && (
                      <button onClick={() => { update({ applicationId: app.id }); onNext(); }}
                        style={{ padding: '6px 14px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                        Resume
                      </button>
                    )}
                  </div>
                ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 2: Bureau ─────────────────────────────────────────────────────────────

function StepBureau({ state, update, onNext }: { state: WizardState; update: (p: Partial<WizardState>) => void; onNext: () => void }) {
  const [loadingCheck, setLoadingCheck] = useState(true);
  const [canProceed, setCanProceed] = useState(false);

  useEffect(() => {
    if (!state.targetUser) return;
    (async () => {
      setLoadingCheck(true);
      const { data } = await supabase.from('credit_checks').select('*')
        .eq('user_id', state.targetUser!.id).eq('status', 'completed')
        .order('checked_at', { ascending: false }).limit(1);
      const latest = data?.[0];
      if (latest) {
        const ageDays = (Date.now() - new Date(latest.checked_at).getTime()) / 86400000;
        if (ageDays <= 90) {
          update({ creditScore: latest.credit_score, creditCheckValid: true });
          setCanProceed(true);
        }
      }
      setLoadingCheck(false);
    })();
  }, [state.targetUser?.id]);

  const score = state.creditScore ?? 0;
  const color = score < 600 ? '#EF4444' : score < 700 ? '#F59E0B' : '#10B981';
  const rating = score < 600 ? 'Poor' : score < 700 ? 'Average' : 'Excellent';
  const circumference = 502;
  const offset = circumference - (circumference * (score / 800));

  const card: React.CSSProperties = {
    maxWidth: 540, margin: '0 auto', background: 'var(--color-surface)',
    border: '1px solid var(--color-border)', borderRadius: 16, padding: 32,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  };

  if (loadingCheck) return (
    <div style={{ ...card, textAlign: 'center', padding: 48 }}>
      <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--color-primary)', animation: 'spin 1s linear infinite' }}>progress_activity</span>
      <p style={{ marginTop: 12, color: 'var(--color-text-muted)' }}>Checking bureau records...</p>
    </div>
  );

  if (!canProceed) return (
    <div style={{ ...card, textAlign: 'center' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(109,40,217,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--color-primary)' }}>manage_search</span>
      </div>
      <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>New Credit Check Required</h3>
      <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 28 }}>No valid bureau report found from the last 3 months.</p>
      <div style={{ background: 'rgba(109,40,217,0.06)', border: '1px solid rgba(109,40,217,0.15)', borderRadius: 12, padding: 16, fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
        Credit bureau integration required. Mark as completed to proceed.
      </div>
      <button
        onClick={() => { update({ creditScore: 650, creditCheckValid: true }); setCanProceed(true); }}
        style={{ padding: '12px 32px', borderRadius: 12, background: 'var(--color-primary)', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}>
        Mark Check Complete (Demo)
      </button>
    </div>
  );

  return (
    <div style={{ ...card, textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 192, height: 192, margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg viewBox="0 0 192 192" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}>
          <circle cx="96" cy="96" r="80" stroke="#f3f4f6" strokeWidth="12" fill="none" />
          <circle cx="96" cy="96" r="80" stroke={color} strokeWidth="12" fill="none"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s ease-in-out' }} />
        </svg>
        <div style={{ position: 'absolute', textAlign: 'center' }}>
          <div style={{ fontSize: 40, fontWeight: 900, color: '#111827', lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color }}>{rating}</div>
        </div>
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>Bureau Report Verified</h3>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Credit check valid for 90 days.</p>
      <button onClick={onNext} style={{ marginTop: 28, padding: '12px 40px', borderRadius: 12, background: 'var(--color-primary)', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}>
        Continue →
      </button>
    </div>
  );
}

// ── Step 3: Financials ─────────────────────────────────────────────────────────

function StepFinancials({ state, update, onNext }: { state: WizardState; update: (p: Partial<WizardState>) => void; onNext: () => void }) {
  const [fin, setFin] = useState(state.financials);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!state.targetUser) return;
    supabase.from('financial_profiles').select('*').eq('user_id', state.targetUser.id).maybeSingle()
      .then(({ data }) => {
        if (data?.parsed_data) {
          const p = data.parsed_data;
          setFin({
            salary: p.income?.salary || '', other: p.income?.other_monthly_earnings || '',
            housing: p.expenses?.housing_rent || '', school: p.expenses?.school || '',
            transport: p.expenses?.petrol || '', food: p.expenses?.groceries || '',
          });
        }
      });
  }, [state.targetUser?.id]);

  const salary = Number(fin.salary) || 0;
  const other = Number(fin.other) || 0;
  const housing = Number(fin.housing) || 0;
  const school = Number(fin.school) || 0;
  const transport = Number(fin.transport) || 0;
  const food = Number(fin.food) || 0;
  const totalIncome = salary + other;
  const totalExpenses = housing + school + transport + food;
  const surplus = Math.max(0, totalIncome - totalExpenses);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (totalIncome <= 0) { toast('Please enter a valid salary.', 'warning'); return; }
    setSaving(true);
    const payload = {
      user_id: state.targetUser!.id,
      monthly_income: totalIncome, monthly_expenses: totalExpenses, affordability_ratio: surplus,
      parsed_data: {
        income: { salary: fin.salary, other_monthly_earnings: fin.other },
        expenses: { housing_rent: fin.housing, school: fin.school, petrol: fin.transport, groceries: fin.food },
      },
    };
    const { error } = await supabase.from('financial_profiles').upsert(payload, { onConflict: 'user_id' });
    if (error) { toast(error.message, 'error'); }
    else { update({ financials: fin, affordabilityLimit: surplus }); toast('Financial Profile Updated', 'success'); onNext(); }
    setSaving(false);
  }

  const setF = (k: keyof typeof fin, v: string) => setFin(p => ({ ...p, [k]: v }));

  const card: React.CSSProperties = {
    maxWidth: 800, margin: '0 auto', background: 'var(--color-surface)',
    border: '1px solid var(--color-border)', borderRadius: 16, padding: 32,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  };

  return (
    <div style={card}>
      <h3 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>balance</span>
        Financial Affordability Assessment
      </h3>
      <form onSubmit={handleSave}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 24 }}>
          <div>
            <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', paddingBottom: 8, marginBottom: 16 }}>Monthly Income</h4>
            {[
              { label: 'Basic Salary (Net)', key: 'salary' },
              { label: 'Other Earnings', key: 'other' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--color-text-muted)' }}>R</span>
                  <input className="admin-input" type="number" style={{ paddingLeft: 28 }} placeholder="0.00"
                    value={(fin as any)[f.key]} onChange={e => setF(f.key as any, e.target.value)} />
                </div>
              </div>
            ))}
          </div>
          <div>
            <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', paddingBottom: 8, marginBottom: 16 }}>Monthly Expenses</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Housing/Rent', key: 'housing' },
                { label: 'School Fees', key: 'school' },
                { label: 'Transport', key: 'transport' },
                { label: 'Groceries', key: 'food' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input className="admin-input" type="number" placeholder="0"
                    value={(fin as any)[f.key]} onChange={e => setF(f.key as any, e.target.value)} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Affordability summary */}
        <div style={{ background: 'var(--color-surface-muted)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Maximum Monthly Affordability</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: 'var(--color-primary)' }}>{fmt(surplus)}</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>(Surplus Income)</span>
            </div>
          </div>
          <button type="submit" disabled={saving} style={{ padding: '14px 32px', borderRadius: 12, background: '#111827', color: '#fff', fontWeight: 800, fontSize: 14, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>cloud_upload</span>
            {saving ? 'Saving...' : 'Save & Analyze Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Step 4: Declarations ───────────────────────────────────────────────────────

function StepDeclarations({ state, update, onNext }: { state: WizardState; update: (p: Partial<WizardState>) => void; onNext: () => void }) {
  const [decl, setDecl] = useState(state.declarations);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!state.targetUser) return;
    supabase.from('declarations').select('*').eq('user_id', state.targetUser.id).maybeSingle()
      .then(({ data }) => {
        if (data) setDecl(prev => ({
          ...prev,
          marital: data.marital_status || 'single',
          home: data.home_ownership || 'rent',
          qualification: data.highest_qualification || 'matric',
          disadvantaged: !!data.historically_disadvantaged,
          referralProvided: !!data.referral_provided,
          referralName: data.referral_name || '',
          referralPhone: data.referral_phone || '',
        }));
      });
  }, [state.targetUser?.id]);

  const setD = (k: keyof typeof decl, v: any) => setDecl(p => ({ ...p, [k]: v }));

  async function handleSave() {
    if (!decl.termsAccepted || !decl.truthAccepted) { toast('Statutory declarations must be confirmed.', 'warning'); return; }
    setSaving(true);
    const payload = {
      user_id: state.targetUser!.id,
      marital_status: decl.marital, home_ownership: decl.home, highest_qualification: decl.qualification,
      historically_disadvantaged: decl.disadvantaged, referral_provided: decl.referralProvided,
      referral_name: decl.referralProvided ? decl.referralName : null,
      referral_phone: decl.referralProvided ? decl.referralPhone : null,
      accepted_std_conditions: true,
    };
    const { error } = await supabase.from('declarations').upsert(payload, { onConflict: 'user_id' });
    if (error) { toast(error.message, 'error'); }
    else { update({ declarations: decl }); toast('Declarations Verified', 'success'); onNext(); }
    setSaving(false);
  }

  const card: React.CSSProperties = {
    maxWidth: 720, margin: '0 auto', background: 'var(--color-surface)',
    border: '1px solid var(--color-border)', borderRadius: 16, padding: 32,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  };
  const sel: React.CSSProperties = { width: '100%' };

  return (
    <div style={card}>
      <h3 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>shield</span>
        Compliance & Statutory Declarations
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Marital Status</label>
          <select className="admin-select" style={sel} value={decl.marital} onChange={e => setD('marital', e.target.value)}>
            {['single', 'married', 'divorced', 'widowed'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Residential Status</label>
          <select className="admin-select" style={sel} value={decl.home} onChange={e => setD('home', e.target.value)}>
            <option value="rent">Rent</option>
            <option value="own">Own Home</option>
            <option value="family">Living with Family</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Highest Qualification</label>
          <select className="admin-select" style={sel} value={decl.qualification} onChange={e => setD('qualification', e.target.value)}>
            <option value="none">None / Primary</option>
            <option value="matric">Matric / Grade 12</option>
            <option value="diploma">Diploma</option>
            <option value="degree">Bachelor's Degree</option>
            <option value="postgrad">Postgraduate</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 24 }}>
          <input type="checkbox" id="decl_disadv" checked={decl.disadvantaged} onChange={e => setD('disadvantaged', e.target.checked)} style={{ width: 18, height: 18 }} />
          <label htmlFor="decl_disadv" style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Historically Disadvantaged?</label>
        </div>
      </div>

      {/* Referral */}
      <div style={{ padding: 20, background: 'var(--color-surface-muted)', borderRadius: 12, border: '1px solid var(--color-border)', marginBottom: 20 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: decl.referralProvided ? 16 : 0 }}>
          <input type="checkbox" checked={decl.referralProvided} onChange={e => setD('referralProvided', e.target.checked)} style={{ width: 18, height: 18 }} />
          <span style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Was a referral provided for this client?</span>
        </label>
        {decl.referralProvided && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Referral Name</label>
              <input className="admin-input" placeholder="Full Name" value={decl.referralName} onChange={e => setD('referralName', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Referral Phone</label>
              <input className="admin-input" placeholder="081..." value={decl.referralPhone} onChange={e => setD('referralPhone', e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {/* Statutory consent */}
      <div style={{ padding: 20, background: 'rgba(109,40,217,0.04)', border: '1px solid rgba(109,40,217,0.15)', borderRadius: 14, marginBottom: 24 }}>
        {[
          { key: 'termsAccepted', text: 'Client has read and accepts the Standard Conditions of the Credit Agreement and the Pre-Agreement Statement.' },
          { key: 'truthAccepted', text: 'Client declares that all information provided is true, correct, and that they are not currently under debt review or insolvent.' },
        ].map((c, i) => (
          <label key={c.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginBottom: i === 0 ? 16 : 0 }}>
            <input type="checkbox" checked={(decl as any)[c.key]} onChange={e => setD(c.key as any, e.target.checked)} style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 13, lineHeight: 1.5 }}>{c.text}</span>
          </label>
        ))}
      </div>

      <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: '14px 0', borderRadius: 12, background: '#111827', color: '#fff', fontWeight: 800, fontSize: 14, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
        {saving ? 'Saving...' : 'Verify Compliance & Continue'}
      </button>
    </div>
  );
}

// ── Step 5: Loan ───────────────────────────────────────────────────────────────

function StepLoan({ state, update, onNext }: { state: WizardState; update: (p: Partial<WizardState>) => void; onNext: () => void }) {
  const { loanConfig, affordabilityLimit, historyCount, isFirstLoanOfYear } = state;
  const [cfg, setCfg] = useState(loanConfig);
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    if (!state.targetUser) return;
    (async () => {
      const { data: loanData } = await supabase.from('loan_applications').select('id,created_at')
        .eq('user_id', state.targetUser!.id)
        .in('status', ['DISBURSED', 'OFFER_ACCEPTED', 'READY_TO_DISBURSE', 'ACTIVE', 'CONTRACT_SIGN', 'DEBICHECK_AUTH']);
      const count = loanData?.length || 0;
      const currYear = new Date().getFullYear();
      const firstOfYear = !loanData?.some(l => new Date(l.created_at).getFullYear() === currYear);
      const maxPeriod = count >= 3 ? 6 : 1;
      const { data: fp } = await supabase.from('financial_profiles').select('affordability_ratio').eq('user_id', state.targetUser!.id).maybeSingle();
      update({ historyCount: count, isFirstLoanOfYear: firstOfYear, affordabilityLimit: fp?.affordability_ratio || state.affordabilityLimit, loanConfig: { ...cfg, maxPeriod } });
      setCfg(prev => ({ ...prev, maxPeriod }));
    })();
  }, [state.targetUser?.id]);

  const setC = (k: keyof typeof cfg, v: any) => {
    const next = { ...cfg, [k]: v };
    setCfg(next);
    update({ loanConfig: next });
    if (k === 'startDate') setDateError(validateRepaymentDate(v).reason || '');
  };

  const calc = calculateLoan(cfg.amount, cfg.period, cfg.startDate, historyCount, isFirstLoanOfYear);
  const limit = affordabilityLimit;
  const exceeds = limit > 0 && calc.monthly > limit;

  const r2 = 0.05, cpi2 = 0.0045, init2 = calc.waiveInit ? 0 : 0.15, vatR = 0.15;
  let maxLoan = 10000;
  if (limit > 0) {
    const d = 1 + r2 * cfg.period + cpi2 * cfg.period + init2 * (1 + vatR) + (69 * cfg.period * (1 + vatR)) / Math.max(cfg.amount, 1);
    maxLoan = Math.floor((limit * cfg.period / d) / 100) * 100;
  }

  function handleNext() {
    if (!cfg.startDate) { toast('Please select a first repayment date.', 'warning'); return; }
    const v = validateRepaymentDate(cfg.startDate);
    if (!v.valid) { toast(`Invalid Date: ${v.reason}`, 'error'); return; }
    if (exceeds) { toast(`Loan Unaffordable: Max allowed is ${fmt(maxLoan)}`, 'error'); return; }
    if (cfg.amount < 100) { toast('Minimum loan amount is R 100.', 'warning'); return; }
    onNext();
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {/* Left: Configure */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Configure Loan</h3>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700 }}>Max for {cfg.period} Month{cfg.period > 1 ? 's' : ''}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-primary)' }}>R {maxLoan.toLocaleString()}</div>
          </div>
        </div>

        {[
          { label: 'Amount (ZAR)', node: <input className="admin-input" type="number" value={cfg.amount} min={100} style={{ borderColor: exceeds ? '#EF4444' : undefined }} onChange={e => setC('amount', Number(e.target.value))} /> },
          { label: 'Period (Months)', node: <select className="admin-select" value={cfg.period} onChange={e => setC('period', Number(e.target.value))}>
              <option value={1}>1 Month</option>
              {cfg.maxPeriod > 1 && <><option value={3}>3 Months</option><option value={6}>6 Months</option><option value={12}>12 Months</option></>}
            </select>
          },
          { label: 'First Repayment Date', node: <>
              <input className="admin-input" type="date" value={cfg.startDate} onChange={e => setC('startDate', e.target.value)} />
              {dateError && <p style={{ fontSize: 11, color: '#EF4444', marginTop: 4, fontWeight: 600 }}>{dateError}</p>}
            </>
          },
          { label: 'Purpose of Loan', node: <select className="admin-select" value={cfg.reason} onChange={e => setC('reason', e.target.value)}>
              {LOAN_PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          },
        ].map(({ label, node }) => (
          <div key={label} style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: 6 }}>{label}</label>
            {node}
          </div>
        ))}

        {exceeds && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#B91C1C', display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, marginTop: 1 }}>warning</span>
            <span><strong>Limit Exceeded:</strong> Max monthly payment is {fmt(limit)}. This loan requires {fmt(calc.monthly)}.</span>
          </div>
        )}

        <button onClick={handleNext} style={{ width: '100%', marginTop: 20, padding: '13px 0', borderRadius: 12, background: 'var(--color-primary)', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}>
          Next Step →
        </button>
      </div>

      {/* Right: Quote summary */}
      <div style={{ background: '#1F2937', color: '#fff', borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#9CA3AF', letterSpacing: 2, marginBottom: 10 }}>Quote Summary</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid #374151', paddingBottom: 16, marginBottom: 16 }}>
            <span style={{ fontSize: 32, fontWeight: 900 }}>{fmt(cfg.amount)}</span>
            <span style={{ color: '#9CA3AF', fontSize: 12, marginBottom: 4 }}>Principal</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ color: '#9CA3AF', fontSize: 13 }}>Total Annual Rate</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#A78BFA' }}>{(calc.totalRate * 100).toFixed(0)}%</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', borderLeft: '2px solid rgba(167,139,250,0.5)', borderRadius: 8, padding: '10px 16px', marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[['Interest', `${(calc.interestRate * 100).toFixed(1)}%`], ['Initiation', `${(calc.initiationRate * 100).toFixed(0)}%`]].map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#6B7280', fontWeight: 700 }}>{l}</div>
                  <div style={{ fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {[
            ['Duration', `${cfg.period} Month${cfg.period > 1 ? 's' : ''}`],
            ['Total Interest', fmt(calc.totalInterest)],
          ].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #374151', fontSize: 13 }}>
              <span style={{ color: '#9CA3AF' }}>{l}</span><span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #374151' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ color: '#9CA3AF', fontSize: 13 }}>Total Repayment</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#34D399' }}>{fmt(calc.totalRepay)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#6B7280', fontSize: 12 }}>Monthly Installment</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: exceeds ? '#F87171' : '#D1D5DB' }}>{fmt(calc.monthly)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 6: Docs ───────────────────────────────────────────────────────────────

function StepDocs({ state, update, onNext }: { state: WizardState; update: (p: Partial<WizardState>) => void; onNext: () => void }) {
  const [docStatus, setDocStatus] = useState<Record<string, { exists: boolean; path?: string }>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const DOC_TYPES = [
    { key: 'idcard', label: 'ID Document' },
    { key: 'till_slip', label: 'Latest Payslip' },
    { key: 'bank_statement', label: 'Bank Statement' },
  ];

  useEffect(() => {
    if (!state.targetUser) return;
    (async () => {
      const results: Record<string, { exists: boolean; path?: string }> = {};
      for (const doc of DOC_TYPES) {
        const { data } = await supabase.from('document_uploads').select('*')
          .eq('user_id', state.targetUser!.id).eq('file_type', doc.key)
          .order('created_at', { ascending: false }).limit(1);
        results[doc.key] = { exists: !!data?.[0], path: data?.[0]?.file_path };
      }
      setDocStatus(results);
    })();
  }, [state.targetUser?.id]);

  async function handleView(path: string) {
    const { data, error } = await supabase.storage.from('client_docs').createSignedUrl(path, 60);
    if (error) { toast(error.message, 'error'); return; }
    window.open(data.signedUrl, '_blank');
  }

  async function handleUpload(key: string, file: File) {
    setUploading(prev => ({ ...prev, [key]: true }));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = file.name.split('.').pop();
      const fileName = `${key}_${Date.now()}.${ext}`;
      const filePath = `${user!.id}/${state.targetUser!.id}_${fileName}`;

      const { error: uploadErr } = await supabase.storage.from('client_docs').upload(filePath, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      let appId = state.applicationId;
      if (!appId) {
        const { data: newApp } = await supabase.from('loan_applications').insert([{
          user_id: state.targetUser!.id, status: 'STARTED',
          amount: state.loanConfig.amount, term_months: state.loanConfig.period,
          loan_purpose: state.loanConfig.reason, source: 'IN_BRANCH', created_by_admin: user!.id,
        }]).select().single();
        if (newApp) { appId = newApp.id; update({ applicationId: appId }); }
      }

      await supabase.from('document_uploads').insert([{
        user_id: state.targetUser!.id, application_id: appId, file_name: fileName,
        original_name: file.name, file_path: filePath, file_type: key,
        mime_type: file.type, file_size: file.size, uploaded_by_admin: user!.id,
      }]);

      setDocStatus(prev => ({ ...prev, [key]: { exists: true, path: filePath } }));
      toast('Uploaded!', 'success');
    } catch (e: any) { toast(e.message, 'error'); }
    setUploading(prev => ({ ...prev, [key]: false }));
  }

  const card: React.CSSProperties = {
    maxWidth: 600, margin: '0 auto', background: 'var(--color-surface)',
    border: '1px solid var(--color-border)', borderRadius: 16, padding: 28,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  };

  return (
    <div style={card}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>Required Documents</h3>
      {DOC_TYPES.map(doc => {
        const s = docStatus[doc.key] || { exists: false };
        return (
          <div key={doc.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', border: '1px solid var(--color-border)', borderRadius: 12, background: 'var(--color-surface-muted)', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: s.exists ? '#D1FAE5' : '#F3F4F6', color: s.exists ? '#059669' : '#9CA3AF' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{s.exists ? 'check_circle' : 'upload'}</span>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{doc.label}</div>
                <div style={{ fontSize: 11, color: s.exists ? '#059669' : 'var(--color-text-muted)' }}>{s.exists ? 'Uploaded' : 'Missing'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {s.exists && s.path && (
                <button onClick={() => handleView(s.path!)} style={{ fontSize: 12, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>View</button>
              )}
              <label style={{ padding: '6px 14px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                {uploading[doc.key] ? 'Uploading...' : s.exists ? 'Replace' : 'Upload'}
                <input type="file" style={{ display: 'none' }} accept=".pdf,.jpg,.png,.jpeg"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(doc.key, f); }} />
              </label>
            </div>
          </div>
        );
      })}

      <button onClick={onNext} style={{ width: '100%', marginTop: 16, padding: '13px 0', borderRadius: 12, background: 'var(--color-primary)', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}>
        Continue →
      </button>
    </div>
  );
}

// ── Step 7: Confirm ────────────────────────────────────────────────────────────

function StepConfirm({ state, update, loading, setLoading, navigate }: {
  state: WizardState; update: (p: Partial<WizardState>) => void;
  loading: boolean; setLoading: (v: boolean) => void;
  navigate: (path: string) => void;
}) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [showNewBank, setShowNewBank] = useState(false);
  const [newBank, setNewBank] = useState({ name: '', number: '', type: 'savings', code: '' });
  const [selectedId, setSelectedId] = useState(state.selectedBankId);
  const [consent, setConsent] = useState(state.adminConsent);

  const { loanConfig, targetUser, historyCount, isFirstLoanOfYear } = state;
  const { amount, period, startDate, reason } = loanConfig;
  const calc = calculateLoan(amount, period, startDate, historyCount, isFirstLoanOfYear);

  useEffect(() => {
    if (!targetUser) return;
    supabase.from('bank_accounts').select('*').eq('user_id', targetUser.id).then(({ data }) => setAccounts((data ?? []) as BankAccount[]));
  }, [targetUser?.id]);

  const firstDebitDate = startDate ? new Date(startDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not set';

  async function handleSubmit() {
    if (!selectedId && !showNewBank) { toast('Please select or add a bank account.', 'warning'); return; }
    if (!consent) { toast('Please confirm identity verification.', 'warning'); return; }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let bankId = selectedId;

      if (showNewBank && !bankId) {
        const { data: savedBank, error: bankErr } = await supabase.from('bank_accounts').insert([{
          user_id: targetUser!.id, bank_name: newBank.name, account_holder: targetUser!.full_name,
          account_number: newBank.number, branch_code: newBank.code, account_type: newBank.type,
          is_verified: true, created_by_admin: user!.id,
        }]).select().single();
        if (bankErr) throw bankErr;
        bankId = savedBank.id;
      }

      if (!bankId) throw new Error('Please select a bank account.');

      let appId = state.applicationId;
      if (!appId) {
        const { data: newApp, error: appErr } = await supabase.from('loan_applications').insert([{
          user_id: targetUser!.id, status: 'STARTED', amount, term_months: period,
          loan_purpose: reason, source: 'IN_BRANCH', created_by_admin: user!.id,
        }]).select().single();
        if (appErr) throw appErr;
        appId = newApp.id;
      }

      const updatePayload = {
        status: 'AFFORD_OK', amount, term_months: period, bank_account_id: bankId,
        offer_principal: amount, offer_interest_rate: calc.interestRate,
        offer_total_interest: calc.totalInterest, offer_total_initiation_fees: calc.totalInit,
        offer_monthly_repayment: calc.monthly, offer_total_repayment: calc.totalRepay,
        offer_total_admin_fees: calc.totalSvc, offer_credit_life_monthly: calc.monthCpi,
        offer_credit_life_total: calc.totalCpi, repayment_start_date: startDate,
        loan_purpose: reason || 'Personal Loan',
        offer_details: {
          first_repayment_date: startDate, interest_rate_monthly: calc.interestRate,
          initiation_rate: calc.initiationRate, credit_life_rate: 0.0045,
          vat_amount: calc.vatAmt, total_cost_of_credit: calc.totalCost,
          waive_initiation: calc.waiveInit, source: 'In-Branch Admin Terminal',
        },
        notes: `In-branch application for ${targetUser!.full_name}. Purpose: ${reason || 'Personal Loan'}. Verified by Admin.`,
      };

      const { error: updErr } = await supabase.from('loan_applications').update(updatePayload).eq('id', appId);
      if (updErr) throw updErr;

      toast('Application Submitted Successfully!', 'success');
      setTimeout(() => navigate(`/applications/${appId}`), 1500);
    } catch (e: any) { toast(e.message, 'error'); }
    setLoading(false);
  }

  const selectedAccount = accounts.find(a => a.id === selectedId);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 24 }}>
      {/* Left */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Payout account */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>account_balance</span>
              Payout Account
            </h3>
            <button onClick={() => { setShowNewBank(!showNewBank); setSelectedId(''); }} style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', background: 'rgba(109,40,217,0.06)', border: '1px solid rgba(109,40,217,0.2)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
              + ADD NEW
            </button>
          </div>

          {!showNewBank && (
            <select className="admin-select" value={selectedId} onChange={e => { setSelectedId(e.target.value); update({ selectedBankId: e.target.value }); }}>
              <option value="">-- Select Verified Account --</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.bank_name} - ****{acc.account_number.slice(-4)}</option>
              ))}
            </select>
          )}

          {showNewBank && (
            <div style={{ background: '#111827', borderRadius: 16, padding: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, display: 'block', marginBottom: 4 }}>Bank</label>
                  <select style={{ width: '100%', background: '#1F2937', color: '#fff', border: '1px solid #374151', borderRadius: 8, padding: '8px 12px' }}
                    value={newBank.name} onChange={e => setNewBank(p => ({ ...p, name: e.target.value, code: BANK_BRANCH_CODES[e.target.value] || '' }))}>
                    <option value="">Select bank</option>
                    {Object.keys(BANK_BRANCH_CODES).map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, display: 'block', marginBottom: 4 }}>Account Type</label>
                  <select style={{ width: '100%', background: '#1F2937', color: '#fff', border: '1px solid #374151', borderRadius: 8, padding: '8px 12px' }}
                    value={newBank.type} onChange={e => setNewBank(p => ({ ...p, type: e.target.value }))}>
                    <option value="savings">Savings</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, display: 'block', marginBottom: 4 }}>Account Number</label>
                  <input type="text" inputMode="numeric" placeholder="Account Number"
                    style={{ width: '100%', background: '#1F2937', color: '#fff', border: '1px solid #374151', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }}
                    value={newBank.number} onChange={e => setNewBank(p => ({ ...p, number: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, display: 'block', marginBottom: 4 }}>Branch Code</label>
                  <input type="text" readOnly value={newBank.code}
                    style={{ width: '100%', background: '#374151', color: '#9CA3AF', border: '1px solid #374151', borderRadius: 8, padding: '8px 12px', cursor: 'not-allowed', boxSizing: 'border-box' }} />
                </div>
              </div>
              <button onClick={() => { setShowNewBank(false); }} style={{ width: '100%', padding: '12px 0', borderRadius: 10, background: 'var(--color-primary)', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}>
                Confirm Account
              </button>
            </div>
          )}

          {selectedAccount && !showNewBank && (
            <div style={{ marginTop: 16, border: '2px solid var(--color-primary)', borderRadius: 14, padding: 16, background: 'rgba(109,40,217,0.04)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 4 }}>Selected Payout Account</div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{selectedAccount.bank_name}</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{selectedAccount.account_number}</div>
            </div>
          )}
        </div>

        {/* Admin consent */}
        <div style={{ background: 'rgba(109,40,217,0.04)', border: '1px solid rgba(109,40,217,0.15)', borderRadius: 14, padding: 20 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={consent} onChange={e => { setConsent(e.target.checked); update({ adminConsent: e.target.checked }); }} style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 13, lineHeight: 1.5 }}>
              I confirm I have physically verified the identity of <strong>{targetUser?.full_name}</strong> and confirmed the banking details.
            </span>
          </label>
        </div>
      </div>

      {/* Right: Loan summary */}
      <div style={{ background: '#1F2937', color: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', border: '1px solid #374151', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid #374151', padding: '14px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-primary)', letterSpacing: 2 }}>Loan Offer Summary</div>
        </div>
        <div style={{ padding: 28, flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid #374151', paddingBottom: 20, marginBottom: 20 }}>
            <span style={{ fontSize: 36, fontWeight: 900 }}>{fmt(amount)}</span>
            <span style={{ color: '#9CA3AF', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Principal</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#9CA3AF' }}>Monthly Payout</span>
              <span style={{ fontSize: 24, fontWeight: 900, color: '#A78BFA' }}>{fmt(calc.monthly)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#9CA3AF' }}>Total Repayable</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#34D399' }}>{fmt(calc.totalRepay)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #374151' }}>
              <span style={{ color: '#9CA3AF' }}>Term Duration</span>
              <span style={{ fontWeight: 600 }}>{period} Month{period > 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#9CA3AF' }}>First Debit Date</span>
              <span style={{ fontWeight: 700, color: '#A78BFA' }}>{firstDebitDate}</span>
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid #374151', padding: '20px 24px', background: 'rgba(0,0,0,0.2)' }}>
          <button onClick={handleSubmit} disabled={loading || !consent} style={{
            width: '100%', padding: '16px 0', borderRadius: 14, background: 'var(--color-primary)',
            color: '#fff', fontWeight: 900, fontSize: 16, border: 'none', cursor: loading || !consent ? 'not-allowed' : 'pointer',
            opacity: loading || !consent ? 0.6 : 1, boxShadow: '0 4px 24px rgba(109,40,217,0.4)',
          }}>
            {loading ? 'Submitting...' : 'SUBMIT APPLICATION'}
          </button>
          <p style={{ fontSize: 9, color: '#6B7280', marginTop: 12, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 }}>
            {state.applicationId ? `Application #${state.applicationId}` : 'New Loan Application'}
          </p>
        </div>
      </div>
    </div>
  );
}
