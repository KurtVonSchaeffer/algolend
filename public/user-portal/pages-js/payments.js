// Payments Dashboard JavaScript
import '/user-portal/Services/sessionGuard.js'; // Production auth guard

let activeLoans    = [];
let bankAccounts   = [];
let paymentHistory = [];
let selectedLoan   = null;
let bankingDetails = null; // company banking details for EFT

// Initialize dashboard
async function initPaymentsDashboard() {
  try {
    const { supabase } = await import('/Services/supabaseClient.js');
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = '/auth/login.html';
      return;
    }

    await Promise.all([
      loadActiveLoans(supabase, session.user.id),
      loadBankAccounts(supabase, session.user.id),
      loadPaymentHistory(supabase, session.user.id),
      loadBankingDetails()
    ]);

    await loadSureSystemsPaymentHistory(session);

    calculateMetrics();
    renderAll();
    bindEventListeners();
    
    // Initialize mobile collapsible sections after rendering
    if (window.innerWidth <= 768) {
      setTimeout(() => {
        initMobileCollapsibleSections();
      }, 100);
    }

  } catch (error) {
    console.error('Error initializing payments dashboard:', error);
  }
}

function flattenSureSystemsRecords(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  const possibleKeys = [
    'payments',
    'paymentHistory',
    'paymenthistory',
    'results',
    'records',
    'data',
    'items',
    'transactions'
  ];

  for (const key of possibleKeys) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function normalizeSureSystemsPayment(item = {}) {
  const amount = Number(
    item.amount
    ?? item.collectionAmount
    ?? item.instalmentAmount
    ?? item.installmentAmount
    ?? item.paidAmount
    ?? 0
  );

  const dateValue = item.paymentDate
    || item.collectionDate
    || item.transactionDate
    || item.date
    || item.processedDate
    || null;

  return {
    id: item.paymentId || item.transactionId || item.id || item.contractReference || `sure-${Math.random().toString(36).slice(2)}`,
    loanId: item.loanId || null,
    applicationId: item.userReference || item.contractReference || null,
    amount: Number.isFinite(amount) ? amount : 0,
    date: dateValue,
    status: (item.status || item.paymentStatus || 'completed').toString().toLowerCase(),
    method: 'SureSystems',
    source: 'suresystems'
  };
}

async function loadSureSystemsPaymentHistory(session) {
  try {
    const response = await fetch('/api/suresystems/payments/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        frontEndUserName: session?.user?.email || 'webuser'
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      console.warn('SureSystems payments download failed:', payload?.error || response.status);
      return;
    }

    const records = flattenSureSystemsRecords(payload);
    if (!records.length) {
      return;
    }

    const normalized = records
      .map((item) => normalizeSureSystemsPayment(item))
      .filter((item) => item.amount > 0 || item.date || item.applicationId);

    if (!normalized.length) {
      return;
    }

    const existingIds = new Set(paymentHistory.map((item) => `${item.source || 'internal'}:${item.id}`));
    for (const item of normalized) {
      const uniqueKey = `${item.source}:${item.id}`;
      if (!existingIds.has(uniqueKey)) {
        paymentHistory.push(item);
      }
    }

    paymentHistory.sort((left, right) => new Date(right.date || 0) - new Date(left.date || 0));
    console.log('✅ SureSystems payment history merged:', normalized.length);
  } catch (error) {
    console.warn('SureSystems payment history unavailable:', error?.message || error);
  }
}

// Load active loans from database
async function loadActiveLoans(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from('loans')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;

    activeLoans = (data || []).map(loan => {
      const principal = parseFloat(loan.principal_amount) || 0;
      const termMonths = parseInt(loan.term_months, 10) || 0;
      const monthlyPayment = parseFloat(loan.monthly_payment || 0) || 0;
      const totalRepayment = parseFloat(loan.total_repayment) || (monthlyPayment * (termMonths || 1)) || principal;
      const outstandingRaw = parseFloat(loan.outstanding_balance);

      return {
        id: loan.id,
        applicationId: loan.application_id,
        principal,
        totalRepayment,
        outstanding: Number.isFinite(outstandingRaw) && outstandingRaw > 0 ? outstandingRaw : totalRepayment,
        monthlyPayment,
        nextPaymentDate: loan.next_payment_date,
        interestRate: parseFloat(loan.interest_rate),
        termMonths,
        status: loan.status,
        startDate: loan.start_date
      };
    });

    console.log('✅ Loaded active loans:', activeLoans);
  } catch (error) {
    console.error('Error loading active loans:', error);
    activeLoans = [];
  }
}

