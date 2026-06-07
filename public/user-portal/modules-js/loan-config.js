// Module loading functions
window.loadLoanModule = function() {
  const moduleContainer = document.getElementById('module-container');
  const moduleContent = document.getElementById('module-content');
  
  fetch('modules/loan-config.html')
    .then(response => response.text())
    .then(html => {
      moduleContent.innerHTML = html;
      moduleContainer.classList.remove('hidden');
      
      // Initialize after loading
      setTimeout(async () => {
        await checkLoanHistory();
        await fetchAffordabilityRatio();
        initializeLoanSlider();
        initializePeriodSlider();
        initializeDatePicker();
        initializeSignatureCanvas();
        calculateAndUpdateSummary();
      }, 100);
    })
    .catch(error => console.error('Error loading module:', error));
};

window.closeModule = function() {
  const moduleContainer = document.getElementById('module-container');
  moduleContainer.classList.add('hidden');
};

// Loan Configuration
let loanConfig = {
  amount: 5000,
  period: 1,
  startDate: null,
  interestRate: 0.05, // 5%/month NCA
  signature: null,
  maxAllowedPeriod: 1,
  completedOneMonthLoans: 0,
  isFirstLoanOfYear: true,
  maxLoanAmount: 10000, // Will be calculated dynamically based on affordability
  affordabilityRatio: null, // Max monthly payment from financial profile
  loanCountAllTime: 0 // Total loan count to determine 5% or regular rate
};

function parseDateInputValue(value) {
  if (!value) return null;
  const parts = value.split('-').map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }
  const [year, month, day] = parts;
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function formatDateForInput(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  const working = new Date(date);
  working.setUTCHours(0, 0, 0, 0);
  return working.toISOString().split('T')[0];
}

function toIsoDateMidnight(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized.toISOString();
}

function getConfiguredStartDate() {
  const value = loanConfig.startDate;
  if (!value) return null;
  if (value instanceof Date) {
    return value;
  }
  return parseDateInputValue(value);
}

// Check user's loan history to determine max allowed period and interest rate
async function checkLoanHistory() {
  try {
    const { supabase } = await import('/Services/supabaseClient.js');
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) return;

    // Count completed/active loan applications for this user
    const { data, error } = await supabase
      .from('loan_applications')
      .select('id, created_at')
      .eq('user_id', session.user.id)
      .in('status', ['DISBURSED', 'OFFER_ACCEPTED', 'READY_TO_DISBURSE', 'ACTIVE', 'CONTRACT_SIGN', 'DEBICHECK_AUTH']);

    if (allLoansError) {
      console.error('Error checking loan history:', allLoansError);
      return;
    }

    const count = data?.length || 0;
    loanConfig.completedOneMonthLoans = count;
    loanConfig.interestRate = 0.05; // 5%/month NCA (fixed regardless of history)

    // First loan of the current calendar year → waive initiation fee
    const currentYear = new Date().getFullYear();
    loanConfig.isFirstLoanOfYear = !data?.some(
      (l) => new Date(l.created_at).getFullYear() === currentYear
    );

    // Period limits: <3 loans → 1 month max; 3+ → 6 months max
    // Term rules:
    // 0 loans       → 1 month (first-time)
    // 1–3 loans     → 1 month
    // more than 3   → max 6 months
    // Online cap    → never exceed 6 months regardless
    if (count > 3) {
      loanConfig.maxAllowedPeriod = 6;
    } else {
      loanConfig.maxAllowedPeriod = 6; // 1-2 loans: 6 months max (online limit)
    }

    // Update slider max
    const slider = document.getElementById('periodSlider');
    if (slider) {
      slider.max = loanConfig.maxAllowedPeriod;
      // Reset to 1 if current value exceeds allowed
      if (loanConfig.period > loanConfig.maxAllowedPeriod) {
        loanConfig.period = 1;
        slider.value = 1;
        document.getElementById('periodAmount').textContent = '1';
        const periodPlural = document.getElementById('periodPlural');
        if (periodPlural) periodPlural.textContent = '';
      }
    }

    console.log(`User has ${count} completed loans. isFirstLoanOfYear=${loanConfig.isFirstLoanOfYear}. Max period: ${loanConfig.maxAllowedPeriod} months`);
  } catch (error) {
    console.error('Error checking loan history:', error);
  }
}

