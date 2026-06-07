// Loan Calculator JavaScript

// Load borrower's eligibility band and apply limits to the calculator
async function applyEligibilityLimits() {
    try {
        // Check cached eligibility first
        const cached = sessionStorage.getItem('creditEligibility');
        let eligibility = cached ? JSON.parse(cached) : null;

        // If not cached, fetch from API
        if (!eligibility) {
            const { supabase } = await import('/Services/supabaseClient.js');
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const res = await fetch('/api/my-eligibility', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (res.ok) eligibility = await res.json();
        }

        if (!eligibility?.eligible || !eligibility?.band) return;

        const band = eligibility.band;
        const maxLoan = band.max_loan_amount;
        const maxTerm = band.max_term_months;
        const rate    = band.interest_rate_pa;

        // Update sliders and inputs
        const amountSlider = document.getElementById('loanAmountSlider');
        const amountInput  = document.getElementById('loanAmount');
        const termSlider   = document.getElementById('loanTermSlider');
        const termInput    = document.getElementById('loanTerm');
        const rateSlider   = document.getElementById('interestRateSlider');
        const rateInput    = document.getElementById('interestRate');

        if (amountSlider && maxLoan) {
            amountSlider.max = maxLoan;
            // Cap current value if it exceeds max
            if (parseFloat(amountSlider.value) > maxLoan) {
                amountSlider.value = maxLoan;
                if (amountInput) amountInput.value = maxLoan;
            }
        }
        if (termSlider && maxTerm) {
            termSlider.max = maxTerm;
            if (parseInt(termSlider.value) > maxTerm) {
                termSlider.value = maxTerm;
                if (termInput) termInput.value = maxTerm;
            }
        }
        if (rateSlider && rate) {
            rateSlider.value = rate;
            if (rateInput) rateInput.value = rate;
        }

        // Show eligibility banner
        const banner = document.getElementById('calcEligibilityBanner');
        if (banner) {
            banner.style.display = '';
            banner.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                    <span style="width:10px;height:10px;border-radius:50%;background:${band.color || '#10b981'};flex-shrink:0;display:inline-block;"></span>
                    <strong style="color:#0F172A;">${band.label} Band</strong>
                    <span style="color:#8E8E93;font-size:12px;">Max R${Number(maxLoan).toLocaleString()} · ${rate}% p.a. · ${maxTerm} months</span>
                    ${eligibility.first_loan_restriction ? `<span style="background:#fff8ed;color:#d97706;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;">⭐ ${eligibility.first_loan_restriction}</span>` : ''}
                </div>`;
        }

        calculateLoan(rate / 100);
    } catch (e) {
        console.warn('[calculator] eligibility limits:', e.message);
    }
}

// Initialize calculator on page load
function initCalculator() {
  const FIXED_ANNUAL_RATE = 0.05;
  // Sync sliders with inputs
  const loanAmountInput = document.getElementById('loanAmount');
  const loanAmountSlider = document.getElementById('loanAmountSlider');
  const loanTermInput = document.getElementById('loanTerm');
  const loanTermSlider = document.getElementById('loanTermSlider');
  const interestRateInput = document.getElementById('interestRate');
  const interestRateSlider = document.getElementById('interestRateSlider');

  if (loanAmountInput && loanAmountSlider) {
    loanAmountSlider.addEventListener('input', (e) => {
      loanAmountInput.value = e.target.value;
      calculateLoan();
    });

    loanAmountInput.addEventListener('input', (e) => {
      loanAmountSlider.value = e.target.value;
      calculateLoan();
    });
  }

  if (loanTermInput && loanTermSlider) {
    loanTermSlider.addEventListener('input', (e) => {
      loanTermInput.value = e.target.value;
      calculateLoan();
    });

    loanTermInput.addEventListener('input', (e) => {
      loanTermSlider.value = e.target.value;
      calculateLoan();
    });
  }

  if (interestRateInput && interestRateSlider) {
    interestRateSlider.addEventListener('input', (e) => {
      interestRateInput.value = e.target.value;
      calculateLoan();
    });

    interestRateInput.addEventListener('input', (e) => {
      interestRateSlider.value = e.target.value;
      calculateLoan();
    });
  }

  // Calculate on initial load
  calculateLoan(FIXED_ANNUAL_RATE);
}

// Calculate loan
window.calculateLoan = function(fixedAnnualRate = 0.05) {
  const principal  = parseFloat(document.getElementById('loanAmount').value) || 0;
  const termMonths = parseInt(document.getElementById('loanTerm').value)     || 0;

  if (principal <= 0 || termMonths <= 0) return;

  // ── NCA-Compliant Fee Structure ────────────────────────────────
  // These match loan-config.js exactly
  const INTEREST_RATE_MONTHLY = 0.05;   // 5% per month (not per year)
  const INITIATION_FEE_RATE   = 0.15;   // 15% of principal — one-time
  const SERVICE_FEE_MONTHLY   = 60;     // R60/month
  const CPI_RATE_MONTHLY      = 0.0045; // 0.45%/month Credit Protection Insurance
  const VAT_RATE              = 0.15;   // 15% VAT on initiation + service fees

  // Calculations
  const totalInterest      = principal * INTEREST_RATE_MONTHLY * termMonths;
  const totalInitiation    = principal * INITIATION_FEE_RATE;          // once-off
  const totalServiceFees   = SERVICE_FEE_MONTHLY * termMonths;
  const totalCPI           = principal * CPI_RATE_MONTHLY * termMonths;
  const vatAmount          = (totalInitiation + totalServiceFees) * VAT_RATE;
  const totalCostOfCredit  = totalInterest + totalInitiation + totalServiceFees + totalCPI + vatAmount;
  const totalRepayment     = principal + totalCostOfCredit;
  const monthlyPayment     = totalRepayment / termMonths;

  // Display
  document.getElementById('monthlyPayment').textContent  = formatCurrency(monthlyPayment);
  document.getElementById('totalInterest').textContent   = formatCurrency(totalInterest);
  document.getElementById('totalRepayment').textContent  = formatCurrency(totalRepayment);
  document.getElementById('principalAmount').textContent = formatCurrency(principal);
  document.getElementById('interestAmount').textContent  = formatCurrency(totalCostOfCredit);

  // Breakdown info text
  const breakdownInfo = document.getElementById('breakdownInfo');
  if (breakdownInfo) {
    breakdownInfo.innerHTML = `
      <i class="fas fa-info-circle"></i>
      Interest: 5%/month · Service fee: R60/month · Initiation: 15% (once-off) ·
      CPI: 0.45%/month · VAT: 15% on fees`;
  }

  // Interest rate input shows monthly rate
  const rateInput = document.getElementById('interestRate');
  if (rateInput) rateInput.value = '5% per month';

  // Store for apply button
  window.loanCalculation = {
    principal, termMonths,
    interestRateMonthly: INTEREST_RATE_MONTHLY * 100,
    monthlyPayment, totalRepayment,
    totalInterest, totalInitiation,
    totalServiceFees, totalCPI, vatAmount,
    totalCostOfCredit
  };
};

// Apply for loan
window.applyForLoan = function() {
  if (!window.loanCalculation) {
    if (typeof showToast === 'function') {
      showToast('Calculate First', 'Please calculate a loan first', 'warning', 3000);
    } else {
      alert('Please calculate a loan first');
    }
    return;
  }

  // Navigate to loan application
  if (typeof loadPage === 'function') {
    loadPage('apply-loan');
  } else {
    window.location.href = '/user-portal/?page=apply-loan';
  }
};

// Format currency
function formatCurrency(value) {
  const number = Number(value) || 0;
  return `R ${number.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { initCalculator(); applyEligibilityLimits(); });
} else {
  initCalculator();
  applyEligibilityLimits();
}

// Re-initialize on SPA page load
window.addEventListener('pageLoaded', (event) => {
  if (event?.detail?.pageName === 'loan-calculator') {
    setTimeout(() => { initCalculator(); applyEligibilityLimits(); }, 100);
  }
});

document.addEventListener('pageLoaded', (event) => {
  if (event?.detail?.pageName === 'loan-calculator') {
    setTimeout(() => { initCalculator(); applyEligibilityLimits(); }, 100);
  }
});
