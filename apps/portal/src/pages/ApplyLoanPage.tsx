import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { apiFetch } from '../api/apiClient';

const SHADOW_SOFT = '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)';
const RADIUS = 24;

// NCA-compliant rates (matches legacy loan-config.js)
const INTEREST_RATE_MONTHLY     = 0.05;   // 5% per month
const INITIATION_FEE_RATE       = 0.15;   // 15% one-time (standard)
const INITIATION_FEE_RATE_FIRST = 0.05;   // 5% for first loan of the calendar year
const CREDIT_LIFE_RATE          = 0.0045; // 0.45%/month CPI
const SERVICE_FEE_MONTHLY       = 60;     // R60/month
const VAT_RATE                  = 0.15;
const MAX_ONLINE_TERM           = 6;      // online cap regardless of history
const MAX_ONLINE_AMOUNT         = 10_000;

const LOAN_PURPOSES = [
  'Personal / Family Expenses', 'Medical', 'Education / School Fees', 'Funeral Costs',
  'Home Improvements', 'Vehicle Repairs', 'Business / Working Capital', 'Debt Consolidation', 'Other',
];

const BRANCH_CODES: Record<string, string> = {
  'FNB': '250655', 'Standard Bank': '051001', 'ABSA': '632005', 'Nedbank': '198765',
  'Capitec': '470010', 'Investec': '580105', 'TymeBank': '678910', 'Discovery Bank': '679000', 'African Bank': '430000',
};