// Fetch user's financial profile to get affordability ratio
async function fetchAffordabilityRatio() {
  try {
    const { supabase } = await import('/Services/supabaseClient.js');
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) return;

    // Get financial profile
    const { data: profile, error } = await supabase
      .from('financial_profiles')
      .select('affordability_ratio, monthly_income')
      .eq('user_id', session.user.id)
      .single();

    if (error) {
      console.error('Error fetching affordability ratio:', error);
      return;
    }

    if (profile && profile.affordability_ratio) {
      loanConfig.affordabilityRatio = parseFloat(profile.affordability_ratio);
      console.log(`💰 Max monthly payment from profile: R${loanConfig.affordabilityRatio}`);
      console.log(`💰 Raw affordability_ratio value: ${profile.affordability_ratio}`);
      console.log(`💰 Monthly income from profile: R${profile.monthly_income || 'N/A'}`);
      
      // Calculate initial max loan amount for current period
      calculateMaxLoanAmount();
    }
  } catch (error) {
    console.error('Error fetching affordability:', error);
  }
}

// Calculate maximum loan amount based on affordability and selected period
function calculateMaxLoanAmount() {
  if (!loanConfig.affordabilityRatio) {
    // Fallback to R10,000 if no affordability data
    loanConfig.maxLoanAmount = 10000;
    return;
  }

  const maxMonthlyPayment = loanConfig.affordabilityRatio; // Max they can afford per month
  const annualRate = loanConfig.interestRate; // 20% or 18%
  const monthlyRate = annualRate / 12; // Convert to monthly
  const n = loanConfig.period; // Number of months

  // Amortized loan formula: L = P × [(1 - (1 + r)^-n) / r]
  let maxLoan;
  if (monthlyRate > 0) {
    maxLoan = maxMonthlyPayment * ((1 - Math.pow(1 + monthlyRate, -n)) / monthlyRate);
  } else {
    maxLoan = maxMonthlyPayment * n; // If rate is 0
  }

  loanConfig.maxLoanAmount = Number(maxLoan.toFixed(2)); // Round to 2 decimals (matches backend)
  
  console.log(`📊 Max loan for ${n} month(s) @ ${(annualRate * 100).toFixed(0)}% APR: R${loanConfig.maxLoanAmount.toLocaleString()}`);
  console.log(`   Formula: R${maxMonthlyPayment} × [(1 - (1 + ${monthlyRate.toFixed(6)})^-${n}) / ${monthlyRate.toFixed(6)}]`);
  
  // Update max loan display in UI
  const maxLoanDisplay = document.getElementById('maxLoanDisplay');
  if (maxLoanDisplay) {
    maxLoanDisplay.textContent = `Max: R${loanConfig.maxLoanAmount.toLocaleString()}`;
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  checkLoanHistory().then(() => {
    initializeLoanSlider();
    initializePeriodSlider();
    initializeDatePicker();
    initializeSignatureCanvas();
    calculateAndUpdateSummary();
  });
});

// Loan Amount Input with validation
function initializeLoanSlider() {
  const input = document.getElementById('loanAmountInput');
  const errorDiv = document.getElementById('amountError');
  const errorText = document.getElementById('amountErrorText');

  if (!input) return;

  function validateAmount(amount) {
    errorDiv.classList.remove('show');
    
    if (amount < 100) {
      errorText.textContent = 'Amount must be at least R100';
      errorDiv.classList.add('show');
      return false;
    }
    if (amount > loanConfig.maxLoanAmount) {
      errorText.textContent = `Amount cannot exceed R${loanConfig.maxLoanAmount.toLocaleString()} (based on your affordability for ${loanConfig.period} month${loanConfig.period > 1 ? 's' : ''})`;
      errorDiv.classList.add('show');
      return false;
    }
    return true;
  }

  input.addEventListener('input', (e) => {
    let amount = parseInt(e.target.value) || 0;
    validateAmount(amount);
    
    // Update config regardless (allow invalid for display purposes)
    loanConfig.amount = amount;
    calculateAndUpdateSummary();
  });

  input.addEventListener('blur', (e) => {
    let amount = parseInt(e.target.value) || 100;
    
    // Show validation message
    if (!validateAmount(amount)) {
      // Auto-correct to nearest valid value after 2 seconds
      setTimeout(() => {
        if (amount < 100) {
          amount = 100;
        } else if (amount > loanConfig.maxLoanAmount) {
          amount = loanConfig.maxLoanAmount;
        }
        e.target.value = amount;
        loanConfig.amount = amount;
        errorDiv.classList.remove('show');
        calculateAndUpdateSummary();
      }, 2000);
    } else {
      loanConfig.amount = amount;
      calculateAndUpdateSummary();
    }
  });
}