// Load bank accounts from database
async function loadBankAccounts(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('user_id', userId)
      .order('is_primary', { ascending: false })
      .order('last_used_at', { ascending: false, nullsFirst: false });

    if (error) throw error;

    bankAccounts = (data || []).map(account => ({
      id: account.id,
      bankName: account.bank_name,
      accountHolder: account.account_holder,
      accountNumber: account.account_number,
      branchCode: account.branch_code,
      accountType: account.account_type,
      isPrimary: account.is_primary,
      isVerified: account.is_verified,
      lastUsed: account.last_used_at
    }));

    console.log('✅ Loaded bank accounts:', bankAccounts);
  } catch (error) {
    console.error('Error loading bank accounts:', error);
    bankAccounts = [];
  }
}

// Load payment history from database
async function loadPaymentHistory(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        loans:loan_id (
          id,
          application_id
        )
      `)
      .eq('user_id', userId)
      .order('payment_date', { ascending: false })
      .limit(50);

    if (error) throw error;

    paymentHistory = (data || []).map(payment => ({
      id: payment.id,
      loanId: payment.loan_id,
      applicationId: payment.loans?.application_id,
      amount: parseFloat(payment.amount),
      date: payment.payment_date,
      status: 'completed', // Default to completed for now
      method: 'Card', // Will be updated when payment methods are added
      source: 'internal'
    }));

    console.log('✅ Loaded payment history:', paymentHistory);
  } catch (error) {
    console.error('Error loading payment history:', error);
    paymentHistory = [];
  }
}

// Calculate metrics
function calculateMetrics() {
  const paidByLoan = paymentHistory.reduce((acc, payment) => {
    if (!payment?.loanId) return acc;
    const key = Number(payment.loanId);
    const amount = Number(payment.amount) || 0;
    if (!Number.isFinite(key) || amount <= 0) return acc;
    acc[key] = (acc[key] || 0) + amount;
    return acc;
  }, {});

  activeLoans = activeLoans.map((loan) => {
    const totalDue = Number(loan.totalRepayment) || Number(loan.principal) || 0;
    const paidToDate = paidByLoan[Number(loan.id)] || 0;
    const derivedOutstanding = Math.max(totalDue - paidToDate, 0);
    const fallbackOutstanding = Number(loan.outstanding) || totalDue;
    return {
      ...loan,
      outstanding: paidToDate > 0 ? derivedOutstanding : Math.max(fallbackOutstanding, totalDue)
    };
  });

  const totalOutstanding = activeLoans.reduce((sum, loan) => sum + loan.outstanding, 0);
  const nextPayment = activeLoans.length > 0
    ? Math.min(...activeLoans.map(l => l.monthlyPayment))
    : 0;
  
  const nextDate = activeLoans.length > 0
    ? activeLoans.reduce((earliest, loan) => {
        const date = new Date(loan.nextPaymentDate);
        return !earliest || date < new Date(earliest) ? loan.nextPaymentDate : earliest;
      }, null)
    : null;

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const paidThisMonth = paymentHistory
    .filter(p => new Date(p.date) >= firstOfMonth)
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPaid = paymentHistory.reduce((sum, p) => sum + p.amount, 0);

  // Update UI
  document.getElementById('totalOutstanding').textContent = formatCurrency(totalOutstanding);
  document.getElementById('nextPaymentAmount').textContent = formatCurrency(nextPayment);
  document.getElementById('nextPaymentDate').textContent = nextDate ? formatDate(nextDate) : '--';
  document.getElementById('paidThisMonth').textContent = formatCurrency(paidThisMonth);
  document.getElementById('totalPaid').textContent = formatCurrency(totalPaid);
}

// Render all sections
function renderAll() {
  renderActiveLoans();
  renderBankAccounts();
  renderPaymentHistory();
}

// Render active loans
async function loadBankingDetails() {
  try {
    const res = await fetch('/api/payment/banking-details');
    if (res.ok) bankingDetails = await res.json();
  } catch (e) { console.warn('[banking-details]', e.message); }
}

function renderActiveLoans() {
  const container  = document.getElementById('activeLoansContainer');
  const countBadge = document.getElementById('activeLoansCount');
  if (countBadge) countBadge.textContent = activeLoans.length;

  if (activeLoans.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-inbox"></i>
        <p>No active loans</p>
      </div>`;
    return;
  }

  container.innerHTML = activeLoans.map(loan => {
    const isOverdue   = loan.nextPaymentDate && new Date(loan.nextPaymentDate) < new Date();
    const statusClass = isOverdue ? 'overdue' : 'active';
    const statusText  = isOverdue ? 'Overdue' : 'Active';
    const pct         = loan.totalRepayment > 0
      ? Math.min(100, Math.round(((loan.totalRepayment - loan.outstanding) / loan.totalRepayment) * 100))
      : 0;

    return `
      <div class="loan-item" data-loan-id="${loan.id}" style="border-radius:16px;overflow:hidden">
        <div class="loan-item-header">
          <span class="loan-reference">Loan #${loan.applicationId?.slice?.(0,8)?.toUpperCase() || loan.id}</span>
          <span class="loan-status ${statusClass}">${statusText}</span>
        </div>

        <!-- Progress bar -->
        <div style="margin:8px 0 12px;background:#f3f4f6;border-radius:99px;height:6px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:var(--color-primary);border-radius:99px;transition:width .6s ease"></div>
        </div>
        <p style="font-size:11px;color:#9ca3af;margin-bottom:12px">${pct}% repaid</p>

        <div class="loan-details">
          <div class="loan-detail-item">
            <span class="loan-detail-label">Outstanding:</span>
            <span class="loan-detail-value" style="color:var(--color-primary);font-weight:700">${formatCurrency(loan.outstanding)}</span>
          </div>
          <div class="loan-detail-item">
            <span class="loan-detail-label">Monthly Instalment:</span>
            <span class="loan-detail-value">${formatCurrency(loan.monthlyPayment)}</span>
          </div>
          <div class="loan-detail-item">
            <span class="loan-detail-label">Next Due:</span>
            <span class="loan-detail-value" style="${isOverdue?'color:#ef4444;font-weight:700':''}">
              ${loan.nextPaymentDate ? formatDate(loan.nextPaymentDate) : '—'}
            </span>
          </div>
        </div>

        <div class="loan-item-actions" style="display:flex;gap:8px;margin-top:12px">
          <button onclick="window.openManualPayModal('${loan.id}','${loan.applicationId||''}','${formatCurrency(loan.monthlyPayment)}','partial')"
            style="flex:1;padding:10px;background:var(--color-primary);color:#fff;border:none;border-radius:12px;font-weight:700;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
            <i class="fas fa-money-bill-wave"></i> Make Payment
          </button>
          <button onclick="window.openManualPayModal('${loan.id}','${loan.applicationId||''}','${formatCurrency(loan.outstanding)}','settlement')"
            style="flex:1;padding:10px;background:#fff;color:var(--color-primary);border:2px solid var(--color-primary);border-radius:12px;font-weight:700;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
            <i class="fas fa-flag-checkered"></i> Settle Loan
          </button>
        </div>
      </div>`;
  }).join('');

  // Inject payment modal if not already in DOM
  if (!document.getElementById('manual-pay-modal')) {
    injectPaymentModal();
  }
}

