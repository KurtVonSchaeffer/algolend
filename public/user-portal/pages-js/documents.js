// Payments Dashboard JavaScript - Soft Neumorphic & Bank Management
import '/user-portal/Services/sessionGuard.js'; 

let activeLoans = [];
let bankAccounts = [];
let paymentHistory = [];

// Pagination State
let currentPaymentPage = 1;
const PAYMENTS_PER_PAGE = 10;

// ==========================================
// UTILITY FORMATTERS
// ==========================================
const formatCurrency = (value) => {
    const number = Number(value) || 0;
    return `R ${number.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

const formatDate = (dateValue) => {
    if (!dateValue) return '--';
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? '--' : date.toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
};

const calculateMonthlyPayment = (principal, annualRate, termMonths) => {
    if (!principal || !termMonths) return 0;
    const monthlyRate = (annualRate || 0) / 12;
    if (!monthlyRate) return principal / termMonths;
    const factor = Math.pow(1 + monthlyRate, termMonths);
    return (principal * monthlyRate * factor) / (factor - 1);
};

// ==========================================
// INITIALIZATION
// ==========================================
async function initPaymentsDashboard() {
    try {
        const requiredElements = [
            'totalOutstanding', 'nextPaymentAmount', 'nextPaymentDate',
            'paidThisMonth', 'totalPaid', 'activeLoansContainer',
            'bankAccountsContainer', 'paymentHistoryBody', 'quickAccountSelect'
        ];
        
        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        if (missingElements.length > 0) {
            setTimeout(initPaymentsDashboard, 200);
            return;
        }
        
        const { supabase } = await import('/Services/supabaseClient.js');
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            window.location.href = '/auth/login.html';
            return;
        }

        const [paymentsByLoan] = await Promise.all([
            loadPaymentHistory(supabase, session.user.id),
            loadBankAccounts(supabase, session.user.id)
        ]);
        
        await loadActiveLoans(supabase, session.user.id, paymentsByLoan);

        calculateMetrics();
        renderAll();
        bindEventListeners();

    } catch (error) {
        console.error('Error initializing payments dashboard:', error);
    }
}

// ==========================================
// SAFE DATABASE FETCHERS
// ==========================================
async function loadBankAccounts(supabase, userId) {
    try {
        const { data, error } = await supabase
            .from('bank_accounts')
            .select('*')
            .eq('user_id', userId)
            .order('is_primary', { ascending: false });

        if (error) throw error;

        bankAccounts = (data || []).map(acc => ({
            id: acc.id,
            bankName: acc.bank_name,
            accountNumber: acc.account_number,
            accountType: acc.account_type,
            isPrimary: acc.is_primary
        }));
    } catch (error) {
        console.error('Error loading bank accounts:', error);
    }
}

async function loadActiveLoans(supabase, userId, paymentsByLoan = {}) {
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
            const termMonths = parseInt(loan.term_months, 10) || 1;
            const rawRate = parseFloat(loan.interest_rate) || 0;
            const normalizedRate = rawRate > 1 ? rawRate / 100 : rawRate;
            
            const storedMonthly = parseFloat(loan.monthly_payment) || 0;
            const derivedMonthly = calculateMonthlyPayment(principal, normalizedRate, termMonths);
            const safeMonthlyPayment = Number.isFinite(storedMonthly) && storedMonthly > 0 ? storedMonthly : derivedMonthly;
            
            const totalRepayment = parseFloat(loan.total_repayment) || (safeMonthlyPayment * termMonths) || principal;
            const paidToDate = paymentsByLoan[loan.id] || 0;
            const outstandingBalance = Math.max(totalRepayment - paidToDate, 0);
            
            let dueDateObj = null;
            const candidateDateStr = loan.next_payment_date || loan.first_payment_date || loan.repayment_start_date;
            
            if (candidateDateStr) {
                dueDateObj = new Date(candidateDateStr);
            } else if (loan.start_date) {
                dueDateObj = new Date(loan.start_date);
                dueDateObj.setDate(dueDateObj.getDate() + 30);
            }

            if (dueDateObj && !Number.isNaN(dueDateObj.getTime())) { 
                dueDateObj.setUTCHours(0, 0, 0, 0); 
            } else {
                dueDateObj = null;
            }

            const nextDueAmount = Math.min(safeMonthlyPayment, outstandingBalance || safeMonthlyPayment);

            return {
                id: loan.id, applicationId: loan.application_id,
                principal, outstanding: outstandingBalance,
                monthlyPayment: safeMonthlyPayment,
                dueDateObj, nextDueAmount, status: loan.status
            };
        });
    } catch (error) { console.error('Error loading active loans:', error); }
}

async function loadPaymentHistory(supabase, userId) {
    try {
        const { data, error } = await supabase
            .from('payments')
            .select('*, loans:loan_id(application_id)')
            .eq('user_id', userId)
            .order('payment_date', { ascending: false });
            
        if (error) throw error;

        paymentHistory = (data || []).map(payment => ({
            id: payment.id, loanId: payment.loan_id, applicationId: payment.loans?.application_id,
            amount: parseFloat(payment.amount), date: payment.payment_date, 
            status: payment.status || 'completed', method: payment.payment_method || 'Card'
        }));

        currentPaymentPage = 1; // Reset pagination on load
        return paymentHistory.reduce((acc, p) => {
            acc[p.loanId] = (acc[p.loanId] || 0) + (p.amount || 0);
            return acc;
        }, {});
    } catch (error) { return {}; }
}

// ==========================================
// CALCULATIONS & RENDERING
// ==========================================
function calculateMetrics() {
    const totalOutstanding = activeLoans.reduce((sum, loan) => sum + loan.outstanding, 0);
    
    const upcomingLoan = activeLoans.reduce((best, loan) => {
        if (!loan.dueDateObj) return best;
        if (loan.outstanding <= 0) return best; 
        if (!best) return loan;
        if (loan.dueDateObj < best.dueDateObj) return loan;
        return best;
    }, null);
    
    let nextPayment = 0;
    let nextDateStr = 'No upcoming payment';

    if (upcomingLoan && upcomingLoan.dueDateObj) {
        nextPayment = upcomingLoan.nextDueAmount;
        nextDateStr = `Due ${upcomingLoan.dueDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else if (paymentHistory.length > 0) {
        const latestPaid = new Date(paymentHistory[0].date);
        nextDateStr = `Last paid ${latestPaid.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const paidThisMonth = paymentHistory.filter(p => new Date(p.date) >= firstOfMonth).reduce((sum, p) => sum + p.amount, 0);
    const totalPaid = paymentHistory.reduce((sum, p) => sum + p.amount, 0);

    const tryUpdate = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
    tryUpdate('totalOutstanding', formatCurrency(totalOutstanding));
    tryUpdate('nextPaymentAmount', formatCurrency(nextPayment));
    tryUpdate('nextPaymentDate', nextDateStr);
    tryUpdate('paidThisMonth', formatCurrency(paidThisMonth));
    tryUpdate('totalPaid', formatCurrency(totalPaid));
}

function renderQuickAccountDropdown() {
    const select = document.getElementById('quickAccountSelect');
    if (!select) return;

    if (bankAccounts.length === 0) {
        select.innerHTML = '<option value="" disabled selected>No accounts linked</option>';
        return;
    }

    const sortedAccounts = [...bankAccounts].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
    
    select.innerHTML = sortedAccounts.map(acc => `
        <option value="${acc.id}" ${acc.isPrimary ? 'selected' : ''}>
            ${acc.bankName} (•••• ${String(acc.accountNumber).slice(-4)})
        </option>
    `).join('');
}

function renderActiveLoans() {
    const container = document.getElementById('activeLoansContainer');
    const countBadge = document.getElementById('activeLoansCount');
    if (countBadge) countBadge.textContent = activeLoans.length;
    if (!container) return;

    if (activeLoans.length === 0) {
        container.innerHTML = `<div class="empty-state">No active loans found</div>`;
        return;
    }

    // Only show top 3 on the main dashboard
    const visibleLoans = activeLoans.slice(0, 3);

    let html = visibleLoans.map(loan => `
        <div class="modern-list-item" onclick="openLoansModule()">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-weight:700; color:var(--text-main); font-size:16px;">Loan #${loan.applicationId || loan.id}</div>
                    <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">Next: ${loan.dueDateObj ? formatDate(loan.dueDateObj) : 'TBD'}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:700; color:var(--text-main); font-size:18px;">${formatCurrency(loan.outstanding)}</div>
                    <span style="display:inline-block; margin-top:6px; padding:4px 12px; background:rgba(231,118,46,0.1); color:var(--color-primary); border-radius:50px; font-size:10px; font-weight:700; text-transform:uppercase;">Active</span>
                </div>
            </div>
        </div>
    `).join('');

    // View All button for active loans
    if (activeLoans.length > 3) {
        html += `
            <button class="text-btn" onclick="openLoansModule()" style="width: 100%; text-align: center; margin-top: 16px; padding: 12px; font-weight: 600; color: var(--color-primary); background: rgba(231,118,46,0.05); border-radius: var(--radius-md); transition: 0.2s; cursor: pointer;">
                View All ${activeLoans.length} Active Loans
            </button>
        `;
    }

    container.innerHTML = html;
}

function renderBankAccounts() {
    const container = document.getElementById('bankAccountsContainer');
    if (!container) return;

    if (bankAccounts.length === 0) {
        container.innerHTML = `<div class="empty-state">No saved bank accounts</div>`;
        return;
    }

    // Only show top 3 on the main dashboard
    const visibleAccounts = bankAccounts.slice(0, 3);

    let html = visibleAccounts.map(account => `
        <div class="modern-list-item" style="display:flex; flex-direction:row; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:16px;">
                <div style="width:52px; height:52px; border-radius:50%; background:var(--color-white); box-shadow:var(--shadow-soft); display:grid; place-items:center; color:var(--text-main); font-size:20px;">
                    <i class="fas fa-university"></i>
                </div>
                <div>
                    <div style="font-weight:700; color:var(--text-main); font-size:16px;">${account.bankName}</div>
                    <div style="font-size:13px; color:var(--text-muted); margin-top:4px; font-weight:500;">${account.accountType || 'Account'} •••• ${String(account.accountNumber).slice(-4)}</div>
                </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 16px;">
                ${account.isPrimary ? '<span class="status-badge completed" style="background:rgba(231,118,46,0.1); color:var(--color-primary);">Primary</span>' : ''}
                
                <button class="btn-icon" onclick="confirmDeleteAccount('${account.id}')" title="Remove Account" style="color: #ef4444; width: 36px; height: 36px; background: #fff1f2; border: none; border-radius: 50%; display: grid; place-items: center; cursor: pointer; transition: 0.2s;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');

    // View All button for bank accounts
    if (bankAccounts.length > 3) {
        html += `
            <button class="text-btn" onclick="openBankAccountsModule()" style="width: 100%; text-align: center; margin-top: 16px; padding: 12px; font-weight: 600; color: var(--color-primary); background: rgba(231,118,46,0.05); border-radius: var(--radius-md); transition: 0.2s; cursor: pointer;">
                View All ${bankAccounts.length} Accounts
            </button>
        `;
    }

    container.innerHTML = html;
}

// Pagination Logic
window.changePaymentPage = function(direction) {
    const maxPage = Math.ceil(paymentHistory.length / PAYMENTS_PER_PAGE) || 1;
    currentPaymentPage += direction;
    if (currentPaymentPage < 1) currentPaymentPage = 1;
    if (currentPaymentPage > maxPage) currentPaymentPage = maxPage;
    renderPaymentHistory();
};

function renderPaymentHistory() {
    const tbody = document.getElementById('paymentHistoryBody');
    if (!tbody) return;

    const tableContainer = tbody.closest('.table-container');

    if (paymentHistory.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:30px; font-weight:500;">No payment history yet</td></tr>`;
        const existingPg = tableContainer.querySelector('.pagination-controls');
        if (existingPg) existingPg.remove();
        return;
    }

    // Handle Pagination Slice
    const startIdx = (currentPaymentPage - 1) * PAYMENTS_PER_PAGE;
    const paginatedPayments = paymentHistory.slice(startIdx, startIdx + PAYMENTS_PER_PAGE);
    const maxPage = Math.ceil(paymentHistory.length / PAYMENTS_PER_PAGE) || 1;

    tbody.innerHTML = paginatedPayments.map(p => `
        <tr>
            <td>${formatDate(p.date)}</td>
            <td style="color:var(--text-muted);">#${p.applicationId || p.loanId}</td>
            <td style="color:var(--text-main); font-weight:700;">${formatCurrency(p.amount)}</td>
            <td><span class="status-badge ${p.status.toLowerCase()}">${p.status}</span></td>
            <td style="color:var(--text-muted);">${p.method}</td>
            <td><button class="btn-icon"><i class="fas fa-receipt"></i></button></td>
        </tr>
    `).join('');

    // Generate/Update Pagination HTML below table
    let paginationHtml = '';
    if (maxPage > 1) {
        paginationHtml = `
            <div class="pagination-controls" style="display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 24px;">
                <button onclick="changePaymentPage(-1)" ${currentPaymentPage === 1 ? 'disabled' : ''} style="width: 40px; height: 40px; border-radius: 50%; border: none; background: var(--color-white); box-shadow: var(--shadow-soft); color: var(--text-main); cursor: ${currentPaymentPage === 1 ? 'not-allowed' : 'pointer'}; opacity: ${currentPaymentPage === 1 ? '0.5' : '1'}; transition: 0.2s; display: grid; place-items: center;">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <span style="font-size: 13px; font-weight: 600; color: var(--text-muted);">Page ${currentPaymentPage} of ${maxPage}</span>
                <button onclick="changePaymentPage(1)" ${currentPaymentPage === maxPage ? 'disabled' : ''} style="width: 40px; height: 40px; border-radius: 50%; border: none; background: var(--color-white); box-shadow: var(--shadow-soft); color: var(--text-main); cursor: ${currentPaymentPage === maxPage ? 'not-allowed' : 'pointer'}; opacity: ${currentPaymentPage === maxPage ? '0.5' : '1'}; transition: 0.2s; display: grid; place-items: center;">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;
    }

    const existingPg = tableContainer.querySelector('.pagination-controls');
    if (existingPg) existingPg.remove();
    
    if (paginationHtml) {
        tableContainer.insertAdjacentHTML('beforeend', paginationHtml);
    }
}

function renderAll() {
    renderActiveLoans();
    renderBankAccounts();
    renderPaymentHistory();
    renderQuickAccountDropdown();
}

// ==========================================
// DB ACTIONS: Update Default & Custom Confirm Delete
// ==========================================
window.updateDefaultAccount = async function(accountId) {
    try {
        const { supabase } = await import('/Services/supabaseClient.js');
        const { data: { session } } = await supabase.auth.getSession();
        
        await supabase.from('bank_accounts').update({ is_primary: false }).eq('user_id', session.user.id);
        await supabase.from('bank_accounts').update({ is_primary: true }).eq('id', accountId).eq('user_id', session.user.id);
            
        await loadBankAccounts(supabase, session.user.id);
        renderAll(); 
    } catch (error) {
        console.error('Error updating default account:', error);
    }
};

window.confirmDeleteAccount = function(accountId) {
    const numericId = Number(accountId);
    const account = bankAccounts.find(a => a.id === numericId);
    if (!account) return;

    const html = `
        <div style="text-align: center; padding: 10px 0;">
            <div style="width: 64px; height: 64px; background: #fff1f2; color: #ef4444; border-radius: 50%; display: grid; place-items: center; font-size: 24px; margin: 0 auto 16px;">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h3 style="margin-bottom: 8px; font-size: 20px; font-weight: 700; color: var(--text-main);">Remove Account?</h3>
            <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 32px; line-height: 1.5;">
                Are you sure you want to remove <strong>${account.bankName} (•••• ${String(account.accountNumber).slice(-4)})</strong>?<br>This action cannot be undone.
            </p>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button onclick="closeUniversalModal()" class="action-btn" style="flex: 1; background: #FAFAFA; border: 1px solid #E5E5EA; color: var(--text-main);">Cancel</button>
                <button id="confirmRemoveBtn" onclick="executeDeleteAccount(${numericId})" class="action-btn" style="flex: 1; background: #ef4444; color: white; border: none;">Yes, Remove</button>
            </div>
        </div>
    `;
    
    openUniversalModal('Confirm Removal', html, false);
};

window.executeDeleteAccount = async function(accountId) {
    try {
        const btn = document.getElementById('confirmRemoveBtn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Removing...';
        }

        const { supabase } = await import('/Services/supabaseClient.js');
        const { data: { session } } = await supabase.auth.getSession();
        
        const numericId = Number(accountId);
        const { error } = await supabase.from('bank_accounts').delete().eq('id', numericId).eq('user_id', session.user.id);
        if (error) throw error;
        
        await loadBankAccounts(supabase, session.user.id);
        
        if (bankAccounts.length > 0 && !bankAccounts.some(acc => acc.isPrimary)) {
            await updateDefaultAccount(bankAccounts[0].id);
        } else {
            renderAll(); 
        }
        closeUniversalModal(); 
    } catch (error) {
        console.error('Error deleting account:', error);
        alert('Failed to remove account.');
        const btn = document.getElementById('confirmRemoveBtn');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Yes, Remove';
        }
    }
};

// ==========================================
// UNIVERSAL MODALS
// ==========================================
window.openUniversalModal = function(title, bodyHTML, isFullScreen = false) {
    const modal = document.getElementById('modern-universal-modal');
    const titleEl = document.getElementById('modern-modal-title');
    const bodyEl = document.getElementById('modern-modal-body');
    if (!modal) return;
    
    titleEl.innerText = title;
    bodyEl.innerHTML = bodyHTML;
    
    if (isFullScreen) {
        modal.classList.add('is-full-screen');
    } else {
        modal.classList.remove('is-full-screen');
    }
    
    modal.classList.remove('hidden');
};

window.closeUniversalModal = function() {
    document.getElementById('modern-universal-modal').classList.add('hidden');
};

// MODAL: VIEW ALL BANK ACCOUNTS
window.openBankAccountsModule = function() {
    const html = bankAccounts.map(account => `
        <div class="modern-list-item" style="display:flex; flex-direction:row; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:16px;">
                <div style="width:52px; height:52px; border-radius:50%; background:var(--color-white); box-shadow:var(--shadow-soft); display:grid; place-items:center; color:var(--text-main); font-size:20px;">
                    <i class="fas fa-university"></i>
                </div>
                <div>
                    <div style="font-weight:700; color:var(--text-main); font-size:16px;">${account.bankName}</div>
                    <div style="font-size:13px; color:var(--text-muted); margin-top:4px; font-weight:500;">${account.accountType || 'Account'} •••• ${String(account.accountNumber).slice(-4)}</div>
                </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 16px;">
                ${account.isPrimary ? '<span class="status-badge completed" style="background:rgba(231,118,46,0.1); color:var(--color-primary);">Primary</span>' : ''}
                
                <button class="btn-icon" onclick="confirmDeleteAccount('${account.id}')" title="Remove Account" style="color: #ef4444; width: 36px; height: 36px; background: #fff1f2; border: none; border-radius: 50%; display: grid; place-items: center; cursor: pointer; transition: 0.2s;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');

    openUniversalModal('All Bank Accounts', html, false);
};

// MODAL: ACTIVE LOANS DETAILS
window.openLoansModule = function() {
    const active = activeLoans;
    const totalRemaining = active.reduce((sum, l) => sum + l.outstanding, 0);

    const statsHtml = `
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="font-size: 13px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Active Balance</div>
            <div style="font-size: 36px; font-weight: 700; color: var(--text-main); letter-spacing: -1px;">${formatCurrency(totalRemaining)}</div>
        </div>`;

    const listHtml = active.length === 0 ? '<div class="empty-state">No active loans found.</div>' : active.map(loan => `
            <div class="modern-list-item" style="border: 1px solid #eee; background: var(--color-white); box-shadow: var(--shadow-soft);">
                <div class="modern-item-header">
                    <span class="modern-item-id">Loan #${loan.applicationId || loan.id}</span>
                    <span class="status-badge" style="background:rgba(231,118,46,0.1); color:var(--color-primary);">Active</span>
                </div>
                <div class="modern-item-grid">
                    <div class="modern-grid-col"><div class="label">Principal</div><div class="val">${formatCurrency(loan.principal)}</div></div>
                    <div class="modern-grid-col"><div class="label">Remaining</div><div class="val">${formatCurrency(loan.outstanding)}</div></div>
                    <div class="modern-grid-col"><div class="label">Next Due</div><div class="val">${formatCurrency(loan.nextDueAmount)}</div></div>
                    <div class="modern-grid-col"><div class="label">Due Date</div><div class="val">${loan.dueDateObj ? formatDate(loan.dueDateObj) : 'TBD'}</div></div>
                </div>
            </div>`).join('');

    openUniversalModal('Active Loans Details', statsHtml + listHtml, true);
};

// ==========================================
// ADD BANK ACCOUNT MODULE
// ==========================================
window.openAddBankAccountModal = function() {
    const formHTML = `
    <form id="addBankForm" onsubmit="saveNewBankAccount(event)" style="display: flex; flex-direction: column; gap: 20px;">
       <div class="form-group">
           <label>Bank Name</label>
           <select id="bankName" required class="modern-input">
               <option value="" disabled selected>Select your bank</option>
               <option value="FNB">First National Bank (FNB)</option>
               <option value="Standard Bank">Standard Bank</option>
               <option value="ABSA">ABSA</option>
               <option value="Nedbank">Nedbank</option>
               <option value="Capitec">Capitec</option>
               <option value="Investec">Investec</option>
               <option value="TymeBank">TymeBank</option>
               <option value="Discovery Bank">Discovery Bank</option>
               <option value="African Bank">African Bank</option>
           </select>
       </div>
       <div class="form-group">
           <label>Account Holder Name</label>
           <input type="text" id="accountHolder" required class="modern-input" placeholder="e.g. John Doe">
       </div>
       <div class="form-group">
           <label>Account Number</label>
           <input type="text" id="accountNumber" required class="modern-input" pattern="[0-9]+" title="Numbers only" placeholder="e.g. 62000000000">
       </div>
       <div class="form-group">
           <label>Branch Code</label>
           <input type="text" id="branchCode" required class="modern-input" placeholder="e.g. 250655">
       </div>
       <div class="form-group">
           <label>Account Type</label>
           <select id="accountType" required class="modern-input">
               <option value="" disabled selected>Select account type</option>
               <option value="cheque">Cheque / Current</option>
               <option value="savings">Savings</option>
               <option value="transmission">Transmission</option>
           </select>
       </div>
       <div style="display:flex; align-items:center; gap: 12px; cursor: pointer; padding-top: 8px;">
           <input type="checkbox" id="isPrimary" style="width: 20px; height: 20px; accent-color: var(--color-primary); cursor: pointer;">
           <label for="isPrimary" style="cursor: pointer; font-size: 14px; font-weight: 500;">Set as default account for payments</label>
       </div>
       <div id="addBankStatus" class="status-message"></div>
       <button type="submit" id="saveBankBtn" class="action-btn primary" style="width: 100%; margin-top: 10px;">Save Bank Account</button>
    </form>`;

    openUniversalModal('Add Bank Account', formHTML, false);
};

window.saveNewBankAccount = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('saveBankBtn');
    const status = document.getElementById('addBankStatus');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const { supabase } = await import('/Services/supabaseClient.js');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Session expired. Please sign in again.');

        const bankName = document.getElementById('bankName').value;
        const accountHolder = document.getElementById('accountHolder').value;
        const accountNumber = document.getElementById('accountNumber').value;
        const branchCode = document.getElementById('branchCode').value;
        const accountType = document.getElementById('accountType').value;
        const isPrimary = document.getElementById('isPrimary').checked;

        if (isPrimary && bankAccounts.length > 0) {
            await supabase.from('bank_accounts').update({ is_primary: false }).eq('user_id', session.user.id);
        }

        const { error } = await supabase.from('bank_accounts').insert([{
            user_id: session.user.id,
            bank_name: bankName,
            account_holder: accountHolder,
            account_number: accountNumber,
            branch_code: branchCode,
            account_type: accountType,
            is_primary: isPrimary || bankAccounts.length === 0
        }]);

        if (error) throw error;

        status.textContent = 'Bank account added successfully!';
        status.className = 'status-message success';
        status.style.display = 'block';

        setTimeout(() => {
            closeUniversalModal();
            initPaymentsDashboard(); 
        }, 1500);

    } catch (error) {
        console.error('Error saving bank account:', error);
        status.textContent = error.message || 'Failed to save account. Check details.';
        status.className = 'status-message error';
        status.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = 'Save Bank Account';
    }
};

// ==========================================
// PDF GENERATION (jsPDF & AutoTable)
// ==========================================
async function ensurePdfLibraries() {
    if (typeof window.jspdf !== 'undefined') return true;
    
    return new Promise((resolve) => {
        const script1 = document.createElement('script');
        script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script1.onload = () => {
            const script2 = document.createElement('script');
            script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
            script2.onload = () => resolve(true);
            document.head.appendChild(script2);
        };
        document.head.appendChild(script1);
    });
}

window.downloadStatement = async function() {
    const btn = document.getElementById('downloadStatementBtn');
    const originalText = btn.innerHTML;
    
    try {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        btn.disabled = true;

        await ensurePdfLibraries();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const { supabase } = await import('/Services/supabaseClient.js');
        const { data: { session } } = await supabase.auth.getSession();
        
        const displayName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || 'Mufaro Ncube'; 
        const uidShort = session?.user?.id ? session.user.id.substring(0, 6).toUpperCase() : '000000';

        doc.setFontSize(24);
        doc.setTextColor(124, 58, 237);
        doc.setFont("helvetica", "bold");
        doc.text("AlgoLend", 14, 22);
        
        doc.setFontSize(16);
        doc.setTextColor(28, 28, 30);
        doc.setFont("helvetica", "normal");
        doc.text("Payment History Statement", 14, 34);
        
        doc.setFontSize(10);
        doc.setTextColor(142, 142, 147);
        doc.text(`Account Holder: ${displayName}`, 14, 44);
        doc.text(`Account Reference: #${uidShort}`, 14, 50);
        doc.text(`Date Generated: ${new Date().toLocaleDateString('en-ZA')}`, 14, 56);

        const tableColumn = ["Date", "Reference", "Amount", "Status", "Method"];
        const tableRows = [];

        paymentHistory.forEach(p => {
            tableRows.push([
                formatDate(p.date),
                `#${p.applicationId || p.loanId}`,
                formatCurrency(p.amount),
                p.status.toUpperCase(),
                p.method
            ]);
        });

        doc.autoTable({
            startY: 64,
            head: [tableColumn],
            body: tableRows,
            theme: 'grid',
            headStyles: { 
                fillColor: [231, 118, 46], 
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: [250, 250, 250]
            },
            styles: { 
                fontSize: 10, 
                cellPadding: 6,
                textColor: [28, 28, 30] 
            }
        });

        doc.save(`AlgoLend_Statement_${uidShort}.pdf`);

    } catch (error) {
        console.error("Error generating PDF:", error);
        alert("Failed to generate PDF. Please try again.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

// ==========================================
// EVENT LISTENERS
// ==========================================
function bindEventListeners() {
    const makePaymentBtn = document.getElementById('makePaymentBtn');
    if (makePaymentBtn) makePaymentBtn.onclick = () => {
        const html = `
            <div style="text-align: center; padding: 8px 0 4px;">
                <div style="width: 56px; height: 56px; border-radius: 50%; background: #FFF3E0; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                        <line x1="1" y1="10" x2="23" y2="10"></line>
                    </svg>
                </div>
                <p style="color: var(--text-main); font-size: 15px; line-height: 1.6; margin: 0 0 8px;">
                    Online payments are <strong>coming soon</strong>.
                </p>
                <p style="color: var(--text-sub); font-size: 13px; line-height: 1.6; margin: 0 0 20px;">
                    Please contact your loan officer or visit a branch to make a payment at this time.
                </p>
                <button onclick="closeUniversalModal()" class="action-btn primary" style="width: 100%; max-width: 200px;">
                    Got it
                </button>
            </div>`;
        openUniversalModal('Payment Gateway', html, false);
    };
    document.getElementById('addBankAccountBtn')?.addEventListener('click', openAddBankAccountModal);
    document.getElementById('downloadStatementBtn')?.addEventListener('click', downloadStatement);
    
    const select = document.getElementById('quickAccountSelect');
    if (select) {
        select.addEventListener('change', (e) => {
            if (e.target.value) {
                updateDefaultAccount(e.target.value);
            }
        });
    }
}

initPaymentsDashboard();
window.addEventListener('pageLoaded', (e) => {
    if (e.detail?.pageName === 'documents') initPaymentsDashboard();
});