// Period Slider with lock logic
function initializePeriodSlider() {
  const slider = document.getElementById('periodSlider');
  const periodDisplay = document.getElementById('periodAmount');
  const periodPlural = document.getElementById('periodPlural');
  const lockMessage = document.getElementById('periodLockMessage');

  if (!slider || !periodDisplay) return;

  // Show lock message if period is restricted
  if (loanConfig.maxAllowedPeriod < 24 && lockMessage) {
    lockMessage.style.display = 'block';
  }

  slider.addEventListener('input', (e) => {
    let months = parseInt(e.target.value);
    
    // Enforce max allowed period based on loan history
    if (months > loanConfig.maxAllowedPeriod) {
      months = loanConfig.maxAllowedPeriod;
      slider.value = months;
      if (lockMessage) lockMessage.style.display = 'block';
    } else {
      if (lockMessage && loanConfig.maxAllowedPeriod >= 24) {
        lockMessage.style.display = 'none';
      }
    }
    
    loanConfig.period = months;
    periodDisplay.textContent = months;
    if (periodPlural) {
      periodPlural.textContent = months > 1 ? 's' : '';
    }
    
    // Recalculate max loan amount based on new period
    calculateMaxLoanAmount();
    
    // Validate current amount against new max
    const currentAmount = loanConfig.amount;
    if (currentAmount > loanConfig.maxLoanAmount) {
      // Auto-adjust to max if current exceeds new limit
      loanConfig.amount = loanConfig.maxLoanAmount;
      const amountInput = document.getElementById('loanAmount');
      if (amountInput) {
        amountInput.value = loanConfig.maxLoanAmount;
      }
    }
    
    calculateAndUpdateSummary();
  });

  // Set initial max attribute
  slider.max = loanConfig.maxAllowedPeriod;
}

// Date Picker Initialization
function initializeDatePicker() {
  const dateInput = document.getElementById('startDate');
  if (!dateInput) return;
  const icon = document.querySelector('.date-input-icon');

  // Set minimum date to today
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  dateInput.min = formatDateForInput(today);

  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  lastDayOfMonth.setHours(12, 0, 0, 0);
  dateInput.max = formatDateForInput(lastDayOfMonth);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const defaultValue = tomorrow.getMonth() !== today.getMonth()
    ? formatDateForInput(lastDayOfMonth)
    : formatDateForInput(tomorrow);

  dateInput.value = defaultValue;
  loanConfig.startDate = parseDateInputValue(defaultValue);

  dateInput.addEventListener('change', (e) => {
    loanConfig.startDate = parseDateInputValue(e.target.value);
  });

  if (icon && !icon.dataset.pickerBound) {
    icon.addEventListener('click', () => {
      if (dateInput.showPicker) {
        dateInput.showPicker();
      } else {
        dateInput.focus();
        // Fallback: trigger click to open native picker on some browsers
        dateInput.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      }
    });
    icon.dataset.pickerBound = 'true';
  }
}

