import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { apiFetch } from '../api/apiClient';

// NCA-compliant rates (matches legacy loan-config.js)
const INTEREST_RATE_MONTHLY     = 0.05;   // 5% per month
const INITIATION_FEE_RATE       = 0.15;   // 15% one-time (standard)
const INITIATION_FEE_RATE_FIRST = 0.05;   // 5% for first loan of the calendar year
const CREDIT_LIFE_RATE          = 0.0045; // 0.45%/month CPI
const SERVICE_FEE_MONTHLY       = 60;     // R60/month
const VAT_RATE                  = 0.15;
const MAX_ONLINE_TERM           = 6;      // online cap regardless of history
const MAX_ONLINE_AMOUNT         = 10_000;

const BRANCH_CODES: Record<string, string> = {
  'FNB': '250655', 'Standard Bank': '051001', 'ABSA': '632005', 'Nedbank': '198765',
  'Capitec': '470010', 'Investec': '580105', 'TymeBank': '678910', 'Discovery Bank': '679000', 'African Bank': '430000',
};

const fmt = (v: number) => `R ${(Number(v) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

// ── loan summary calc (verbatim from legacy loan-config.js) ──────────────────

function loanSummary(amount: number, period: number, isFirstLoanOfYear: boolean, startDate: string | null) {
  const initiationRate = isFirstLoanOfYear ? INITIATION_FEE_RATE_FIRST : INITIATION_FEE_RATE;

  let totalServiceFees: number;
  if (startDate) {
    const start = new Date(); start.setHours(12, 0, 0, 0);
    const pay = new Date(startDate); pay.setHours(12, 0, 0, 0);
    const days = Math.max(1, Math.ceil((pay.getTime() - start.getTime()) / 86400000));
    const prorated = Math.min(days, 30);
    totalServiceFees = (SERVICE_FEE_MONTHLY / 30) * prorated + (period > 1 ? SERVICE_FEE_MONTHLY * (period - 1) : 0);
  } else {
    totalServiceFees = SERVICE_FEE_MONTHLY * period;
  }

  const totalInterest       = amount * INTEREST_RATE_MONTHLY * period;
  const totalInitiationFees = amount * initiationRate;
  const totalCreditLife     = amount * CREDIT_LIFE_RATE * period;
  const monthlyCreditLife   = amount * CREDIT_LIFE_RATE;
  const vatAmount           = (totalInitiationFees + totalServiceFees) * VAT_RATE;
  const totalCostOfCredit   = totalInterest + totalInitiationFees + totalServiceFees + totalCreditLife + vatAmount;
  const totalRepayment      = amount + totalCostOfCredit;
  const monthlyPayment      = totalRepayment / period;

  return { totalInterest, totalInitiationFees, totalServiceFees, totalCreditLife, monthlyCreditLife, vatAmount, totalCostOfCredit, totalRepayment, monthlyPayment, initiationRate };
}

// ── page data ─────────────────────────────────────────────────────────────────

async function fetchApplyData() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const uid = session.user.id;

  const [
    { data: profile },
    { data: docs },
    { data: creditChecks },
    { data: priorLoans },
    { data: bankAccounts },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', uid).single(),
    supabase.from('document_uploads').select('file_type, uploaded_at').eq('user_id', uid).in('file_type', ['till_slip', 'bank_statement']).order('uploaded_at', { ascending: false }),
    supabase.from('credit_checks').select('credit_score, risk_category, status, application_id, checked_at').eq('user_id', uid).eq('status', 'completed').order('checked_at', { ascending: false }).limit(1),
    supabase.from('loan_applications').select('id, created_at').eq('user_id', uid).in('status', ['DISBURSED', 'OFFER_ACCEPTED', 'READY_TO_DISBURSE', 'ACTIVE', 'CONTRACT_SIGN', 'DEBICHECK_AUTH']),
    supabase.from('bank_accounts').select('*').eq('user_id', uid).order('is_primary', { ascending: false }),
  ]);

  const uploadedTypes = new Set((docs ?? []).map(d => d.file_type));
  const currentYear = new Date().getFullYear();

  return {
    userId: uid,
    profile,
    hasPayslip: uploadedTypes.has('till_slip'),
    hasBankStatement: uploadedTypes.has('bank_statement'),
    existingCheck: creditChecks?.[0] ?? null,
    isFirstLoanOfYear: !(priorLoans ?? []).some(l => new Date(l.created_at).getFullYear() === currentYear),
    bankAccounts: bankAccounts ?? [],
  };
}

// ── signature pad (legacy signature-canvas markup) ────────────────────────────

function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#1C1C1E';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  return (
    <div className="signature-canvas-container">
      <canvas
        id="signatureCanvas"
        ref={canvasRef}
        className="signature-canvas"
        width={600} height={160}
        onPointerDown={e => {
          drawing.current = true;
          const ctx = canvasRef.current?.getContext('2d');
          const p = pos(e);
          ctx?.beginPath();
          ctx?.moveTo(p.x, p.y);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={e => {
          if (!drawing.current) return;
          const ctx = canvasRef.current?.getContext('2d');
          const p = pos(e);
          ctx?.lineTo(p.x, p.y);
          ctx?.stroke();
          hasInk.current = true;
        }}
        onPointerUp={() => {
          drawing.current = false;
          if (hasInk.current && canvasRef.current) onChange(canvasRef.current.toDataURL('image/png'));
        }}
      />
      <button
        type="button"
        className="clear-signature-btn"
        onClick={() => {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');
          if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
          hasInk.current = false;
          onChange(null);
        }}
      >
        <i className="fas fa-eraser" /> Clear
      </button>
    </div>
  );
}

// ── step indicator (legacy .steps / .step markup) ─────────────────────────────

const STEPS = ['Documents', 'Credit Check', 'Select Amount', 'Confirmation'];

function StepBar({ current, maxReached, onGo }: { current: number; maxReached: number; onGo: (s: number) => void }) {
  return (
    <div className="steps">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const cls = n === current ? 'active' : n < current || n <= maxReached ? 'completed' : 'inactive';
        return (
          <div
            key={label}
            className={`step ${cls}`}
            style={{ cursor: n <= maxReached ? 'pointer' : 'default' }}
            onClick={() => n <= maxReached && onGo(n)}
          >
            <span className="step-number">{`0${n}`}</span>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── main wizard (legacy apply-loan.html / -2 / -3 / confirmation.html) ───────

export function ApplyLoanPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep]             = useState(1);
  const [maxReached, setMaxReached] = useState(1);
  const [consent, setConsent]       = useState(false);
  const [uploading, setUploading]   = useState<string | null>(null);
  const [notice, setNotice]         = useState<{ ok: boolean; text: string } | null>(null);

  // credit check state
  const [checking, setChecking]     = useState(false);
  const [checkResult, setCheckResult] = useState<{ score: number; riskType: string } | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);

  // loan config modal + state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [amount, setAmount]         = useState(5000);
  const [period, setPeriod]         = useState(1);
  const [startDate, setStartDate]   = useState('');
  const [signature, setSignature]   = useState<string | null>(null);
  const [termsOk, setTermsOk]       = useState(false);

  // confirmation / banking modal + state
  const [showBankingModal, setShowBankingModal] = useState(false);
  const [bankChoice, setBankChoice] = useState<'saved' | 'new'>('saved');
  const [savedAccountId, setSavedAccountId] = useState<number | null>(null);
  const [newBank, setNewBank]       = useState({ bankName: '', holder: '', accountNumber: '', branchCode: '', accountType: '' });
  const [finalConsent, setFinalConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingDocType = useRef<'till_slip' | 'bank_statement' | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['apply-loan'], queryFn: fetchApplyData, staleTime: 30_000, retry: 1 });

  const kycComplete = !!(data?.profile?.identity_number && data?.profile?.first_name && data?.profile?.last_name && data?.profile?.date_of_birth && data?.profile?.address && data?.profile?.postal_code);
  const docsReady = kycComplete && !!data?.hasPayslip && !!data?.hasBankStatement;
  const summary = loanSummary(amount, period, data?.isFirstLoanOfYear ?? false, startDate || null);
  const existingScore = checkResult?.score ?? data?.existingCheck?.credit_score ?? null;

  function goTo(n: number) {
    setStep(n);
    setMaxReached(m => Math.max(m, n));
    setNotice(null);
  }

  async function uploadDoc(file: File) {
    const type = pendingDocType.current;
    if (!type || !data) return;
    setUploading(type);
    try {
      const ext = file.name.split('.').pop();
      const path = `${data.userId}/${type}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);
      const { error: dbErr } = await supabase.from('document_uploads').insert([{ user_id: data.userId, file_name: file.name, file_type: type, file_path: publicUrl }]);
      if (dbErr) throw dbErr;
      await queryClient.invalidateQueries({ queryKey: ['apply-loan'] });
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : 'Upload failed' });
    } finally {
      setUploading(null);
    }
  }

  async function runCreditCheck() {
    if (!data?.profile) return;
    const p = data.profile;

    const required: Record<string, unknown> = {
      'ID Number': p.identity_number, 'Surname': p.last_name, 'First Name': p.first_name,
      'Gender': p.gender, 'Date of Birth': p.date_of_birth, 'Street Address': p.address, 'Postal Code': p.postal_code,
    };
    const missing = Object.entries(required).filter(([, v]) => !v || !String(v).trim()).map(([k]) => k);
    if (missing.length > 0) {
      setNotice({ ok: false, text: `Please complete your profile first: ${missing.join(', ')}` });
      setTimeout(() => navigate('/user-portal/profile'), 2000);
      return;
    }

    setChecking(true);
    setNotice(null);
    try {
      await supabase.from('declarations').upsert([{
        user_id: data.userId,
        credit_check_consent_accepted: true,
        updated_at: new Date().toISOString(),
      }], { onConflict: 'user_id' });

      let appId = applicationId;
      if (!appId) {
        const { data: newApp, error: appErr } = await supabase.from('loan_applications').insert([{
          user_id: data.userId, status: 'BUREAU_CHECKING', amount: 0, term_months: 0, purpose: 'Personal Loan',
        }]).select().single();
        if (appErr) throw new Error('Failed to create application. Please try again.');
        appId = newApp.id;
        setApplicationId(appId);
      } else {
        await supabase.from('loan_applications').update({ status: 'BUREAU_CHECKING' }).eq('id', appId);
      }

      const rawGender = String(p.gender || '').toUpperCase();
      const dob = String(p.date_of_birth).substring(0, 10).replace(/-/g, '');

      const res = await apiFetch('/api/credit-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: appId,
          userData: {
            user_id: data.userId,
            identity_number: p.identity_number,
            surname: p.last_name, forename: p.first_name, forename2: '', forename3: '',
            gender: rawGender.startsWith('F') ? 'F' : 'M',
            date_of_birth: dob,
            address1: p.address, address2: p.suburb_area || '', address3: '', address4: '',
            postal_code: p.postal_code,
            home_tel_code: '', home_tel_no: '', work_tel_code: '', work_tel_no: '',
            cell_tel_no: p.cell_tel_no || p.contact_number || '',
            passport_flag: 'N',
          },
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Credit check failed');

      const score = result.creditScore?.score ?? 0;
      const riskType = result.creditScore?.riskType ?? 'Unknown';

      await supabase.from('loan_applications').update({ bureau_score_band: score, status: 'BUREAU_OK' }).eq('id', appId);

      try {
        await apiFetch(`/api/applications/${appId}/evaluate`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      } catch { /* non-blocking */ }

      setCheckResult({ score, riskType });
    } catch (e) {
      if (applicationId) {
        await supabase.from('loan_applications').update({ status: 'BUREAU_DECLINE' }).eq('id', applicationId);
      }
      setNotice({ ok: false, text: e instanceof Error ? e.message : 'Credit check failed' });
    } finally {
      setChecking(false);
    }
  }

  async function submitApplication() {
    if (!data) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired');

      let bankAccountId: number | null = null;
      if (bankChoice === 'saved' && savedAccountId) {
        bankAccountId = savedAccountId;
        await supabase.from('bank_accounts').update({ last_used_at: new Date().toISOString() }).eq('id', bankAccountId);
      } else {
        if (!newBank.bankName || !newBank.holder || !newBank.accountNumber || !newBank.branchCode || !newBank.accountType) {
          throw new Error('Please complete all banking details.');
        }
        const { data: created, error: bankErr } = await supabase.from('bank_accounts').insert([{
          user_id: data.userId,
          bank_name: newBank.bankName,
          account_holder: newBank.holder,
          account_number: newBank.accountNumber,
          branch_code: newBank.branchCode,
          account_type: newBank.accountType,
          last_used_at: new Date().toISOString(),
        }]).select().single();
        if (bankErr) throw new Error('Failed to save banking details. Please try again.');
        bankAccountId = created.id;
      }

      const firstPaymentIso = startDate ? new Date(`${startDate}T00:00:00.000Z`).toISOString() : null;
      const offerFields = {
        offer_principal:             amount,
        offer_interest_rate:         0.05,
        offer_total_interest:        summary.totalInterest,
        offer_total_admin_fees:      summary.totalServiceFees,
        offer_total_initiation_fees: summary.totalInitiationFees,
        offer_credit_life_monthly:   summary.monthlyCreditLife,
        offer_vat_amount:            summary.vatAmount,
        offer_total_cost_of_credit:  summary.totalCostOfCredit,
        offer_monthly_repayment:     summary.monthlyPayment,
        offer_total_repayment:       summary.totalRepayment,
      };
      const offerDetails = {
        interest_rate: INTEREST_RATE_MONTHLY,
        total_interest: summary.totalInterest,
        total_repayment: summary.totalRepayment,
        monthly_payment: summary.monthlyPayment,
        first_payment_date: firstPaymentIso,
        signature_data: signature,
      };

      let app;
      if (applicationId) {
        const { data: updated, error: updErr } = await supabase.from('loan_applications').update({
          amount, term_months: period, purpose: 'Personal Loan', status: 'STARTED',
          bank_account_id: bankAccountId, repayment_start_date: firstPaymentIso,
          ...offerFields, offer_details: offerDetails,
        }).eq('id', applicationId).eq('user_id', data.userId).select().single();
        if (updErr) throw new Error('Failed to update loan application. Please try again.');
        app = updated;
      } else {
        const { data: created, error: createErr } = await supabase.from('loan_applications').insert([{
          user_id: data.userId, amount, term_months: period, purpose: 'Personal Loan',
          status: 'STARTED', bank_account_id: bankAccountId, repayment_start_date: firstPaymentIso,
          ...offerFields, offer_details: offerDetails,
        }]).select().single();
        if (createErr) throw createErr;
        app = created;
      }

      const clientRef = `C${data.userId.substring(0, 8).toUpperCase()}`;
      const loanRef = `${clientRef}-L${String(app.id).padStart(6, '0')}`;
      await supabase.from('loan_applications').update({ loan_reference: loanRef, agreement_number: `AGR${app.id}` }).eq('id', app.id).eq('user_id', data.userId);

      try {
        await apiFetch(`/api/applications/${app.id}/route-to-head-office`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      } catch { /* non-blocking */ }

      setSubmittedId(loanRef);
      setShowBankingModal(false);
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : 'Submission failed' });
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="content-wrapper" style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <i className="fas fa-circle-notch fa-spin" style={{ fontSize: 28, color: 'var(--color-primary)' }} />
        </div>
      </div>
    );
  }

  // ── success screen ──
  if (submittedId) {
    return (
      <div className="container with-border">
        <div className="content" style={{ justifyContent: 'center' }}>
          <div className="right-section" style={{ margin: '0 auto', textAlign: 'center', maxWidth: 480 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <i className="fas fa-check" style={{ fontSize: 28, color: '#059669' }} />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main, #1C1C1E)', margin: '0 0 8px' }}>Application Submitted!</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted, #8E8E93)', margin: '0 0 6px' }}>Your reference number is</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-primary)', margin: '0 0 20px', letterSpacing: '0.02em' }}>{submittedId}</p>
            <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.7, margin: '0 0 28px' }}>
              Your application is being reviewed. You'll be notified once it's approved,
              and your repayment date will be confirmed by our team.
            </p>
            <button className="next-btn" onClick={() => navigate('/user-portal/dashboard')}>
              <span>Back to Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container with-border">
      <StepBar current={step} maxReached={maxReached} onGo={goTo} />

      {notice && (
        <div className="minimal-notice" style={{ margin: '16px 0' }}>
          <i className="fas fa-exclamation-triangle" /> {notice.text}
        </div>
      )}

      {/* ══ STEP 1 — Documents (legacy apply-loan.html) ══ */}
      {step === 1 && (
        <div className="content">
          <div className="left-section">
            <div className="left-title">Consent &amp; Privacy</div>
            <div className="left-subtitle">
              <button className={`consent-btn${consent ? ' active' : ''}`} onClick={() => setConsent(c => !c)}>
                <i className={`fas ${consent ? 'fa-check-square' : 'fa-square'}`} />
                <span>I Consent to Privacy Policy</span>
              </button>
              <p style={{ fontSize: '1rem', lineHeight: 1.6, color: '#666' }}>
                I consent to the collection and processing of my documents and personal information for loan application
                and verification purposes. I have read and agree to the <a href="#" className="privacy-link">Privacy Policy</a>.
              </p>
              <span style={{ color: '#888', fontSize: '0.95rem' }}>You must give consent before proceeding.</span>
            </div>
          </div>
          <div className="right-section">
            <ul className={`document-list${!consent ? ' hidden-consent' : ''}`}>
              <li>
                <button className="document-btn" onClick={() => navigate('/user-portal/profile')}>
                  <span className="document-icon-pill"><i className="fas fa-user-check document-icon" /></span>
                  <div className="document-copy">
                    <span className="document-label">KYC Verification</span>
                    <small>Confirm your personal details</small>
                  </div>
                  <span className="document-status">{kycComplete ? 'Complete' : 'Start'}</span>
                </button>
              </li>
              <li>
                <button className="document-btn" onClick={() => { pendingDocType.current = 'till_slip'; fileInputRef.current?.click(); }}>
                  <span className="document-icon-pill"><i className="fas fa-receipt document-icon" /></span>
                  <div className="document-copy">
                    <span className="document-label">Payslip</span>
                    <small>Latest payslip/salary slip</small>
                  </div>
                  <span className="document-status">{data?.hasPayslip ? 'Uploaded' : uploading === 'till_slip' ? 'Uploading…' : 'Pending'}</span>
                </button>
              </li>
              <li>
                <button className="document-btn" onClick={() => { pendingDocType.current = 'bank_statement'; fileInputRef.current?.click(); }}>
                  <span className="document-icon-pill"><i className="fas fa-landmark document-icon" /></span>
                  <div className="document-copy">
                    <span className="document-label">Bank Statement</span>
                    <small>Latest 3-month statement</small>
                  </div>
                  <span className="document-status">{data?.hasBankStatement ? 'Uploaded' : uploading === 'bank_statement' ? 'Uploading…' : 'Pending'}</span>
                </button>
              </li>
            </ul>
            <div className="module-status" />
            <button className="next-btn" disabled={!docsReady} onClick={() => goTo(2)}>
              <span>Next</span>
              <i className="fas fa-arrow-right" />
            </button>
          </div>

          <input
            ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(f); e.target.value = ''; }}
          />
        </div>
      )}

      {/* ══ STEP 2 — Credit Check (legacy apply-loan-2.html) ══ */}
      {step === 2 && (
        <div className="content">
          <div className="left-section">
            <div className="left-title">Credit Check Required</div>
            <div className="left-subtitle">
              We need to verify your credit information to proceed with your loan application.
            </div>
            <div className="steps-guide">
              {[
                { n: 1, t: 'Provide ID Number', s: '13-digit South African ID' },
                { n: 2, t: 'Personal Information', s: 'Name, date of birth, and gender' },
                { n: 3, t: 'Address Details', s: 'Residential address and postal code' },
                { n: 4, t: 'Verify & Submit', s: 'Review information and consent' },
              ].map(g => (
                <div className="guide-step" key={g.n}>
                  <div className="guide-number">{g.n}</div>
                  <div className="guide-text">
                    <strong>{g.t}</strong>
                    <span>{g.s}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="privacy-note">
              <i className="fas fa-shield-alt" />
              <span>Your information is protected with bank-level encryption.<br />We use Experian, South Africa's leading credit bureau.</span>
            </div>
          </div>
          <div className="right-section">
            <div className="credit-circle-outer">
              {checkResult || data?.existingCheck ? (
                <button id="start-credit-check-btn" className="is-done" onClick={() => goTo(3)}>
                  <span className="scc-label">Next&nbsp;<i className="fas fa-arrow-right" /></span>
                </button>
              ) : (
                <button id="start-credit-check-btn" className={checking ? 'is-loading' : ''} onClick={runCreditCheck} disabled={checking}>
                  <span className="scc-label" style={{ display: checking ? 'none' : undefined }}>Start<br />Credit<br />Check</span>
                  <span className="scc-spinner" style={{ display: checking ? undefined : 'none' }}><i className="fas fa-sync-alt fa-spin fa-2x" /></span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Credit result popup (legacy #credit-result-popup) */}
      {step === 2 && checkResult && (
        <div className="credit-result-popup">
          <div className="cr-card">
            <div className="cr-banner" style={{ background: '#10B981' }}>
              <div className="cr-banner-icon"><i className="fas fa-shield-check" /></div>
            </div>
            <button className="cr-close" onClick={() => setCheckResult(null)} title="Close"><i className="fas fa-times" /></button>
            <div className="cr-body">
              <p className="cr-subtitle">Credit Check Complete</p>
              <h2 className="cr-headline">Bureau Score</h2>
              <div className="cr-score-ring">
                <span className="cr-score-number">{checkResult.score}</span>
                <span className="cr-score-unit">pts</span>
              </div>
              <div className="cr-risk-badge">{checkResult.riskType}</div>
              <p className="cr-risk-desc" />
              <div className="cr-divider" />
              <button className="cr-continue-btn" onClick={() => goTo(3)}>
                Continue to Loan Selection&nbsp;<i className="fas fa-arrow-right" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ STEP 3 — Select Amount (legacy apply-loan-3.html) ══ */}
      {step === 3 && (
        <div className="content">
          <div className="left-section">
            <div className="left-title">Apply for loan</div>
            <div className="left-subtitle">
              Configure your loan amount, repayment period, and review the terms before proceeding.
            </div>
            <div className="steps-guide">
              {[
                { n: 1, t: 'Enter Loan Amount', s: 'Between R100 - R10,000' },
                { n: 2, t: 'Choose Repayment Period', s: '1-6 months (online cap)' },
                { n: 3, t: 'Review & Sign', s: 'Confirm loan terms and authorize' },
                { n: 4, t: 'Admin Schedules Date', s: 'Repayment date is set after review' },
              ].map(g => (
                <div className="guide-step" key={g.n}>
                  <div className="guide-number">{g.n}</div>
                  <div className="guide-text">
                    <strong>{g.t}</strong>
                    <span>{g.s}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="privacy-note">
              <i className="fas fa-shield-alt" />
              <span>All loan calculations are based on a 5% monthly interest rate.<br />Review your terms carefully before signing.</span>
            </div>
          </div>
          <div className="right-section">
            <button className="next-btn" onClick={() => setShowConfigModal(true)}>
              <span>Configure Loan Amount</span>
              <i className="fas fa-arrow-right" />
            </button>
          </div>
        </div>
      )}

      {/* Loan configuration modal (legacy loan-config.html markup) */}
      {showConfigModal && (
        <div className="module-overlay">
          <div className="module-content loan-modal-content">
            <div className="loan-selection-card">
              <div className="card-header">
                <h2><i className="fas fa-money-bill-wave" /> Loan Amount Selection</h2>
                <p>Configure your loan terms and review the details</p>
              </div>

              <div className="loan-config-section">
                <div className="config-group">
                  <label className="config-label"><i className="fas fa-hand-holding-usd" /> Loan Amount</label>
                  <div className="input-with-prefix" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-primary)' }}>R</span>
                    <input
                      type="number" step={1} value={amount}
                      onChange={e => setAmount(Math.min(MAX_ONLINE_AMOUNT, Math.max(100, Number(e.target.value) || 100)))}
                      style={{ flex: 1, padding: '1rem', border: '2px solid #333', borderRadius: 8, fontSize: '1.5rem', fontWeight: 600, textAlign: 'center', background: '#0f0f0f', color: '#fff' }}
                    />
                  </div>
                  <div className="slider-labels" style={{ marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: '#999' }}>Min: R100</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 600 }}>Max: R{MAX_ONLINE_AMOUNT.toLocaleString()}</span>
                  </div>
                </div>

                <div className="config-group">
                  <label className="config-label"><i className="fas fa-calendar-alt" /> Loan Period (Months)</label>
                  <div className="amount-display">
                    <span>{period}</span>
                    <span style={{ fontSize: '1.5rem', color: '#999', marginLeft: '0.5rem' }}>month{period > 1 ? 's' : ''}</span>
                  </div>
                  <input
                    type="range" min={1} max={MAX_ONLINE_TERM} step={1} value={period}
                    onChange={e => setPeriod(Number(e.target.value))}
                    className="loan-slider"
                  />
                  <div className="slider-labels">
                    <span>1 month</span>
                    <span>{MAX_ONLINE_TERM} months</span>
                  </div>
                </div>
              </div>

              <div className="loan-summary">
                <h3><i className="fas fa-file-invoice-dollar" /> Loan Summary</h3>
                {data?.isFirstLoanOfYear && (
                  <div className="fee-notice" style={{ background: 'rgb(var(--color-primary-rgb) / 0.1)', border: '1px solid rgb(var(--color-primary-rgb) / 0.3)', padding: '1rem', borderRadius: 8, marginBottom: '1.5rem', color: 'var(--color-primary)' }}>
                    <i className="fas fa-info-circle" /> First loan of the year — initiation fee reduced to 5%
                  </div>
                )}
                <div className="summary-grid">
                  <div className="summary-item">
                    <span className="summary-label">Loan Amount</span>
                    <span className="summary-value">{fmt(amount)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Interest Rate (Monthly)</span>
                    <span className="summary-value">5.0%</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Loan Period</span>
                    <span className="summary-value">{period} Month{period > 1 ? 's' : ''}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Interest</span>
                    <span className="summary-value">{fmt(summary.totalInterest)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Service Fee (R60/month)</span>
                    <span className="summary-value">{fmt(summary.totalServiceFees)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Initiation Fee ({(summary.initiationRate * 100).toFixed(0)}%)</span>
                    <span className="summary-value">{fmt(summary.totalInitiationFees)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Credit Life (0.45%/mo)</span>
                    <span className="summary-value">{fmt(summary.totalCreditLife)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">VAT (15% on fees)</span>
                    <span className="summary-value">{fmt(summary.vatAmount)}</span>
                  </div>
                  <div className="summary-item highlight">
                    <span className="summary-label">Monthly Repayment</span>
                    <span className="summary-value">{fmt(summary.monthlyPayment)}</span>
                  </div>
                  <div className="summary-item highlight">
                    <span className="summary-label">Total Repayment</span>
                    <span className="summary-value">{fmt(summary.totalRepayment)}</span>
                  </div>
                </div>
              </div>

              <div className="config-group">
                <label className="config-label"><i className="fas fa-calendar-day" /> First Repayment Date</label>
                <input
                  type="date" value={startDate}
                  min={new Date(Date.now() + 86400000).toISOString().substring(0, 10)}
                  onChange={e => setStartDate(e.target.value)}
                  style={{ width: '100%', padding: '0.85rem 1rem', border: '2px solid #333', borderRadius: 8, fontSize: '1rem', marginTop: '0.5rem' }}
                />
                <small className="helper-text"><i className="fas fa-info-circle" /> The final date is confirmed by our team after review</small>
              </div>

              <div className="signature-section">
                <h3><i className="fas fa-signature" /> Digital Signature</h3>
                <p className="signature-disclaimer">
                  By signing below, I acknowledge that I have read and understood the loan terms and conditions.
                  I agree to repay the loan amount plus interest according to the schedule provided.
                </p>
                <SignaturePad onChange={setSignature} />
                <small className="helper-text"><i className="fas fa-info-circle" /> Draw your signature in the box above</small>

                <div className="terms-checkbox">
                  <label className="checkbox-container">
                    <input type="checkbox" checked={termsOk} onChange={e => setTermsOk(e.target.checked)} />
                    <span className="checkmark" />
                    <span className="checkbox-label">
                      I agree to the <a href="#" className="link">Terms and Conditions</a> and <a href="#" className="link">Privacy Policy</a>
                    </span>
                  </label>
                </div>
              </div>

              <div className="action-buttons">
                <button className="btn-secondary" onClick={() => setShowConfigModal(false)}>
                  <i className="fas fa-arrow-left" /> Back
                </button>
                <button
                  className="btn-primary"
                  onClick={() => {
                    if (!startDate) { setNotice({ ok: false, text: 'Please select a first repayment date.' }); return; }
                    if (!signature) { setNotice({ ok: false, text: 'Please provide your digital signature to continue.' }); return; }
                    if (!termsOk) { setNotice({ ok: false, text: 'Please agree to the Terms and Conditions.' }); return; }
                    setShowConfigModal(false);
                    goTo(4);
                  }}
                >
                  Continue to Confirmation <i className="fas fa-arrow-right" />
                </button>
              </div>
            </div>
          </div>
          <button className="close-btn" onClick={() => setShowConfigModal(false)}><i className="fas fa-times" /></button>
        </div>
      )}

      {/* ══ STEP 4 — Confirmation (legacy confirmation.html) ══ */}
      {step === 4 && (
        <div className="content">
          <div className="left-section">
            <div className="left-title">Confirm &amp; Submit</div>
            <div className="left-subtitle">
              Review your loan offer and provide banking details to complete your application.
            </div>
            <div className="steps-guide">
              {[
                { n: 1, t: 'Review Loan Terms', s: 'Check amount, term, and repayment schedule' },
                { n: 2, t: 'Banking Details', s: 'Account for payout and repayments' },
                { n: 3, t: 'Authorize & Submit', s: 'Consent to debit order agreement' },
              ].map(g => (
                <div className="guide-step" key={g.n}>
                  <div className="guide-number">{g.n}</div>
                  <div className="guide-text">
                    <strong>{g.t}</strong>
                    <span>{g.s}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="privacy-note">
              <i className="fas fa-shield-alt" />
              <span>Your banking details are encrypted and secure.<br />We use bank-level security for all financial information.</span>
            </div>
          </div>
          <div className="right-section">
            <button className="next-btn" onClick={() => setShowBankingModal(true)}>
              <span>Review &amp; Submit Application</span>
              <i className="fas fa-arrow-right" />
            </button>
          </div>
        </div>
      )}

      {/* Banking form modal (legacy banking-form.html markup) */}
      {showBankingModal && (
        <div className="module-overlay">
          <div className="module-content banking-modal-content">
            <div className="banking-form-module">
              <div className="module-header">
                <h2><i className="fas fa-file-contract" /> Loan Application Summary</h2>
                <p className="module-subtitle">Review your loan terms and provide banking details</p>
              </div>

              <div className="module-body">
                <div className="form-section loan-summary-section">
                  <h3><i className="fas fa-circle-info" /> Your Loan Offer</h3>
                  <div className="summary-grid">
                    <div className="summary-item">
                      <span className="summary-label">Loan Amount</span>
                      <strong className="summary-value">{fmt(amount)}</strong>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Loan Term</span>
                      <strong className="summary-value">{period} month{period > 1 ? 's' : ''}</strong>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Monthly Payment</span>
                      <strong className="summary-value">{fmt(summary.monthlyPayment)}</strong>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Total Repayment</span>
                      <strong className="summary-value">{fmt(summary.totalRepayment)}</strong>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Repayment Date</span>
                      <strong className="summary-value">{startDate || 'Set by admin after review'}</strong>
                    </div>
                    {existingScore != null && (
                      <div className="summary-item">
                        <span className="summary-label">Bureau Score</span>
                        <strong className="summary-value">{existingScore}</strong>
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-divider"><span>Banking Information</span></div>

                <form onSubmit={e => e.preventDefault()}>
                  <div className="form-section">
                    <h3><i className="fas fa-university" /> Select Bank Account</h3>
                    <p className="section-hint">Choose a saved account or enter new details below</p>
                    <div className="saved-accounts-row">
                      <select
                        className="saved-select" style={{ width: '100%' }}
                        value={bankChoice === 'saved' ? (savedAccountId ?? '') : 'new'}
                        onChange={e => {
                          if (e.target.value === 'new') { setBankChoice('new'); setSavedAccountId(null); }
                          else { setBankChoice('saved'); setSavedAccountId(Number(e.target.value)); }
                        }}
                      >
                        <option value="">-- Select an account or add new --</option>
                        {(data?.bankAccounts ?? []).map(a => (
                          <option key={a.id} value={a.id}>{a.bank_name} (•••• {String(a.account_number).slice(-4)})</option>
                        ))}
                        <option value="new">+ Add new bank account</option>
                      </select>
                    </div>
                  </div>

                  {bankChoice === 'new' && (
                    <>
                      <div className="form-divider"><span>Bank Account Details</span></div>
                      <div className="form-section">
                        <div className="form-row">
                          <label className="form-field">
                            <span>Bank name</span>
                            <select
                              value={newBank.bankName}
                              onChange={e => setNewBank(b => ({ ...b, bankName: e.target.value, branchCode: BRANCH_CODES[e.target.value] ?? '' }))}
                            >
                              <option value="">Select your bank</option>
                              {Object.keys(BRANCH_CODES).map(b => <option key={b} value={b}>{b === 'FNB' ? 'First National Bank (FNB)' : b}</option>)}
                            </select>
                          </label>
                        </div>
                        <div className="form-row">
                          <label className="form-field">
                            <span>Account holder name</span>
                            <input type="text" placeholder="Full name as per bank" value={newBank.holder} onChange={e => setNewBank(b => ({ ...b, holder: e.target.value }))} />
                          </label>
                        </div>
                        <div className="form-row">
                          <label className="form-field">
                            <span>Account number</span>
                            <input type="text" inputMode="numeric" maxLength={20} placeholder="e.g. 62123456789" value={newBank.accountNumber} onChange={e => setNewBank(b => ({ ...b, accountNumber: e.target.value }))} />
                          </label>
                          <label className="form-field">
                            <span>Branch code</span>
                            <input type="text" inputMode="numeric" maxLength={8} placeholder="e.g. 250655" value={newBank.branchCode} onChange={e => setNewBank(b => ({ ...b, branchCode: e.target.value }))} />
                          </label>
                        </div>
                        <div className="form-row">
                          <label className="form-field">
                            <span>Account type</span>
                            <select value={newBank.accountType} onChange={e => setNewBank(b => ({ ...b, accountType: e.target.value }))}>
                              <option value="">Select type</option>
                              <option value="cheque">Cheque / Current</option>
                              <option value="savings">Savings</option>
                              <option value="transmission">Transmission</option>
                            </select>
                          </label>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="form-section consent-section">
                    <h3><i className="fas fa-shield-check" /> Authorization</h3>
                    <label className="checkbox-field">
                      <input type="checkbox" checked={finalConsent} onChange={e => setFinalConsent(e.target.checked)} />
                      <span>I confirm that the banking details provided are accurate and belong to me. I authorize the lender to deposit
                        the loan amount into this account and collect repayments via debit order.</span>
                    </label>
                  </div>

                  {notice && (
                    <div className="submission-status" style={{ color: notice.ok ? '#059669' : '#ef4444' }}>{notice.text}</div>
                  )}

                  <div className="module-actions">
                    <button type="button" className="btn-secondary" onClick={() => setShowBankingModal(false)}>
                      <i className="fas fa-arrow-left" /> <span>Cancel</span>
                    </button>
                    <button
                      type="button" className="btn-primary"
                      disabled={submitting || !finalConsent || (bankChoice === 'saved' && !savedAccountId)}
                      onClick={submitApplication}
                    >
                      <span>{submitting ? 'Submitting…' : 'Submit application'}</span>
                      <i className="fas fa-arrow-right" />
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <button className="close-btn" onClick={() => setShowBankingModal(false)}><i className="fas fa-times" /></button>
        </div>
      )}
    </div>
  );
}