function injectPaymentModal() {
  const modal = document.createElement('div');
  modal.id = 'manual-pay-modal';
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;align-items:center;justify-content:center;padding:16px';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:24px;width:100%;max-width:440px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.2)">
      <!-- Header -->
      <div style="background:var(--color-primary);padding:20px 24px;display:flex;align-items:center;justify-content:space-between">
        <div>
          <p id="mpm-type-label" style="color:rgba(255,255,255,.8);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Payment</p>
          <h3 style="color:#fff;font-size:20px;font-weight:800;margin:2px 0 0">Submit Proof of Payment</h3>
        </div>
        <button onclick="window.closeManualPayModal()" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:16px">✕</button>
      </div>

      <div style="padding:24px">
        <!-- Banking details -->
        <div id="mpm-banking" style="background:#f8f9fa;border-radius:16px;padding:16px;margin-bottom:20px">
          <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;margin-bottom:10px">EFT to this account</p>
          <div id="mpm-bank-details" style="space-y:4px"></div>
        </div>

        <!-- Settlement quote (shown for settlements) -->
        <div id="mpm-quote" style="display:none;background:#fff3ea;border:1px solid #fed7aa;border-radius:16px;padding:16px;margin-bottom:20px">
          <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#ea580c;margin-bottom:10px">Settlement Quote (valid 7 days)</p>
          <div id="mpm-quote-details"></div>
        </div>

        <form id="mpm-form" onsubmit="window.submitManualPayment(event)">
          <input type="hidden" id="mpm-loan-id">
          <input type="hidden" id="mpm-app-id">
          <input type="hidden" id="mpm-pay-type">

          <div style="margin-bottom:16px">
            <label style="display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:6px;text-transform:uppercase">Amount Paid (R) *</label>
            <input id="mpm-amount" type="number" min="1" step="0.01" required
              style="width:100%;border:2px solid #e5e7eb;border-radius:12px;padding:12px 16px;font-size:16px;font-weight:700;box-sizing:border-box;outline:none"
              onfocus="this.style.borderColor='var(--color-primary)'"
              onblur="this.style.borderColor='#e5e7eb'"
              placeholder="0.00">
          </div>

          <div style="margin-bottom:16px">
            <label style="display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:6px;text-transform:uppercase">Your Bank Reference *</label>
            <input id="mpm-reference" type="text" required
              style="width:100%;border:2px solid #e5e7eb;border-radius:12px;padding:12px 16px;font-size:14px;box-sizing:border-box;outline:none"
              onfocus="this.style.borderColor='var(--color-primary)'"
              onblur="this.style.borderColor='#e5e7eb'"
              placeholder="e.g. REF-1001 or your ID number">
          </div>

          <div style="margin-bottom:16px">
            <label style="display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:6px;text-transform:uppercase">Proof of Payment (URL or note)</label>
            <input id="mpm-proof" type="text"
              style="width:100%;border:2px solid #e5e7eb;border-radius:12px;padding:12px 16px;font-size:14px;box-sizing:border-box;outline:none"
              onfocus="this.style.borderColor='var(--color-primary)'"
              onblur="this.style.borderColor='#e5e7eb'"
              placeholder="Paste screenshot link or bank ref number">
            <p style="font-size:11px;color:#9ca3af;margin-top:4px">You can also WhatsApp your proof to the office directly.</p>
          </div>

          <div style="margin-bottom:20px">
            <label style="display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:6px;text-transform:uppercase">Notes (optional)</label>
            <textarea id="mpm-notes" rows="2"
              style="width:100%;border:2px solid #e5e7eb;border-radius:12px;padding:12px 16px;font-size:14px;box-sizing:border-box;outline:none;resize:none"
              onfocus="this.style.borderColor='var(--color-primary)'"
              onblur="this.style.borderColor='#e5e7eb'"
              placeholder="Any additional info for the admin..."></textarea>
          </div>

          <button type="submit" id="mpm-submit-btn"
            style="width:100%;padding:14px;background:var(--color-primary);color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer;transition:opacity .2s">
            Submit Payment Proof
          </button>
        </form>

        <div id="mpm-success" style="display:none;text-align:center;padding:16px 0">
          <div style="font-size:48px;margin-bottom:12px">✅</div>
          <h4 style="font-size:18px;font-weight:800;color:#10b981;margin-bottom:8px">Proof Submitted!</h4>
          <p style="color:#6b7280;font-size:14px">Your payment will be confirmed within 1 business day. You will receive an SMS confirmation.</p>
          <button onclick="window.closeManualPayModal()" style="margin-top:16px;padding:12px 24px;background:var(--color-primary);color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer">Done</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

window.openManualPayModal = async (loanId, appId, suggestedAmount, payType) => {
  const modal = document.getElementById('manual-pay-modal');
  if (!modal) injectPaymentModal();

  // Reset form
  document.getElementById('mpm-form').style.display = 'block';
  document.getElementById('mpm-success').style.display = 'none';
  document.getElementById('mpm-loan-id').value = loanId;
  document.getElementById('mpm-app-id').value  = appId;
  document.getElementById('mpm-pay-type').value = payType;
  document.getElementById('mpm-amount').value  = '';
  document.getElementById('mpm-reference').value = '';
  document.getElementById('mpm-proof').value   = '';
  document.getElementById('mpm-notes').value   = '';

  const typeLabel = payType === 'settlement' ? 'Early Settlement' : 'Manual Payment';
  document.getElementById('mpm-type-label').textContent = typeLabel;

  // Show banking details with copy buttons
  const bd  = bankingDetails;
  const ref = `${(bd?.refPrefix || 'REF')}-${loanId.slice(0,8).toUpperCase()}`;
  const bankEl = document.getElementById('mpm-bank-details');

  if (bd?.accountNo) {
    const rows = [
      ['Bank',           bd.bankName,                        false],
      ['Account Holder', bd.accountHolder || bd.company,     true],
      ['Account No',     bd.accountNo,                       true],
      ['Branch Code',    bd.branchCode,                      true],
      ['Account Type',   bd.accountType,                     false],
      ['Reference',      ref,                                true]
    ];

    bankEl.innerHTML = `
      ${rows.map(([label, val, copyable]) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f3f4f6">
          <span style="font-size:12px;color:#9ca3af;min-width:110px">${label}</span>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:13px;font-weight:${copyable?'700':'500'};color:#111827;font-family:${label==='Account No'||label==='Branch Code'?'monospace':'inherit'}">${val || '—'}</span>
            ${copyable && val ? `
            <button onclick="window.copyToClipboard('${val.replace(/'/g,"\\'")}', this)"
              style="background:none;border:none;cursor:pointer;color:#9ca3af;padding:2px 4px;border-radius:6px;transition:all .15s"
              onmouseover="this.style.background='#f3f4f6';this.style.color='var(--color-primary)'"
              onmouseout="this.style.background='none';this.style.color='#9ca3af'"
              title="Copy">
              <i class="fas fa-copy" style="font-size:12px"></i>
            </button>` : ''}
          </div>
        </div>`).join('')}

      <!-- Copy All button -->
      <button onclick="window.copyAllBankingDetails('${bd.bankName}','${bd.accountHolder||bd.company}','${bd.accountNo}','${bd.branchCode}','${bd.accountType}','${ref}')"
        style="width:100%;margin-top:12px;padding:10px;background:#f8f9fa;border:1.5px dashed #d1d5db;border-radius:12px;font-size:12px;font-weight:700;color:#374151;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:6px"
        onmouseover="this.style.background='#fff3ea';this.style.borderColor='var(--color-primary)';this.style.color='var(--color-primary)'"
        onmouseout="this.style.background='#f8f9fa';this.style.borderColor='#d1d5db';this.style.color='#374151'">
        <i class="fas fa-copy"></i> Copy All Banking Details
      </button>`;

    document.getElementById('mpm-reference').value = ref;
  } else {
    bankEl.innerHTML = `<p style="font-size:13px;color:#6b7280">Contact the office for banking details.</p>`;
  }

  // For settlement: fetch quote
  const quoteEl = document.getElementById('mpm-quote');
  if (payType === 'settlement') {
    quoteEl.style.display = 'block';
    document.getElementById('mpm-quote-details').innerHTML = '<p style="font-size:13px;color:#6b7280">Calculating...</p>';
    try {
      const res  = await fetch(`/api/payment/settlement-quote/${appId || loanId}`);
      const data = await res.json();
      if (data.settlementAmount) {
        document.getElementById('mpm-amount').value = data.settlementAmount;
        document.getElementById('mpm-quote-details').innerHTML = `
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:13px;color:#6b7280">Outstanding Balance</span>
            <span style="font-size:13px;font-weight:700">${formatCurrency(data.outstanding)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:13px;color:#10b981">Settlement Discount (5%)</span>
            <span style="font-size:13px;font-weight:700;color:#10b981">− ${formatCurrency(data.settlementDiscount)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:2px solid #fed7aa">
            <span style="font-size:14px;font-weight:800;color:#ea580c">Settlement Amount</span>
            <span style="font-size:16px;font-weight:900;color:#ea580c">${formatCurrency(data.settlementAmount)}</span>
          </div>
          <p style="font-size:11px;color:#9ca3af;margin-top:6px">Valid until ${data.validUntil}</p>`;
      }
    } catch(e) {
      document.getElementById('mpm-quote-details').innerHTML = `<p style="font-size:12px;color:#ef4444">Could not load quote.</p>`;
    }
  } else {
    quoteEl.style.display = 'none';
  }

  modal.style.display = 'flex';
};

window.closeManualPayModal = () => {
  const modal = document.getElementById('manual-pay-modal');
  if (modal) modal.style.display = 'none';
};

window.submitManualPayment = async (e) => {
  e.preventDefault();
  const btn = document.getElementById('mpm-submit-btn');
  btn.textContent = 'Submitting…';
  btn.disabled = true;

  try {
    const { supabase } = await import('/Services/supabaseClient.js');
    const { data: { session } } = await supabase.auth.getSession();

    const res = await fetch('/api/payment/submit-proof', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        loanId:      document.getElementById('mpm-loan-id').value,
        applicationId: document.getElementById('mpm-app-id').value,
        paymentType: document.getElementById('mpm-pay-type').value,
        amount:      document.getElementById('mpm-amount').value,
        reference:   document.getElementById('mpm-reference').value,
        proofUrl:    document.getElementById('mpm-proof').value,
        notes:       document.getElementById('mpm-notes').value
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Submission failed');

    document.getElementById('mpm-form').style.display    = 'none';
    document.getElementById('mpm-success').style.display = 'block';
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    btn.textContent = 'Submit Payment Proof';
    btn.disabled = false;
  }
};

// Render bank accounts
function renderBankAccounts() {
  const container = document.getElementById('bankAccountsContainer');

  if (bankAccounts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-building-columns"></i>
        <p>No saved bank accounts</p>
      </div>
    `;
    return;
  }

  container.innerHTML = bankAccounts.map(account => {
    const masked = maskAccountNumber(account.accountNumber);
    return `
      <div class="bank-account-item ${account.isPrimary ? 'primary' : ''}" data-account-id="${account.id}">
        <div class="account-header">
          <span class="bank-name">
            <i class="fas fa-university"></i>
            ${account.bankName}
            ${account.isPrimary ? '<span class="primary-badge">Primary</span>' : ''}
          </span>
        </div>
        <div class="account-details">
          <div><strong>${account.accountHolder}</strong></div>
          <div class="account-number">${masked}</div>
          <div>${account.accountType}</div>
        </div>
        <div class="account-actions">
          ${!account.isPrimary ? `<button class="btn-secondary btn-sm" onclick="setPrimaryAccount(${account.id})">Set as Primary</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Render payment history
function renderPaymentHistory() {
  const tbody = document.getElementById('paymentHistoryBody');

  if (paymentHistory.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="6">
          <div class="empty-state">
            <i class="fas fa-receipt"></i>
            <p>No payment history yet</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = paymentHistory.map(payment => `
    <tr>
      <td>${formatDate(payment.date)}</td>
      <td>Loan #${payment.applicationId || payment.loanId}</td>
      <td><strong>${formatCurrency(payment.amount)}</strong></td>
      <td><span class="payment-status-badge ${payment.status}">${capitalizeFirst(payment.status)}</span></td>
      <td>${payment.method}</td>
      <td>
        <button class="btn-secondary btn-sm btn-icon" onclick="viewPaymentReceipt(${payment.id})">
          <i class="fas fa-receipt"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

// Bind event listeners
function bindEventListeners() {
  // Make payment button
  const makePaymentBtn = document.getElementById('makePaymentBtn');
  if (makePaymentBtn) makePaymentBtn.onclick = () => openPaymentModal();
  
  // Close modal buttons
  document.getElementById('closePaymentModal')?.addEventListener('click', closePaymentModal);
  document.getElementById('cancelPaymentBtn')?.addEventListener('click', closePaymentModal);

  // Add bank account button
  document.getElementById('addBankAccountBtn')?.addEventListener('click', addBankAccount);

  // Payment form
  document.getElementById('paymentForm')?.addEventListener('submit', handlePaymentSubmit);

  // Loan selection change
  document.getElementById('paymentLoanSelect')?.addEventListener('change', handleLoanSelection);

  // Amount suggestion buttons
  document.querySelectorAll('.amount-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const type = e.target.dataset.type;
      if (selectedLoan) {
        const amount = type === 'minimum' ? selectedLoan.monthlyPayment : selectedLoan.outstanding;
        document.getElementById('paymentAmount').value = amount.toFixed(2);
      }
    });
  });

  // Download statement
  document.getElementById('downloadStatementBtn')?.addEventListener('click', downloadStatement);

  // Manual SureSystems sync
  document.getElementById('syncSureSystemsBtn')?.addEventListener('click', syncSureSystemsNow);
}

async function syncSureSystemsNow() {
  const button = document.getElementById('syncSureSystemsBtn');

  try {
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
    }

    const { supabase } = await import('/Services/supabaseClient.js');
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      showPaymentStatus('Your session expired. Please sign in again.', 'error');
      return;
    }

    await loadSureSystemsPaymentHistory(session);
    calculateMetrics();
    renderPaymentHistory();
    showPaymentStatus('SureSystems transactions synced.', 'success');
  } catch (error) {
    console.error('Manual SureSystems sync failed:', error);
    showPaymentStatus('SureSystems sync failed. Please try again.', 'error');
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = '<i class="fas fa-arrows-rotate"></i> Sync SureSystems';
    }
  }
}

// Initialize collapsible sections for mobile
function initMobileCollapsibleSections() {
  const activeLoansSection = document.querySelector('.active-loans-section');
  const bankAccountsSection = document.querySelector('.bank-accounts-section');

  if (!activeLoansSection || !bankAccountsSection) {
    console.log('⚠️ Collapsible sections not found');
    return;
  }

  // Start with sections collapsed on mobile
  activeLoansSection.classList.add('collapsed');
  bankAccountsSection.classList.add('collapsed');

  console.log('✅ Mobile collapsible sections initialized');

  // Toggle on header click
  const activeLoansHeader = activeLoansSection.querySelector('.section-header');
  const bankAccountsHeader = bankAccountsSection.querySelector('.section-header');

  if (activeLoansHeader) {
    activeLoansHeader.addEventListener('click', (e) => {
      e.stopPropagation();
      activeLoansSection.classList.toggle('collapsed');
      console.log('Active loans toggled:', !activeLoansSection.classList.contains('collapsed') ? 'open' : 'closed');
    });
  }

  if (bankAccountsHeader) {
    bankAccountsHeader.addEventListener('click', (e) => {
      e.stopPropagation();
      bankAccountsSection.classList.toggle('collapsed');
      console.log('Bank accounts toggled:', !bankAccountsSection.classList.contains('collapsed') ? 'open' : 'closed');
    });
  }
}

// Open payment modal
window.openPaymentModal = function(loanId = null) {
  const modal = document.getElementById('paymentModal');
  const select = document.getElementById('paymentLoanSelect');
  
  // Populate loan dropdown
  select.innerHTML = '<option value="">-- Select a loan --</option>' + 
    activeLoans.map(loan => 
      `<option value="${loan.id}">Loan #${loan.applicationId || loan.id} - ${formatCurrency(loan.outstanding)} outstanding</option>`
    ).join('');

  if (loanId) {
    select.value = loanId;
    handleLoanSelection({ target: select });
  }

  modal.classList.remove('hidden');
};

// Close payment modal
function closePaymentModal() {
  document.getElementById('paymentModal').classList.add('hidden');
  document.getElementById('paymentForm').reset();
  document.getElementById('selectedLoanDetails').classList.add('hidden');
  selectedLoan = null;
}

// Handle loan selection in payment form
function handleLoanSelection(event) {
  const loanId = parseInt(event.target.value);
  const detailsCard = document.getElementById('selectedLoanDetails');

  if (!loanId) {
    detailsCard.classList.add('hidden');
    selectedLoan = null;
    return;
  }

  selectedLoan = activeLoans.find(l => l.id === loanId);
  if (!selectedLoan) return;

  detailsCard.innerHTML = `
    <h4>Loan Details</h4>
    <div class="loan-details">
      <div class="loan-detail-item">
        <span class="loan-detail-label">Outstanding Balance:</span>
        <span class="loan-detail-value">${formatCurrency(selectedLoan.outstanding)}</span>
      </div>
      <div class="loan-detail-item">
        <span class="loan-detail-label">Monthly Payment:</span>
        <span class="loan-detail-value">${formatCurrency(selectedLoan.monthlyPayment)}</span>
      </div>
      <div class="loan-detail-item">
        <span class="loan-detail-label">Next Due Date:</span>
        <span class="loan-detail-value">${formatDate(selectedLoan.nextPaymentDate)}</span>
      </div>
    </div>
  `;
  detailsCard.classList.remove('hidden');

  // Set default amount to monthly payment
  document.getElementById('paymentAmount').value = selectedLoan.monthlyPayment.toFixed(2);
}

// Handle payment form submission
async function handlePaymentSubmit(event) {
  event.preventDefault();

  if (!selectedLoan) {
    showPaymentStatus('Please select a loan', 'error');
    return;
  }

  const amount = parseFloat(document.getElementById('paymentAmount').value);
  const method = document.querySelector('input[name="paymentMethod"]:checked').value;

  if (amount <= 0) {
    showPaymentStatus('Please enter a valid amount', 'error');
    return;
  }

  if (amount > selectedLoan.outstanding) {
    showPaymentStatus('Payment amount cannot exceed outstanding balance', 'error');
    return;
  }

  // Show loading state
  const submitBtn = document.getElementById('submitPaymentBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

  try {
    if (method === 'card') {
      // TODO: Integrate with Paystack
      showPaymentStatus('Paystack integration coming soon!', 'error');
      console.log('Payment details:', { loanId: selectedLoan.id, amount, method });
    } else {
      // Manual transfer instructions
      showPaymentStatus('Manual transfer instructions will be displayed here', 'error');
    }
  } catch (error) {
    console.error('Payment error:', error);
    showPaymentStatus('Payment failed. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>Continue to Payment</span><i class="fas fa-arrow-right"></i>';
  }
}

// Show payment status message
function showPaymentStatus(message, type) {
  const statusEl = document.getElementById('paymentStatus');
  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
  statusEl.classList.remove('hidden');

  setTimeout(() => {
    statusEl.classList.add('hidden');
  }, 5000);
}

// Set primary bank account
window.setPrimaryAccount = async function(accountId) {
  try {
    const { supabase } = await import('/Services/supabaseClient.js');
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) return;

    // Remove primary from all accounts
    await supabase
      .from('bank_accounts')
      .update({ is_primary: false })
      .eq('user_id', session.user.id);

    // Set new primary
    await supabase
      .from('bank_accounts')
      .update({ is_primary: true })
      .eq('id', accountId);

    // Reload and re-render
    await loadBankAccounts(supabase, session.user.id);
    renderBankAccounts();

  } catch (error) {
    console.error('Error setting primary account:', error);
    alert('Failed to update primary account');
  }
};

// Add bank account — navigate to profile banking tab
function addBankAccount() {
  if (typeof window.navigate === 'function') {
    window.navigate('profile');
  } else {
    window.lumaNavigate?.('profile');
  }
}

// View loan details — navigate to apply page which shows active loan detail
window.viewLoanDetails = function(loanId) {
  if (typeof window.navigate === 'function') {
    window.navigate('dashboard');
  } else {
    window.lumaNavigate?.('dashboard');
  }
};

// View payment receipt — show a simple receipt card in a modal
window.viewPaymentReceipt = async function(paymentId) {
  const payment = paymentHistory.find(p => p.id === paymentId);
  if (!payment) { alert('Receipt not found.'); return; }

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:20px;width:100%;max-width:360px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.2)">
      <div style="background:var(--color-primary,#E7762E);padding:20px 24px">
        <p style="color:rgba(255,255,255,.8);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin:0">Payment Receipt</p>
        <h3 style="color:#fff;font-size:22px;font-weight:800;margin:4px 0 0">✓ Confirmed</h3>
      </div>
      <div style="padding:24px">
        ${[
          ['Amount', `R ${Number(payment.amount).toFixed(2)}`],
          ['Date', payment.date || '—'],
          ['Reference', payment.id?.slice(0,8)?.toUpperCase() || '—'],
          ['Status', payment.status || 'Completed'],
          ['Method', payment.source === 'suresystems' ? 'Debit Order' : 'Payment']
        ].map(([k,v]) => `
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6">
            <span style="font-size:13px;color:#6b7280">${k}</span>
            <span style="font-size:13px;font-weight:700">${v}</span>
          </div>`).join('')}
        <button onclick="this.closest('[style*=fixed]').remove()"
          style="width:100%;margin-top:20px;padding:12px;background:var(--color-primary,#E7762E);color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer">
          Close
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
};

// Download statement — fetch from server and open in new tab
async function downloadStatement(applicationId) {
  try {
    const { supabase } = await import('/Services/supabaseClient.js');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { alert('Please log in again.'); return; }

    // Use first active loan if no specific ID
    const appId = applicationId || activeLoans[0]?.applicationId;
    if (!appId) { alert('No active loans found.'); return; }

    // Open in new tab — browser will show/download the HTML statement
    const url = `/api/statement/${appId}`;
    const win = window.open('', '_blank');
    const res = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
    const html = await res.text();
    win.document.write(html);
    win.document.close();
  } catch (e) {
    alert('Could not generate statement: ' + e.message);
  }
}

// Utility functions
function formatCurrency(value) {
  const number = Number(value) || 0;
  return `R ${number.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function formatDate(dateValue) {
  if (!dateValue) return '--';
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function maskAccountNumber(accountNumber = '') {
  if (!accountNumber) return '';
  const visible = accountNumber.slice(-4);
  return `•••• ${visible}`;
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Copy helpers ─────────────────────────────────────────────────
window.copyToClipboard = (text, btn) => {
  navigator.clipboard.writeText(text).then(() => {
    const icon = btn.querySelector('i');
    if (icon) { icon.className = 'fas fa-check'; icon.style.color = '#10b981'; }
    btn.style.background = '#f0fdf4';
    btn.style.color = '#10b981';
    setTimeout(() => {
      if (icon) { icon.className = 'fas fa-copy'; icon.style.color = ''; }
      btn.style.background = 'none';
      btn.style.color = '#9ca3af';
    }, 2000);
  }).catch(() => alert('Copy failed — please copy manually.'));
};

window.copyAllBankingDetails = (bank, holder, accNo, branch, type, ref) => {
  const text = [
    `Bank:            ${bank}`,
    `Account Holder:  ${holder}`,
    `Account Number:  ${accNo}`,
    `Branch Code:     ${branch}`,
    `Account Type:    ${type}`,
    `Reference:       ${ref}`
  ].join('\n');

  navigator.clipboard.writeText(text).then(() => {
    // Find the button and flash it green
    const btns = document.querySelectorAll('#mpm-bank-details button');
    const copyAllBtn = btns[btns.length - 1];
    if (copyAllBtn) {
      const orig = copyAllBtn.innerHTML;
      copyAllBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
      copyAllBtn.style.background   = '#f0fdf4';
      copyAllBtn.style.borderColor  = '#10b981';
      copyAllBtn.style.color        = '#10b981';
      setTimeout(() => {
        copyAllBtn.innerHTML          = orig;
        copyAllBtn.style.background   = '#f8f9fa';
        copyAllBtn.style.borderColor  = '#d1d5db';
        copyAllBtn.style.color        = '#374151';
      }, 2500);
    }
  }).catch(() => alert('Copy failed — please copy manually.'));
};

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPaymentsDashboard);
} else {
  initPaymentsDashboard();
}

// Re-initialize on page loaded event (for SPA navigation)
window.addEventListener('pageLoaded', (event) => {
  if (event?.detail?.pageName === 'documents') {
    initPaymentsDashboard();
  }
});