function getLoanSummary() {
  const amount = Math.max(0, Number(loanConfig.amount) || 0);
  const period = Math.max(1, Number(loanConfig.period) || 1);

  // NCA-compliant rates
  const INTEREST_RATE_MONTHLY    = 0.05;   // 5% per month
  const INITIATION_FEE_RATE      = 0.15;   // 15% one-time (standard)
  const INITIATION_FEE_RATE_FIRST = 0.05;  // 5% for first loan of the calendar year
  const CREDIT_LIFE_RATE         = 0.0045; // 0.45% per month CPI
  const SERVICE_FEE_MONTHLY      = 60;     // R60/month
  const VAT_RATE                 = 0.15;

  // First loan of the year gets reduced initiation (5% not 15%)
  const initiationRate = loanConfig.isFirstLoanOfYear ? INITIATION_FEE_RATE_FIRST : INITIATION_FEE_RATE;

  // Service fee: prorate first month based on days to repayment date
  let totalServiceFees = 0;
  const configuredStartDate = getConfiguredStartDate();
  if (configuredStartDate) {
    const start = new Date(); start.setHours(12, 0, 0, 0);
    const paymentDate = new Date(configuredStartDate); paymentDate.setHours(12, 0, 0, 0);
    const daysUntilPayment = Math.max(1, Math.ceil((paymentDate - start) / (1000 * 60 * 60 * 24)));
    const proratedDays = Math.min(daysUntilPayment, 30);
    const firstMonthFee = (SERVICE_FEE_MONTHLY / 30) * proratedDays;
    totalServiceFees = firstMonthFee + (period > 1 ? SERVICE_FEE_MONTHLY * (period - 1) : 0);
  } else {
    totalServiceFees = SERVICE_FEE_MONTHLY * period;
  }

  const totalInterest        = amount * INTEREST_RATE_MONTHLY * period;
  const totalInitiationFees  = amount * initiationRate;
  const totalCreditLife      = amount * CREDIT_LIFE_RATE * period;
  const monthlyCreditLife    = amount * CREDIT_LIFE_RATE;
  const vatAmount            = (totalInitiationFees + totalServiceFees) * VAT_RATE;
  const totalCostOfCredit    = totalInterest + totalInitiationFees + totalServiceFees + totalCreditLife + vatAmount;
  const totalRepayment       = amount + totalCostOfCredit;
  const monthlyPayment       = totalRepayment / period;

  return {
    totalInterest,
    totalInitiationFees,
    totalServiceFees,
    totalCreditLife,
    monthlyCreditLife,
    vatAmount,
    totalCostOfCredit,
    totalRepayment,
    monthlyPayment,
    isFirstLoanOfYear: loanConfig.isFirstLoanOfYear,
    initiationRateUsed: initiationRate,
    // legacy aliases used in display and confirmation.js
    totalMonthlyFees: totalServiceFees,
    initiationFee: totalInitiationFees,
    monthlyFee: SERVICE_FEE_MONTHLY,
    monthlyInterest: totalInterest / period,
    creditLifeMonthly: monthlyCreditLife,
  };
}

// Calculate Interest and Update Summary
function calculateAndUpdateSummary() {
  const configuredStartDate = getConfiguredStartDate();
  const summary = getLoanSummary();

  document.getElementById('summaryAmount').textContent = `R ${formatCurrency(loanConfig.amount)}`;
  document.getElementById('summaryRate').textContent = `5% p/m`;
  document.getElementById('summaryPeriod').textContent = `${loanConfig.period} Month${loanConfig.period > 1 ? 's' : ''}`;
  document.getElementById('summaryInterest').textContent = `R ${formatCurrency(summary.totalInterest)}`;
  
  // Update admin fee display with proration notice
  const summaryFeeElement = document.getElementById('summaryFee');
  if (summaryFeeElement) {
    summaryFeeElement.textContent = `R ${formatCurrency(summary.totalMonthlyFees)}`;
    
    // Add proration notice for all loans with start date
    if (configuredStartDate) {
      const start = new Date();
      start.setHours(12, 0, 0, 0);
      const paymentDate = new Date(configuredStartDate);
      paymentDate.setHours(12, 0, 0, 0);
      const daysUntilPayment = Math.max(1, Math.ceil((paymentDate - start) / (1000 * 60 * 60 * 24)));
      const proratedDays = Math.min(daysUntilPayment, 30);
      
      // Update the label to show prorated calculation
      const labelElement = summaryFeeElement.previousElementSibling;
      if (labelElement && labelElement.classList.contains('summary-label')) {
        if (loanConfig.period === 1) {
          labelElement.innerHTML = `
            Total Admin Fees (${proratedDays} days @ R2/day)
            <i class="fas fa-info-circle" style="color: var(--color-primary); font-size: 0.8rem; margin-left: 4px;" title="Prorated based on ${proratedDays} days until first payment"></i>
          `;
        } else {
          labelElement.innerHTML = `
            Total Admin Fees (1st: ${proratedDays} days, then R60/month)
            <i class="fas fa-info-circle" style="color: var(--color-primary); font-size: 0.8rem; margin-left: 4px;" title="First payment prorated for ${proratedDays} days, then R60 per month"></i>
          `;
        }
      }
    } else {
      // Reset to standard label when no start date
      const labelElement = summaryFeeElement.previousElementSibling;
      if (labelElement && labelElement.classList.contains('summary-label')) {
        labelElement.innerHTML = `
          Total Admin Fees (R60/month)
          <i class="fas fa-info-circle" style="color: var(--color-primary); font-size: 0.8rem; margin-left: 4px;" title="R60 per month"></i>
        `;
      }
    }
  }
  
  // Update initiation fee display
  // Initiation fee — show rate and first-loan-of-year discount notice
  const initiationFeeElement = document.getElementById('summaryInitiationFee');
  if (initiationFeeElement) {
    initiationFeeElement.textContent = `R ${formatCurrency(summary.totalInitiationFees)}`;
  }
  const initiationLabel = document.getElementById('summaryInitiationLabel');
  if (initiationLabel) {
    const rate = (summary.initiationRateUsed * 100).toFixed(0);
    initiationLabel.innerHTML = summary.isFirstLoanOfYear
      ? `Initiation Fee (${rate}% <span style="color:#10b981;font-weight:700;">— First Loan Discount</span>)`
      : `Initiation Fee (${rate}%)`;
  }

  // CPI (Credit Protection Insurance) — always visible
  const cpiElement = document.getElementById('summaryCPI');
  if (cpiElement) {
    cpiElement.textContent = `R ${formatCurrency(summary.totalCreditLife)}`;
  }
  const cpiMonthlyEl = document.getElementById('summaryCPIMonthly');
  if (cpiMonthlyEl) {
    cpiMonthlyEl.textContent = `R ${formatCurrency(summary.monthlyCreditLife)}/mo`;
  }

  document.getElementById('summaryMonthly').textContent = `R ${formatCurrency(summary.monthlyPayment)}`;
  document.getElementById('summaryTotal').textContent = `R ${formatCurrency(summary.totalRepayment)}`;

  return summary;
}