const fmt = (v: number) => `R ${(Number(v) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

// ── loan summary calc (verbatim from legacy) ─────────────────────────────────

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

// ── signature pad ─────────────────────────────────────────────────────────────

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
    <div>
      <canvas
        ref={canvasRef}
        width={400} height={140}
        style={{ width: '100%', maxWidth: 400, height: 140, border: '2px dashed #d1d5db', borderRadius: 12, background: '#fff', touchAction: 'none', cursor: 'crosshair' }}
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
        onClick={() => {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');
          if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
          hasInk.current = false;
          onChange(null);
        }}
        style={{ marginTop: 8, background: 'transparent', border: 'none', color: '#8E8E93', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        <i className="fas fa-eraser" style={{ marginRight: 6 }} />Clear signature
      </button>
    </div>
  );
}

// ── step indicator ────────────────────────────────────────────────────────────

const STEPS = ['Documents', 'Credit Check', 'Select Amount', 'Confirmation'];

function StepBar({ current, maxReached, onGo }: { current: number; maxReached: number; onGo: (s: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n === current ? 'active' : n <= maxReached ? 'done' : 'todo';
        return (
          <button
            key={label}
            onClick={() => n <= maxReached && onGo(n)}
            disabled={n > maxReached}
            style={{
              flex: '1 1 140px', display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px', borderRadius: 14, border: 'none',
              cursor: n <= maxReached ? 'pointer' : 'default', fontFamily: 'inherit',
              background: state === 'active' ? 'var(--color-primary)' : '#fff',
              boxShadow: SHADOW_SOFT,
              opacity: state === 'todo' ? 0.55 : 1,
            }}
          >
            <span style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800, flexShrink: 0,
              background: state === 'active' ? 'rgba(255,255,255,0.2)' : state === 'done' ? '#d1fae5' : '#f3f4f6',
              color: state === 'active' ? '#fff' : state === 'done' ? '#059669' : '#9ca3af',
            }}>
              {state === 'done' ? <i className="fas fa-check" /> : `0${n}`}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: state === 'active' ? '#fff' : '#1C1C1E' }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── main wizard ───────────────────────────────────────────────────────────────

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

  // loan config state
  const [amount, setAmount]         = useState(1000);
  const [period, setPeriod]         = useState(1);
  const [purpose, setPurpose]       = useState('');
  const [startDate, setStartDate]   = useState('');
  const [signature, setSignature]   = useState<string | null>(null);
  const [termsOk, setTermsOk]       = useState(false);

  // confirmation state
  const [bankChoice, setBankChoice] = useState<'saved' | 'new'>('saved');
  const [savedAccountId, setSavedAccountId] = useState<number | null>(null);
  const [newBank, setNewBank]       = useState({ bankName: '', holder: '', accountNumber: '', branchCode: '', accountType: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingDocType = useRef<'till_slip' | 'bank_statement' | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['apply-loan'], queryFn: fetchApplyData, staleTime: 30_000, retry: 1 });

  const kycComplete = !!(data?.profile?.identity_number && data?.profile?.first_name && data?.profile?.last_name && data?.profile?.date_of_birth && data?.profile?.address && data?.profile?.postal_code);
  const docsReady = kycComplete && !!data?.hasPayslip && !!data?.hasBankStatement;
  const summary = loanSummary(amount, period, data?.isFirstLoanOfYear ?? false, startDate || null);

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
      setNotice({ ok: true, text: 'Document uploaded successfully!' });
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
      // persist credit-check consent
      await supabase.from('declarations').upsert([{
        user_id: data.userId,
        credit_check_consent_accepted: true,
        updated_at: new Date().toISOString(),
      }], { onConflict: 'user_id' });

      // get or create application
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

      // rules engine evaluation (non-blocking)
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

      // resolve bank account
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
          amount, term_months: period, purpose: purpose || 'Personal Loan', status: 'STARTED',
          bank_account_id: bankAccountId, repayment_start_date: firstPaymentIso,
          ...offerFields, offer_details: offerDetails,
        }).eq('id', applicationId).eq('user_id', data.userId).select().single();
        if (updErr) throw new Error('Failed to update loan application. Please try again.');
        app = updated;
      } else {
        const { data: created, error: createErr } = await supabase.from('loan_applications').insert([{
          user_id: data.userId, amount, term_months: period, purpose: purpose || 'Personal Loan',
          status: 'STARTED', bank_account_id: bankAccountId, repayment_start_date: firstPaymentIso,
          ...offerFields, offer_details: offerDetails,
        }]).select().single();
        if (createErr) throw createErr;
        app = created;
      }

      // loan_reference + agreement_number
      const clientRef = `C${data.userId.substring(0, 8).toUpperCase()}`;
      const loanRef = `${clientRef}-L${String(app.id).padStart(6, '0')}`;
      await supabase.from('loan_applications').update({ loan_reference: loanRef, agreement_number: `AGR${app.id}` }).eq('id', app.id).eq('user_id', data.userId);

      // route to head office (non-blocking)
      try {
        await apiFetch(`/api/applications/${app.id}/route-to-head-office`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      } catch { /* non-blocking */ }

      setSubmittedId(loanRef);
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : 'Submission failed' });
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}><i className="fas fa-circle-notch fa-spin" style={{ fontSize: 28, color: 'var(--color-primary)' }} /></div>;
  }

  const existingScore = checkResult?.score ?? data?.existingCheck?.credit_score ?? null;

  // ── success screen ──
  if (submittedId) {
    return (
      <div style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center' }}>
        <div style={{ background: '#fff', borderRadius: RADIUS, padding: 40, boxShadow: SHADOW_SOFT }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <i className="fas fa-check" style={{ fontSize: 28, color: '#059669' }} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1C1C1E', margin: '0 0 8px' }}>Application Submitted!</h2>
          <p style={{ fontSize: 14, color: '#8E8E93', margin: '0 0 6px' }}>Your reference number is</p>
          <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-primary)', margin: '0 0 20px', letterSpacing: '0.02em' }}>{submittedId}</p>
          <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.7, margin: '0 0 28px' }}>
            Your application is being reviewed. You'll be notified once it's approved,
            and your repayment date will be confirmed by our team.
          </p>
          <button
            onClick={() => navigate('/user-portal/dashboard')}
            style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '14px 32px', borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(91,33,182,0.35)' }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 920 }}>

      <div>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-1px', color: '#1C1C1E', margin: 0 }}>Apply for Loan</h1>
        <p style={{ fontSize: 14, color: '#8E8E93', margin: '4px 0 0', fontWeight: 500 }}>
          Complete the four steps below to submit your application
        </p>
      </div>

      <StepBar current={step} maxReached={maxReached} onGo={goTo} />

      {notice && (
        <div style={{
          background: notice.ok ? '#f0fdf4' : '#fff1f2',
          border: `1px solid ${notice.ok ? '#bbf7d0' : '#fecdd3'}`,
          borderRadius: 14, padding: '12px 16px', fontSize: 13, fontWeight: 600,
          color: notice.ok ? '#166534' : '#be123c',
        }}>
          {notice.text}
        </div>
      )}

      {/* ══ STEP 1 — Documents ══ */}
      {step === 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          <div style={{ background: '#fff', borderRadius: RADIUS, padding: 28, boxShadow: SHADOW_SOFT }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: '0 0 14px' }}>Consent &amp; Privacy</h3>
            <button
              onClick={() => setConsent(c => !c)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10, padding: '12px 20px',
                background: consent ? '#111827' : '#fff', color: consent ? '#f9fafb' : '#1C1C1E',
                border: `1px solid ${consent ? '#111827' : '#d1d5db'}`, borderRadius: 10,
                fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16,
              }}
            >
              <i className={`fas ${consent ? 'fa-check-square' : 'fa-square'}`} style={{ fontSize: 16 }} />
              I Consent to Privacy Policy
            </button>
            <p style={{ fontSize: 13.5, lineHeight: 1.7, color: '#666', margin: '0 0 8px' }}>
              I consent to the collection and processing of my documents and personal information for
              loan application and verification purposes, in accordance with POPIA and the Privacy Policy.
            </p>
            <span style={{ color: '#888', fontSize: 12.5 }}>You must give consent before proceeding.</span>
          </div>

          <div style={{ background: '#fff', borderRadius: RADIUS, padding: 28, boxShadow: SHADOW_SOFT }}>
            {!consent ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
                <i className="fas fa-lock" style={{ fontSize: 32, marginBottom: 12, display: 'block' }} />
                <p style={{ fontSize: 14, margin: 0 }}>Give consent to unlock the document checklist</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  {
                    key: 'kyc', icon: 'fa-user-check', label: 'KYC Verification', sub: 'Confirm your personal details',
                    done: kycComplete,
                    action: () => navigate('/user-portal/profile'),
                    actionLabel: kycComplete ? 'Complete' : 'Start',
                  },
                  {
                    key: 'till_slip', icon: 'fa-receipt', label: 'Payslip', sub: 'Latest payslip/salary slip',
                    done: !!data?.hasPayslip,
                    action: () => { pendingDocType.current = 'till_slip'; fileInputRef.current?.click(); },
                    actionLabel: data?.hasPayslip ? 'Uploaded' : uploading === 'till_slip' ? 'Uploading…' : 'Upload',
                  },
                  {
                    key: 'bank_statement', icon: 'fa-landmark', label: 'Bank Statement', sub: 'Latest 3-month statement',
                    done: !!data?.hasBankStatement,
                    action: () => { pendingDocType.current = 'bank_statement'; fileInputRef.current?.click(); },
                    actionLabel: data?.hasBankStatement ? 'Uploaded' : uploading === 'bank_statement' ? 'Uploading…' : 'Upload',
                  },
                ].map(doc => (
                  <button
                    key={doc.key}
                    onClick={doc.action}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, border: 'none', background: '#FAFAFA', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: doc.done ? '#d1fae5' : 'rgba(91,33,182,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className={`fas ${doc.done ? 'fa-check' : doc.icon}`} style={{ color: doc.done ? '#059669' : 'var(--color-primary)', fontSize: 16 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#1C1C1E' }}>{doc.label}</span>
                      <small style={{ fontSize: 12, color: '#8E8E93' }}>{doc.sub}</small>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: doc.done ? '#d1fae5' : 'rgba(91,33,182,0.10)', color: doc.done ? '#059669' : 'var(--color-primary)', flexShrink: 0 }}>
                      {doc.actionLabel}
                    </span>
                  </button>
                ))}

                <button
                  onClick={() => goTo(2)}
                  disabled={!docsReady}
                  style={{
                    marginTop: 8, padding: 14, borderRadius: 14, border: 'none',
                    background: docsReady ? 'var(--color-primary)' : '#e5e7eb',
                    color: docsReady ? '#fff' : '#9ca3af',
                    fontSize: 15, fontWeight: 800, cursor: docsReady ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                    boxShadow: docsReady ? '0 4px 16px rgba(91,33,182,0.35)' : 'none',
                  }}
                >
                  Next <i className="fas fa-arrow-right" style={{ marginLeft: 8 }} />
                </button>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(f); e.target.value = ''; }}
          />
        </div>
      )}

      {/* ══ STEP 2 — Credit Check ══ */}
      {step === 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          <div style={{ background: '#fff', borderRadius: RADIUS, padding: 28, boxShadow: SHADOW_SOFT }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: '0 0 8px' }}>Credit Check Required</h3>
            <p style={{ fontSize: 13.5, color: '#666', lineHeight: 1.6, margin: '0 0 20px' }}>
              We need to verify your credit information to proceed with your loan application.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { n: 1, t: 'Provide ID Number', s: '13-digit South African ID' },
                { n: 2, t: 'Personal Information', s: 'Name, date of birth, and gender' },
                { n: 3, t: 'Address Details', s: 'Residential address and postal code' },
                { n: 4, t: 'Verify & Submit', s: 'Review information and consent' },
              ].map(g => (
                <div key={g.n} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(91,33,182,0.08)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{g.n}</div>
                  <div>
                    <strong style={{ fontSize: 13.5, color: '#1C1C1E', display: 'block' }}>{g.t}</strong>
                    <span style={{ fontSize: 12, color: '#8E8E93' }}>{g.s}</span>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: '#8E8E93', marginTop: 20, lineHeight: 1.6 }}>
              <i className="fas fa-shield-alt" style={{ marginRight: 8, color: 'var(--color-primary)' }} />
              Your information is protected with bank-level encryption. We use Experian, South Africa's leading credit bureau.
            </p>
          </div>

          <div style={{ background: '#fff', borderRadius: RADIUS, padding: 28, boxShadow: SHADOW_SOFT, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
            {checkResult ? (
              <>
                <div style={{ width: 140, height: 140, borderRadius: '50%', border: '6px solid #10b981', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 36, fontWeight: 900, color: '#1C1C1E', lineHeight: 1 }}>{checkResult.score}</span>
                  <span style={{ fontSize: 11, color: '#8E8E93', fontWeight: 700 }}>pts</span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ display: 'inline-block', background: '#d1fae5', color: '#059669', fontSize: 12, fontWeight: 800, padding: '5px 16px', borderRadius: 20, textTransform: 'capitalize' }}>{checkResult.riskType}</span>
                  <p style={{ fontSize: 13, color: '#8E8E93', margin: '10px 0 0' }}>Credit check complete</p>
                </div>
                <button
                  onClick={() => goTo(3)}
                  style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '14px 32px', borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(91,33,182,0.35)' }}
                >
                  Continue to Loan Selection <i className="fas fa-arrow-right" style={{ marginLeft: 6 }} />
                </button>
              </>
            ) : data?.existingCheck ? (
              <>
                <div style={{ width: 140, height: 140, borderRadius: '50%', border: '6px solid #10b981', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 36, fontWeight: 900, color: '#1C1C1E', lineHeight: 1 }}>{data.existingCheck.credit_score}</span>
                  <span style={{ fontSize: 11, color: '#8E8E93', fontWeight: 700 }}>pts</span>
                </div>
                <p style={{ fontSize: 13, color: '#8E8E93', margin: 0, textAlign: 'center' }}>
                  Credit check already completed
                  {data.existingCheck.risk_category ? <> · <span style={{ textTransform: 'capitalize' }}>{data.existingCheck.risk_category}</span></> : null}
                </p>
                <button
                  onClick={() => goTo(3)}
                  style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '14px 32px', borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(91,33,182,0.35)' }}
                >
                  Next <i className="fas fa-arrow-right" style={{ marginLeft: 6 }} />
                </button>
              </>
            ) : (
              <button
                onClick={runCreditCheck}
                disabled={checking}
                style={{
                  width: 170, height: 170, borderRadius: '50%', border: 'none',
                  background: 'var(--color-primary)', color: '#fff',
                  fontSize: 17, fontWeight: 800, lineHeight: 1.4, cursor: checking ? 'default' : 'pointer',
                  fontFamily: 'inherit', boxShadow: '0 8px 32px rgba(91,33,182,0.40)',
                }}
              >
                {checking
                  ? <i className="fas fa-sync-alt fa-spin" style={{ fontSize: 28 }} />
                  : <>Start<br />Credit<br />Check</>}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══ STEP 3 — Select Amount ══ */}
      {step === 3 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          <div style={{ background: '#fff', borderRadius: RADIUS, padding: 28, boxShadow: SHADOW_SOFT, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Configure Your Loan</h3>

            <div>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                <span>Loan Amount</span>
                <strong style={{ color: 'var(--color-primary)' }}>{fmt(amount)}</strong>
              </label>
              <input type="range" min={100} max={MAX_ONLINE_AMOUNT} step={100} value={amount} onChange={e => setAmount(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--color-primary)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8E8E93', marginTop: 4 }}>
                <span>R 100</span><span>R {MAX_ONLINE_AMOUNT.toLocaleString()}</span>
              </div>
            </div>

            <div>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                <span>Repayment Period</span>
                <strong style={{ color: 'var(--color-primary)' }}>{period} month{period > 1 ? 's' : ''}</strong>
              </label>
              <input type="range" min={1} max={MAX_ONLINE_TERM} step={1} value={period} onChange={e => setPeriod(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--color-primary)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8E8E93', marginTop: 4 }}>
                <span>1 month</span><span>{MAX_ONLINE_TERM} months</span>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Purpose of Loan *</label>
              <select value={purpose} onChange={e => setPurpose(e.target.value)} style={{ width: '100%', border: '2px solid #e5e7eb', borderRadius: 12, padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', background: '#fff', outline: 'none' }}>
                <option value="">— Select purpose —</option>
                {LOAN_PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>First Repayment Date *</label>
              <input
                type="date" value={startDate}
                min={new Date(Date.now() + 86400000).toISOString().substring(0, 10)}
                onChange={e => setStartDate(e.target.value)}
                style={{ width: '100%', border: '2px solid #e5e7eb', borderRadius: 12, padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', background: '#fff', outline: 'none', boxSizing: 'border-box' }}
              />
              <small style={{ fontSize: 11, color: '#8E8E93', marginTop: 4, display: 'block' }}>The final date is confirmed by our team after review</small>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Digital Signature *</label>
              <SignaturePad onChange={setSignature} />
            </div>

            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', fontSize: 12.5, color: '#4b5563', lineHeight: 1.6 }}>
              <input type="checkbox" checked={termsOk} onChange={e => setTermsOk(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--color-primary)', flexShrink: 0, marginTop: 2 }} />
              <span>I agree to the <strong>Terms and Conditions</strong> and confirm the loan details above are correct.</span>
            </label>
          </div>

          <div style={{ background: '#fff', borderRadius: RADIUS, padding: 28, boxShadow: SHADOW_SOFT, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Loan Summary</h3>
            {data?.isFirstLoanOfYear && (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '10px 14px', fontSize: 12.5, fontWeight: 600, color: '#166534' }}>
                🎉 First loan of the year — initiation fee reduced to 5%
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Principal', value: fmt(amount) },
                { label: 'Interest (5%/month)', value: fmt(summary.totalInterest) },
                { label: `Initiation fee (${(summary.initiationRate * 100).toFixed(0)}%)`, value: fmt(summary.totalInitiationFees) },
                { label: 'Service fees (R60/month)', value: fmt(summary.totalServiceFees) },
                { label: 'Credit life insurance', value: fmt(summary.totalCreditLife) },
                { label: 'VAT (15% on fees)', value: fmt(summary.vatAmount) },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                  <span style={{ color: '#6b7280' }}>{r.label}</span>
                  <span style={{ fontWeight: 600, color: '#1C1C1E' }}>{r.value}</span>
                </div>
              ))}
            </div>
            <div style={{ background: '#FAFAFA', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E' }}>Monthly Repayment</span>
                <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-primary)' }}>{fmt(summary.monthlyPayment)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E' }}>Total Repayment</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#1C1C1E' }}>{fmt(summary.totalRepayment)}</span>
              </div>
            </div>
            <button
              onClick={() => {
                if (!purpose) { setNotice({ ok: false, text: 'Please select a purpose for your loan.' }); return; }
                if (!startDate) { setNotice({ ok: false, text: 'Please select a first repayment date.' }); return; }
                if (!signature) { setNotice({ ok: false, text: 'Please provide your digital signature to continue.' }); return; }
                if (!termsOk) { setNotice({ ok: false, text: 'Please agree to the Terms and Conditions.' }); return; }
                goTo(4);
              }}
              style={{ marginTop: 'auto', padding: 14, borderRadius: 14, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(91,33,182,0.35)' }}
            >
              Continue to Confirmation <i className="fas fa-arrow-right" style={{ marginLeft: 6 }} />
            </button>
          </div>
        </div>
      )}

      {/* ══ STEP 4 — Confirmation ══ */}
      {step === 4 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {/* Summary recap */}
          <div style={{ background: '#fff', borderRadius: RADIUS, padding: 28, boxShadow: SHADOW_SOFT }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: '0 0 16px' }}>Review Your Application</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: '#FAFAFA', borderRadius: 14, padding: 16 }}>
              {[
                { label: 'Amount', value: fmt(amount) },
                { label: 'Period', value: `${period} month${period > 1 ? 's' : ''}` },
                { label: 'Purpose', value: purpose || 'Personal Loan' },
                { label: 'First Payment', value: startDate || '—' },
                { label: 'Monthly Repayment', value: fmt(summary.monthlyPayment) },
                { label: 'Total Repayment', value: fmt(summary.totalRepayment) },
                ...(existingScore != null ? [{ label: 'Bureau Score', value: String(existingScore) }] : []),
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: '#8E8E93' }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E', marginTop: 2 }}>{value}</div>
                </div>
              ))}
            </div>
            {signature && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: '#8E8E93', marginBottom: 6 }}>Signature</div>
                <img src={signature} alt="Signature" style={{ height: 60, border: '1px solid #f1f5f9', borderRadius: 8, background: '#fff' }} />
              </div>
            )}
          </div>

          {/* Banking details */}
          <div style={{ background: '#fff', borderRadius: RADIUS, padding: 28, boxShadow: SHADOW_SOFT, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Banking Details</h3>
            <p style={{ fontSize: 12.5, color: '#8E8E93', margin: 0 }}>Where should we pay out your loan?</p>

            {(data?.bankAccounts.length ?? 0) > 0 && (
              <div style={{ display: 'flex', gap: 10 }}>
                {(['saved', 'new'] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => setBankChoice(c)}
                    style={{
                      flex: 1, padding: '10px 14px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      border: `2px solid ${bankChoice === c ? 'var(--color-primary)' : '#e5e7eb'}`,
                      background: bankChoice === c ? 'rgba(91,33,182,0.06)' : '#fff',
                      color: bankChoice === c ? 'var(--color-primary)' : '#6b7280',
                    }}
                  >
                    {c === 'saved' ? 'Saved Account' : 'New Account'}
                  </button>
                ))}
              </div>
            )}

            {bankChoice === 'saved' && (data?.bankAccounts.length ?? 0) > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data!.bankAccounts.map(a => (
                  <label key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, cursor: 'pointer',
                    border: `2px solid ${savedAccountId === a.id ? 'var(--color-primary)' : '#f1f5f9'}`,
                    background: savedAccountId === a.id ? 'rgba(91,33,182,0.04)' : '#FAFAFA',
                  }}>
                    <input type="radio" name="bank" checked={savedAccountId === a.id} onChange={() => setSavedAccountId(a.id)} style={{ accentColor: 'var(--color-primary)' }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E' }}>{a.bank_name}</div>
                      <div style={{ fontSize: 12, color: '#8E8E93', textTransform: 'capitalize' }}>{a.account_type || 'Account'} •••• {String(a.account_number).slice(-4)}</div>
                    </div>
                    {a.is_primary && <span style={{ marginLeft: 'auto', background: 'rgba(91,33,182,0.10)', color: 'var(--color-primary)', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>Primary</span>}
                  </label>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <select
                  value={newBank.bankName}
                  onChange={e => setNewBank(b => ({ ...b, bankName: e.target.value, branchCode: BRANCH_CODES[e.target.value] ?? '' }))}
                  style={{ width: '100%', border: '2px solid #e5e7eb', borderRadius: 12, padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', background: '#fff', outline: 'none' }}
                >
                  <option value="">Select your bank</option>
                  {Object.keys(BRANCH_CODES).map(b => <option key={b} value={b}>{b === 'FNB' ? 'First National Bank (FNB)' : b}</option>)}
                </select>
                <input type="text" placeholder="Account holder name" value={newBank.holder} onChange={e => setNewBank(b => ({ ...b, holder: e.target.value }))}
                  style={{ width: '100%', border: '2px solid #e5e7eb', borderRadius: 12, padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                <input type="text" placeholder="Account number" value={newBank.accountNumber} onChange={e => setNewBank(b => ({ ...b, accountNumber: e.target.value }))}
                  style={{ width: '100%', border: '2px solid #e5e7eb', borderRadius: 12, padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                <input type="text" placeholder="Branch code" value={newBank.branchCode} readOnly={!!BRANCH_CODES[newBank.bankName]}
                  onChange={e => setNewBank(b => ({ ...b, branchCode: e.target.value }))}
                  style={{ width: '100%', border: '2px solid #e5e7eb', borderRadius: 12, padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: BRANCH_CODES[newBank.bankName] ? '#f3f4f6' : '#fff' }} />
                <select value={newBank.accountType} onChange={e => setNewBank(b => ({ ...b, accountType: e.target.value }))}
                  style={{ width: '100%', border: '2px solid #e5e7eb', borderRadius: 12, padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', background: '#fff', outline: 'none' }}>
                  <option value="">Select account type</option>
                  <option value="cheque">Cheque / Current</option>
                  <option value="savings">Savings</option>
                  <option value="transmission">Transmission</option>
                </select>
              </div>
            )}

            <button
              onClick={submitApplication}
              disabled={submitting || (bankChoice === 'saved' && (data?.bankAccounts.length ?? 0) > 0 && !savedAccountId)}
              style={{
                marginTop: 'auto', padding: 15, borderRadius: 14, border: 'none',
                background: 'var(--color-primary)', color: '#fff',
                fontSize: 15, fontWeight: 800, cursor: submitting ? 'default' : 'pointer',
                opacity: submitting ? 0.7 : 1, fontFamily: 'inherit',
                boxShadow: '0 4px 16px rgba(91,33,182,0.35)',
              }}
            >
              {submitting
                ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }} />Submitting…</>
                : <><i className="fas fa-paper-plane" style={{ marginRight: 8 }} />Submit Application</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
