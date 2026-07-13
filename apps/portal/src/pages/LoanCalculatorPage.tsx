import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/apiClient';
import { usePageCSS } from '../hooks/usePageCSS';
import calcCssUrl from '../legacy-css/11-loan-calculator.css?url';

// ── NCA-compliant fee structure (matches legacy loan-calculator.js) ───────────
const INTEREST_RATE_MONTHLY = 0.05;   // 5% per month
const INITIATION_FEE_RATE   = 0.15;   // 15% of principal — one-time
const SERVICE_FEE_MONTHLY   = 60;     // R60/month
const CPI_RATE_MONTHLY      = 0.0045; // 0.45%/month Credit Protection Insurance
const VAT_RATE              = 0.15;   // 15% VAT on initiation + service fees

const DEFAULT_MAX_AMOUNT = 10_000;
const DEFAULT_MAX_TERM   = 24;

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

// ── page (legacy loan-calculator.html markup) ─────────────────────────────────

export function LoanCalculatorPage() {
  usePageCSS(calcCssUrl);
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
    <div className="page-container">
      <div className="content-wrapper">
        <div className="calculator-wrapper">
          <div className="calculator-container">
            <div className="calculator-header">
              <h1>Loan Calculator</h1>
              <p>Estimate your monthly payments and total repayment amount</p>
              <div className="calculator-disclaimer">
                <i className="fas fa-info-circle" />
                <span>This calculator is for illustrative purposes only. Actual loan terms and rates may vary based on your credit profile and application assessment.</span>
              </div>
            </div>

            {/* Eligibility Banner — shown when borrower has a credit band */}
            {band && (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 14, padding: '12px 16px', marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: band.color || '#10b981', flexShrink: 0, display: 'inline-block' }} />
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
              </div>
            )}

            <div className="calculator-card">
              <div className="calculator-inputs">
                <div className="input-group">
                  <label htmlFor="loanAmount">Loan Amount</label>
                  <div className="input-with-prefix">
                    <span className="prefix">R</span>
                    <input
                      type="number" id="loanAmount"
                      value={clampedAmount} min={100} max={maxAmount} step={100}
                      onChange={e => setAmount(Math.min(maxAmount, Math.max(100, Number(e.target.value) || 100)))}
                    />
                  </div>
                  <input
                    type="range" id="loanAmountSlider"
                    min={100} max={maxAmount} step={100} value={clampedAmount}
                    onChange={e => setAmount(Number(e.target.value))}
                  />
                  <div className="range-labels">
                    <span>R 100</span>
                    <span>R {maxAmount.toLocaleString()}</span>
                  </div>
                </div>

                <div className="input-group">
                  <label htmlFor="loanTerm">Loan Term (Months)</label>
                  <input
                    type="number" id="loanTerm"
                    value={clampedTerm} min={1} max={maxTerm} step={1}
                    onChange={e => setTerm(Math.min(maxTerm, Math.max(1, Number(e.target.value) || 1)))}
                  />
                  <input
                    type="range" id="loanTermSlider"
                    min={1} max={maxTerm} step={1} value={clampedTerm}
                    onChange={e => setTerm(Number(e.target.value))}
                  />
                  <div className="range-labels">
                    <span>1 month</span>
                    <span>{maxTerm} months</span>
                  </div>
                </div>

                <div className="input-group">
                  <label>Interest Rate (Monthly)</label>
                  <div style={{ width: '100%', padding: '0 16px', background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 8, color: '#1a1a1a', fontSize: '1rem', fontWeight: 600 }}>
                    5% per month
                  </div>
                </div>
              </div>

              <div className="calculator-results">
                <h3>Loan Summary</h3>
                <div className="result-grid">
                  <div className="result-card">
                    <div className="result-label">Monthly Payment</div>
                    <div className="result-value">{fmt(result.monthlyPayment)}</div>
                  </div>
                  <div className="result-card">
                    <div className="result-label">Total Interest</div>
                    <div className="result-value">{fmt(result.totalInterest)}</div>
                  </div>
                  <div className="result-card">
                    <div className="result-label">Total Repayment</div>
                    <div className="result-value primary">{fmt(result.totalRepayment)}</div>
                  </div>
                </div>

                <div className="breakdown-section">
                  <h4>Payment Breakdown</h4>
                  <div className="breakdown-legend">
                    <div className="legend-item">
                      <span className="legend-color principal" />
                      <div className="legend-text">
                        <span>Principal</span>
                        <strong>{fmt(clampedAmount)}</strong>
                      </div>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color interest" />
                      <div className="legend-text">
                        <span>Interest + Fees</span>
                        <strong>{fmt(result.totalCostOfCredit)}</strong>
                      </div>
                    </div>
                  </div>
                  <small style={{ color: '#999', fontSize: '0.85rem', marginTop: '1rem', display: 'block', fontWeight: 500 }}>
                    <i className="fas fa-info-circle" /> Interest: 5%/month · Service fee: R60/month · Initiation: 15% (once-off) · CPI: 0.45%/month · VAT: 15% on fees
                  </small>
                </div>

                <button className="btn-apply" onClick={() => navigate('/user-portal/apply')}>
                  <i className="fas fa-arrow-right" />
                  Apply for this Loan
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