// Signature Canvas
let canvas, ctx, isDrawing = false;

function initializeSignatureCanvas() {
  canvas = document.getElementById('signatureCanvas');
  if (!canvas) return;

  ctx = canvas.getContext('2d');
  
  // Set canvas size
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Drawing settings: dark ink so it is visible on white canvas
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Mouse events
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);

  // Touch events for mobile
  canvas.addEventListener('touchstart', handleTouchStart);
  canvas.addEventListener('touchmove', handleTouchMove);
  canvas.addEventListener('touchend', stopDrawing);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  
  // Redraw if there's existing signature data
  if (loanConfig.signature) {
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0);
    img.src = loanConfig.signature;
  }
}

function startDrawing(e) {
  isDrawing = true;
  const rect = canvas.getBoundingClientRect();
  ctx.beginPath();
  ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
}

function draw(e) {
  if (!isDrawing) return;
  const rect = canvas.getBoundingClientRect();
  ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
  ctx.stroke();
}

function stopDrawing() {
  if (isDrawing) {
    isDrawing = false;
    // Save signature data
    loanConfig.signature = canvas.toDataURL();
  }
}

function handleTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  isDrawing = true;
  ctx.beginPath();
  ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
}

function handleTouchMove(e) {
  e.preventDefault();
  if (!isDrawing) return;
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
  ctx.stroke();
}

