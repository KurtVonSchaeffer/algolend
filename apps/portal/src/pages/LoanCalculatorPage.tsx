import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/apiClient';

// ── NCA-compliant fee structure (matches loan-config.js exactly) ──────────────
const INTEREST_RATE_MONTHLY = 0.05;   // 5% per month
const INITIATION_FEE_RATE   = 0.15;   // 15% of principal — one-time
const SERVICE_FEE_MONTHLY   = 60;     // R60/month
const CPI_RATE_MONTHLY      = 0.0045; // 0.45%/month Credit Protection Insurance
const VAT_RATE              = 0.15;   // 15% VAT on initiation + service fees

const DEFAULT_MAX_AMOUNT = 10_000;
const DEFAULT_MAX_TERM   = 24;

const SHADOW_SOFT = '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)';
const RADIUS = 24;

const fmt = (n: number) => `R ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

interface EligibilityBand {
  label: string;
  color?: string;
  max_loan_amount: number;
  interest_rate_pa: number;
  max_term_months: number;
}

interface Eligibility {
  eligible: boolean;
  band?: EligibilityBand;
  first_loan_restriction?: string;
}

async function fetchEligibility(): Promise<Eligibility | null> {
  try {
    const res = await apiFetch('/api/my-eligibility');
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function calcLoan(principal: number, termMonths: number) {
  const totalInterest     = principal * INTEREST_RATE_MONTHLY * termMonths;
  const totalInitiation   = principal * INITIATION_FEE_RATE;
  const totalServiceFees  = SERVICE_FEE_MONTHLY * termMonths;
  const totalCPI          = principal * CPI_RATE_MONTHLY * termMonths;
  const vatAmount         = (totalInitiation + totalServiceFees) * VAT_RATE;
  const totalCostOfCredit = totalInterest + totalInitiation + totalServiceFees + totalCPI + vatAmount;
  const totalRepayment    = principal + totalCostOfCredit;
  const monthlyPayment    = termMonths > 0 ? totalRepayment / termMonths : 0;
  return { totalInterest, totalCostOfCredit, totalRepayment, monthlyPayment };
}

// ── slider + number input pair ────────────────────────────────────────────────

function AmountControl({ label, value, onChange, min, max, step, prefix, rangeLabels }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  rangeLabels: [string, string];
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid #e0e0e0', borderRadius: 10, background: '#fff', overflow: 'hidden', marginBottom: 10 }}>
        {prefix && (
          <span style={{ padding: '0 0 0 14px', fontSize: 15, fontWeight: 600, color: '#8E8E93' }}>{prefix}</span>
        )}
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={e => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
          style={{ flex: 1, border: 'none', outline: 'none', padding: '12px 14px', fontSize: 15, fontWeight: 600, color: '#1C1C1E', fontFamily: 'inherit', background: 'transparent' }}
        />
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--color-primary)' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8E8E93', marginTop: 4 }}>
        <span>{rangeLabels[0]}</span>
        <span>{rangeLabels[1]}</span>
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export function LoanCalculatorPage() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState(5000);
  const [term, setTerm]     = useState(1);

  const { data: eligibility } = useQuery({
    queryKey: ['my-eligibility'],
    queryFn: fetchEligibility,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const band = eligibility?.eligible ? eligibility.band : undefined;
  const maxAmount = band?.max_loan_amount ?? DEFAULT_MAX_AMOUNT;
  const maxTerm   = band?.max_term_months ?? DEFAULT_MAX_TERM;

  const clampedAmount = Math.min(amount, maxAmount);
  const clampedTerm   = Math.min(term, maxTerm);

  const result = useMemo(() => calcLoan(clampedAmount, clampedTerm), [clampedAmount, clampedTerm]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1000 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-1px', color: '#1C1C1E', margin: 0 }}>Loan Calculator</h1>
        <p style={{ fontSize: 14, color: '#8E8E93', margin: '4px 0 0', fontWeight: 500 }}>
          Estimate your monthly payments and total repayment amount
        </p>
      </div>

      {/* Disclaimer */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 14, padding: '12px 16px', fontSize: 13, color: '#1e40af', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <i className="fas fa-info-circle" style={{ marginTop: 2, flexShrink: 0 }} />
        <span>This calculator is for illustrative purposes only. Actual loan terms and rates may vary based on your credit profile and application assessment.</span>
      </div>

      {/* Eligibility banner */}
      {band && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 14, padding: '12px 16px', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: band.color || '#10b981', flexShrink: 0 }} />
          <strong style={{ color: '#0F172A' }}>{band.label} Band</strong>
          <span style={{ color: '#8E8E93', fontSize: 12 }}>
            Max R{Number(band.max_loan_amount).toLocaleString()} · {band.interest_rate_pa}% p.a. · {band.max_term_months} months
          </span>
          {eligibility?.first_loan_restriction && (
            <span style={{ background: '#fff8ed', color: '#d97706', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>
              ⭐ {eligibility.first_loan_restriction}
            </span>
          )}
        </div>
      )}

      {/* Calculator card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>

        {/* Inputs */}
        <div style={{ background: '#fff', borderRadius: RADIUS, padding: 28, boxShadow: SHADOW_SOFT }}>
          <AmountControl
            label="Loan Amount"
            value={clampedAmount}
            onChange={setAmount}
            min={100}
            max={maxAmount}
            step={100}
            prefix="R"
            rangeLabels={['R 100', `R ${maxAmount.toLocaleString()}`]}
          />
          <AmountControl
            label="Loan Term (Months)"
            value={clampedTerm}
            onChange={setTerm}
            min={1}
            max={maxTerm}
            step={1}
            rangeLabels={['1 month', `${maxTerm} months`]}
          />

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
              Interest Rate
            </label>
            <div style={{ padding: '12px 16px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, fontSize: 15, fontWeight: 600, color: '#1C1C1E' }}>
              5% per month
            </div>
          </div>
        </div>

        {/* Results */}
        <div style={{ background: '#fff', borderRadius: RADIUS, padding: 28, boxShadow: SHADOW_SOFT, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: 0, letterSpacing: '-0.3px' }}>Loan Summary</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
            {[
              { label: 'Monthly Payment', value: fmt(result.monthlyPayment), primary: false },
              { label: 'Total Interest',  value: fmt(result.totalInterest),  primary: false },
              { label: 'Total Repayment', value: fmt(result.totalRepayment), primary: true },
            ].map(({ label, value, primary }) => (
              <div key={label} style={{ background: '#FAFAFA', borderRadius: 14, padding: '14px 16px' }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8E8E93', margin: '0 0 4px' }}>{label}</p>
                <p style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.5px', color: primary ? 'var(--color-primary)' : '#1C1C1E', margin: 0 }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Breakdown */}
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E', margin: '0 0 12px' }}>Payment Breakdown</h4>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: 'var(--color-primary)', flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: 12, color: '#8E8E93', display: 'block' }}>Principal</span>
                  <strong style={{ fontSize: 14, color: '#1C1C1E' }}>{fmt(clampedAmount)}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: '#f59e0b', flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: 12, color: '#8E8E93', display: 'block' }}>Interest + Fees</span>
                  <strong style={{ fontSize: 14, color: '#1C1C1E' }}>{fmt(result.totalCostOfCredit)}</strong>
                </div>
              </div>
            </div>
            <p style={{ color: '#999', fontSize: 12, marginTop: 14, fontWeight: 500 }}>
              <i className="fas fa-info-circle" /> Interest: 5%/month · Service fee: R60/month · Initiation: 15% (once-off) · CPI: 0.45%/month · VAT: 15% on fees
            </p>
          </div>

          <button
            onClick={() => navigate('/user-portal/apply')}
            style={{
              marginTop: 'auto',
              background: 'var(--color-primary)', color: '#fff', border: 'none',
              padding: '14px 24px', borderRadius: 12, fontSize: 15, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 16px rgba(91,33,182,0.40), 0 8px 32px rgba(91,33,182,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <i className="fas fa-arrow-right" />
            Apply for this Loan
          </button>
        </div>
      </div>
    </div>
  );
}