window.clearSignature = function() {
  if (!canvas || !ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  loanConfig.signature = null;
}

// Stage loan application for confirmation step
// Open NCA pre-agreement quote for the current loan configuration
window.previewLoanQuote = async function() {
    try {
        const applicationId = sessionStorage.getItem('currentApplicationId');
        if (!applicationId) {
            // No application yet — show an informational message
            if (typeof window.showToast === 'function') {
                window.showToast('Quote Preview', 'Complete step 2 (credit check) first to generate your personalised quote.', 'info');
            } else {
                alert('Please complete the credit check step first to generate your personalised quote.');
            }
            return;
        }
        window.open(`/api/contracts/${applicationId}/preview`, '_blank');
    } catch (e) {
        console.error('[previewLoanQuote]', e);
    }
};

window.prepareLoanApplication = function() {
  const submitBtn = document.getElementById('submitBtn');
  const termsCheckbox = document.getElementById('termsCheckbox');
  const configuredStartDate = getConfiguredStartDate();

  if (!loanConfig.signature) {
    if (typeof showToast === 'function') {
      showToast('Signature Required', 'Please provide your digital signature to continue.', 'warning', 3000);
    } else {
      alert('⚠️ Please provide your digital signature');
    }
    return;
  }

  if (!termsCheckbox?.checked) {
    if (typeof showToast === 'function') {
      showToast('Terms Required', 'Please agree to the Terms and Conditions to continue.', 'warning', 3000);
    } else {
      alert('⚠️ Please agree to the Terms and Conditions');
    }
    return;
  }

  if (!configuredStartDate) {
    if (typeof showToast === 'function') {
      showToast('Date Required', 'Please select a first repayment date to continue.', 'warning', 3000);
    } else {
      alert('⚠️ Please select a first repayment date');
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  }

  const summary = getLoanSummary();
  const firstPaymentDateIso = configuredStartDate ? toIsoDateMidnight(configuredStartDate) : null;
  const pendingLoanPayload = {
    amount: loanConfig.amount,
    period: loanConfig.period,
    startDate: firstPaymentDateIso,
    interestRate: loanConfig.interestRate,
    signature: loanConfig.signature,
    loanHistoryCount: loanConfig.completedOneMonthLoans,
    isFirstLoanOfYear: loanConfig.isFirstLoanOfYear,
    summary,
    offer_principal:             Number(loanConfig.amount) || 0,
    offer_interest_rate:         0.05,
    offer_total_interest:        Number(summary.totalInterest) || 0,
    offer_total_admin_fees:      Number(summary.totalServiceFees ?? summary.totalMonthlyFees) || 0,
    offer_total_initiation_fees: Number(summary.totalInitiationFees) || 0,
    offer_credit_life_monthly:   Number(summary.monthlyCreditLife) || 0,
    offer_vat_amount:            Number(summary.vatAmount) || 0,
    offer_total_cost_of_credit:  Number(summary.totalCostOfCredit) || 0,
    offer_monthly_repayment:     Number(summary.monthlyPayment) || 0,
    offer_total_repayment:       Number(summary.totalRepayment) || 0,
    stagedAt: new Date().toISOString()
  };

  try {
    sessionStorage.setItem('pendingLoanConfig', JSON.stringify(pendingLoanPayload));
    sessionStorage.removeItem('lastApplicationId');
  } catch (error) {
    console.error('❌ Unable to stage loan config for confirmation:', error);
    if (typeof showToast === 'function') {
      showToast('Storage Error', 'Unable to save your loan details. Please ensure your browser allows storage and try again.', 'error', 4000);
    } else {
      alert('Unable to save your loan details locally. Please ensure your browser allows storage and try again.');
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Continue to Confirmation <i class="fas fa-arrow-right"></i>';
    }
    return;
  }

  if (typeof showToast === 'function') {
    showToast('Loan Terms Saved', 'Add your banking details on the confirmation step to submit your application.', 'success', 4000);
  } else {
    alert('👍 Loan terms saved. Add your banking details on the confirmation step to submit.');
  }
  closeLoanModal();

  // Mark step 3 as completed
  const step3 = document.querySelector('.step.active');
  if (step3) {
    step3.classList.add('completed');
  }
  sessionStorage.setItem('loanConfigCompleted', 'true');

  if (typeof loadPage === 'function') {
    loadPage('confirmation');
  } else {
    goToStep(4);
  }
};

// Utility Functions
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatCurrency(num) {
  return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Make goToStep available globally
window.goToStep = function(step) {
  const pages = {
    1: 'apply-loan.html',
    2: 'apply-loan-2.html',
    3: 'apply-loan-3.html',
    4: 'confirmation.html'
  };
  
  if (typeof loadPage === 'function') {
    const pageNames = {
      1: 'apply-loan',
      2: 'apply-loan-2',
      3: 'apply-loan-3',
      4: 'confirmation'
    };
    loadPage(pageNames[step]);
  } else {
    window.location.href = pages[step];
  }
}

// Modal functions
window.openLoanModal = function() {
  document.getElementById('module-container')?.classList.remove('hidden');
}

window.closeLoanModal = function() {
  document.getElementById('module-container')?.classList.add('hidden');
}
