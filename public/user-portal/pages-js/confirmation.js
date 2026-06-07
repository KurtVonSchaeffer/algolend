import '/user-portal/Services/sessionGuard.js'; // Production auth guard

const PENDING_LOAN_KEY = 'pendingLoanConfig';
const SAVED_ACCOUNTS_KEY = 'savedBankAccounts';

let pendingLoanConfig = null;
let savedAccounts = [];

function ensureGoToStep() {
  if (typeof window.goToStep === 'function') {
    return;
  }

  window.goToStep = function(step) {
    const pages = {
      1: 'apply-loan',
      2: 'apply-loan-2',
      3: 'apply-loan-3',
      4: 'confirmation'
    };

    if (typeof loadPage === 'function') {
      loadPage(pages[step] || 'apply-loan');
    } else {
      const staticPages = {
        1: 'apply-loan.html',
        2: 'apply-loan-2.html',
        3: 'apply-loan-3.html',
        4: 'confirmation.html'
      };
      window.location.href = staticPages[step] || 'apply-loan.html';
    }
  };
}

function readPendingLoanConfig() {
  try {
    const raw = sessionStorage.getItem(PENDING_LOAN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error('Unable to read pending loan config:', error);
    return null;
  }
}

function loadSavedAccounts() {
  // Kept for backward compatibility, but will be populated from DB
  return savedAccounts || [];
}

function normalizeDateForStorage(dateValue) {
  if (!dateValue) {
    return null;
  }
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

async function loadSavedAccountsFromDB(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('user_id', userId)
      .order('last_used_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('Error loading bank accounts:', error);
      return [];
    }
    
    // Transform to match expected format
    savedAccounts = (data || []).map(account => ({
      id: account.id,
      bankName: account.bank_name,
      accountHolder: account.account_holder,
      accountNumber: account.account_number,
      branchCode: account.branch_code,
      accountType: account.account_type,
      savedAt: account.created_at
    }));
    
    return savedAccounts;
  } catch (error) {
    console.error('Error loading saved bank accounts:', error);
    return [];
  }
}

function persistSavedAccount(account) {
  const sanitized = { ...account, savedAt: new Date().toISOString() };
  const filtered = savedAccounts.filter((entry) => entry.accountNumber !== sanitized.accountNumber);
  filtered.unshift(sanitized);
  savedAccounts = filtered.slice(0, 3);

  try {
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(savedAccounts));
  } catch (error) {
    console.warn('Unable to persist saved bank accounts:', error);
  }
}

function ensureLoanSummary(config) {
  if (!config) return null;

  // If loan-config.js already stored a pre-computed NCA summary, use it directly
  if (config.summary && config.summary.totalCreditLife !== undefined) {
    return config.summary;
  }

  // Fallback: recompute using NCA rules so confirmation page always shows correct numbers
  const amount = Number(config.amount) || 0;
  const period = Number(config.period) || 1;
  const isFirstLoan = config.isFirstLoanOfYear ?? (Number(config.loanHistoryCount) === 0);

  const INTEREST_RATE   = 0.05;
  const INITIATION_RATE = 0.15;
  const CREDIT_LIFE     = 0.0045;
  const SERVICE_FEE     = 69;
  const VAT             = 0.15;

  const totalInterest       = amount * INTEREST_RATE * period;
  const totalInitiationFees = isFirstLoan ? 0 : amount * INITIATION_RATE;
  const totalServiceFees    = SERVICE_FEE * period;
  const totalCreditLife     = amount * CREDIT_LIFE * period;
  const monthlyCreditLife   = amount * CREDIT_LIFE;
  const vatAmount           = (totalInitiationFees + totalServiceFees) * VAT;
  const totalCostOfCredit   = totalInterest + totalInitiationFees + totalServiceFees + totalCreditLife + vatAmount;
  const totalRepayment      = amount + totalCostOfCredit;
  const monthlyPayment      = totalRepayment / period;

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
    // legacy alias
    totalMonthlyFees: totalServiceFees,
  };
}

function formatCurrency(value) {
  const number = Number(value) || 0;
  return `R ${number.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function formatPeriod(period) {
  const months = Number(period) || 0;
  return months ? `${months} month${months > 1 ? 's' : ''}` : '--';
}

function formatDate(dateValue) {
  if (!dateValue) {
    return '--';
  }
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }
  return date.toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' });
}

function maskAccountNumber(accountNumber = '') {
  if (!accountNumber) {
    return '';
  }
  const visible = accountNumber.slice(-4);
  return `•••• ${visible}`;
}

function renderLoanSummary() {
  const summary = ensureLoanSummary(pendingLoanConfig);
  if (!summary) {
    return;
  }

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = value;
    }
  };

  setText('summaryLoanAmount', formatCurrency(pendingLoanConfig.amount));
  setText('summaryLoanPeriod', formatPeriod(pendingLoanConfig.period));
  setText('summaryMonthlyPayment', formatCurrency(summary.monthlyPayment));
  setText('summaryTotalRepayment', formatCurrency(summary.totalRepayment));
  setText('summaryFirstDebit', formatDate(pendingLoanConfig.startDate));

  const signatureChip = document.getElementById('signatureStatus');
  if (signatureChip) {
    signatureChip.classList.toggle('warning', !pendingLoanConfig.signature);
    signatureChip.innerHTML = pendingLoanConfig.signature
      ? '<i class="fas fa-signature"></i> Signature on file'
      : '<i class="fas fa-signature"></i> Please re-sign before submitting';
  }
}

function renderSavedAccounts() {
  const select = document.getElementById('savedAccountsSelect');
  if (!select) {
    return;
  }

  if (!savedAccounts.length) {
    select.innerHTML = '<option value="">-- No saved accounts yet --</option>';
    select.disabled = true;
    return;
  }

  select.disabled = false;
  select.innerHTML = '<option value="">-- Select an account or add new --</option>' + 
    savedAccounts.map((account) => {
      const displayText = `${account.bankName} - ${maskAccountNumber(account.accountNumber)} (${account.accountHolder})`;
      return `<option value="${account.id}">${displayText}</option>`;
    }).join('');
}

function prefillBankForm(account) {
  const map = {
    bankName: account.bankName,
    accountHolder: account.accountHolder,
    accountNumber: account.accountNumber,
    branchCode: account.branchCode,
    accountType: account.accountType,
    debitDay: account.debitDay || ''
  };

  Object.entries(map).forEach(([id, value]) => {
    const field = document.getElementById(id);
    if (field) {
      field.value = value || '';
    }
  });
}

function showMissingState() {
  document.getElementById('missingLoanState')?.classList.remove('hidden');
  document.getElementById('confirmationContent')?.classList.add('hidden');
}

function showConfirmationContent() {
  document.getElementById('missingLoanState')?.classList.add('hidden');
  document.getElementById('confirmationContent')?.classList.remove('hidden');
}

function bindEditButton() {
  const editBtn = document.getElementById('editLoanBtn');
  if (!editBtn || editBtn.dataset.bound) {
    return;
  }
  editBtn.dataset.bound = 'true';
  editBtn.addEventListener('click', () => goToStep(3));
}

function bindUseSavedAccountButton() {
  const select = document.getElementById('savedAccountsSelect');
  if (!select || select.dataset.bound) {
    return;
  }
  select.dataset.bound = 'true';
  
  select.addEventListener('change', (e) => {
    const selectedValue = e.target.value;
    const bankDetailsSection = document.getElementById('bankDetailsSection');
    const selectedIdInput = document.getElementById('selectedBankAccountId');
    const consentCheckbox = document.getElementById('finalConsent');
    
    if (selectedValue === '' || selectedValue === 'new') {
      // Show form fields for new account
      if (bankDetailsSection) {
        bankDetailsSection.style.display = 'block';
        // Clear and enable all fields
        const bankName = document.getElementById('bankName');
        const accountHolder = document.getElementById('accountHolder');
        const accountNumber = document.getElementById('accountNumber');
        const branchCode = document.getElementById('branchCode');
        const accountType = document.getElementById('accountType');
        
        if (bankName) { bankName.value = ''; bankName.disabled = false; }
        if (accountHolder) { accountHolder.value = ''; accountHolder.disabled = false; }
        if (accountNumber) { accountNumber.value = ''; accountNumber.disabled = false; }
        if (branchCode) { branchCode.value = ''; branchCode.disabled = false; }
        if (accountType) { accountType.value = ''; accountType.disabled = false; }
      }
      if (selectedIdInput) selectedIdInput.value = '';
      // Keep consent checkbox enabled
      if (consentCheckbox) consentCheckbox.disabled = false;
    } else {
      // Use existing account - hide form fields and store ID
      const accountId = selectedValue;
      const account = savedAccounts.find(acc => acc.id == accountId);
      
      if (account && bankDetailsSection) {
        // Hide the form fields
        bankDetailsSection.style.display = 'none';
        // Store the selected account ID
        if (selectedIdInput) selectedIdInput.value = accountId;
        // Keep consent checkbox enabled
        if (consentCheckbox) consentCheckbox.disabled = false;
      }
    }
  });
}

function setSubmissionStatus(message, variant = 'info') {
  const el = document.getElementById('submissionStatus');
  if (!el) {
    return;
  }
  el.textContent = message;
  el.dataset.variant = variant;
  el.style.color = variant === 'error' ? '#c0392b' : variant === 'success' ? '#0f9158' : '#555';
}

function disableFormFields(disabled) {
  const form = document.getElementById('bankDetailsForm');
  if (!form) {
    return;
  }
  Array.from(form.elements).forEach((element) => {
    if (element.id !== 'useSavedAccountBtn') {
      element.disabled = disabled;
    }
  });
}

function showSubmissionResult(applicationId, bankDetails) {
  const container = document.getElementById('submissionResult');
  if (!container) {
    return;
  }
  container.classList.remove('hidden');
  container.innerHTML = `
    <h3><i class="fas fa-circle-check"></i> Application submitted</h3>
    <p>Your reference number is <strong>${applicationId}</strong>. We will verify ${bankDetails.bankName} (${maskAccountNumber(bankDetails.accountNumber)}) within the next business day.</p>
  `;
}

async function handleBankFormSubmit() {
  if (!pendingLoanConfig) {
    setSubmissionStatus('Loan terms missing. Please return to Step 3.', 'error');
    return;
  }

  const submitBtn = document.getElementById('submitConfirmationBtn');
  const finalConsent = document.getElementById('finalConsent');
  const selectedBankAccountId = document.getElementById('selectedBankAccountId')?.value;

  // Check if using existing account
  let bankDetails;
  let useExistingAccount = false;
  
  if (selectedBankAccountId) {
    // Using existing account - no need to validate form fields
    useExistingAccount = true;
    const existingAccount = savedAccounts.find(acc => acc.id == selectedBankAccountId);
    if (!existingAccount) {
      setSubmissionStatus('Selected account not found. Please try again.', 'error');
      return;
    }
    bankDetails = {
      bankAccountId: selectedBankAccountId,
      bankName: existingAccount.bankName,
      accountHolder: existingAccount.accountHolder,
      accountNumber: existingAccount.accountNumber,
      branchCode: existingAccount.branchCode,
      accountType: existingAccount.accountType,
      consented: Boolean(finalConsent?.checked)
    };
  } else {
    // New account - validate form fields
    bankDetails = {
      bankName: document.getElementById('bankName')?.value?.trim(),
      accountHolder: document.getElementById('accountHolder')?.value?.trim(),
      accountNumber: document.getElementById('accountNumber')?.value?.trim(),
      branchCode: document.getElementById('branchCode')?.value?.trim(),
      accountType: document.getElementById('accountType')?.value,
      consented: Boolean(finalConsent?.checked)
    };
    
    const missingField = Object.entries(bankDetails).find(([key, value]) => !value && key !== 'consented');
    if (missingField) {
      setSubmissionStatus('Please complete all banking fields.', 'error');
      return;
    }
  }

  if (!bankDetails.consented) {
    setSubmissionStatus('Please check the confirmation box to continue.', 'error');
    return;
  }

  setSubmissionStatus('Saving your application...', 'info');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing';
  let submissionCompleted = false;

  try {
    const { supabase } = await import('/Services/supabaseClient.js');
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    if (authError || !session) {
      throw new Error('Session expired. Please sign in again.');
    }

    const summary = ensureLoanSummary(pendingLoanConfig);
    const firstPaymentDateIso = normalizeDateForStorage(pendingLoanConfig.startDate);
    
    // Step 1: Save or retrieve bank account from database
    let bankAccountId = null;
    
    if (useExistingAccount && bankDetails.bankAccountId) {
      // Use the selected existing account
      bankAccountId = bankDetails.bankAccountId;
      // Update last_used_at
      await supabase
        .from('bank_accounts')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', bankAccountId)
        .eq('user_id', session.user.id); // Security check
      console.log('✅ Using selected bank account:', bankAccountId);
    } else {
      // Check if account already exists (in case user entered duplicate manually)
      const { data: existingAccounts } = await supabase
        .from('bank_accounts')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('account_number', bankDetails.accountNumber)
        .eq('bank_name', bankDetails.bankName)
        .maybeSingle();
      
      if (existingAccounts) {
        bankAccountId = existingAccounts.id;
        // Update last_used_at
        await supabase
          .from('bank_accounts')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', bankAccountId);
        console.log('✅ Using existing bank account:', bankAccountId);
      } else {
        // Create new bank account
        const { data: newBankAccount, error: bankError } = await supabase
          .from('bank_accounts')
          .insert([{
            user_id: session.user.id,
            bank_name: bankDetails.bankName,
            account_holder: bankDetails.accountHolder,
            account_number: bankDetails.accountNumber,
            branch_code: bankDetails.branchCode,
            account_type: bankDetails.accountType,
            last_used_at: new Date().toISOString()
          }])
          .select()
          .single();
        
        if (bankError) {
          console.error('Error saving bank account:', bankError);
          throw new Error('Failed to save banking details. Please try again.');
        }
        
        bankAccountId = newBankAccount.id;
        console.log('✅ Created new bank account:', bankAccountId);
      }
    }
    
    // Step 2: Update existing loan application or create new one
    let applicationId = sessionStorage.getItem('currentApplicationId');
    let newApplication;

    const offerFields = {
      offer_principal:             Number(pendingLoanConfig?.amount) || 0,
      offer_interest_rate:         0.05,   // 5% per month (NCA)
      offer_total_interest:        Number(summary?.totalInterest) || 0,
      offer_total_admin_fees:      Number(summary?.totalServiceFees ?? summary?.totalMonthlyFees) || 0,
      offer_total_initiation_fees: Number(summary?.totalInitiationFees) || 0,
      offer_credit_life_monthly:   Number(summary?.monthlyCreditLife) || 0,
      offer_vat_amount:            Number(summary?.vatAmount) || 0,
      offer_total_cost_of_credit:  Number(summary?.totalCostOfCredit) || 0,
      offer_monthly_repayment:     Number(summary?.monthlyPayment) || 0,
      offer_total_repayment:       Number(summary?.totalRepayment) || 0,
    };
    
    if (applicationId) {
      // Check if application is already submitted
      const { data: existingApp, error: checkError } = await supabase
        .from('loan_applications')
        .select('status')
        .eq('id', applicationId)
        .single();
      
      // Only update if application is still in draft state (BUREAU_OK or BUREAU_CHECKING)
      if (!checkError && existingApp && ['BUREAU_OK', 'BUREAU_CHECKING'].includes(existingApp.status)) {
        // Update existing application from credit check step
        console.log('✅ Updating existing application:', applicationId);

        // Generate client reference if not already set
        const userIdShort = session.user.id.substring(0, 8).toUpperCase();
        const clientReference = `C${userIdShort}`;

        const { data: updatedApp, error: updateError } = await supabase
          .from('loan_applications')
          .update({
            amount: Number(pendingLoanConfig.amount),
            term_months: Number(pendingLoanConfig.period),
            purpose: sessionStorage.getItem('pendingLoanPurpose') || 'Personal Loan',
            status: 'STARTED',
            bank_account_id: bankAccountId,
            repayment_start_date: firstPaymentDateIso,
            ...offerFields,
            offer_details: {
              interest_rate: pendingLoanConfig.interestRate,
              total_interest: summary?.totalInterest,
              total_repayment: summary?.totalRepayment,
              monthly_payment: summary?.monthlyPayment,
              first_payment_date: firstPaymentDateIso,
              signature_data: pendingLoanConfig.signature
            }
          })
          .eq('id', applicationId)
          .eq('user_id', session.user.id) // Security check
          .select()
          .single();
      
        if (updateError) {
          console.error('Error updating application:', updateError);
          throw new Error('Failed to update loan application. Please try again.');
        }
        
        newApplication = updatedApp;
      } else {
        // Application already submitted - create new one
        console.log('📝 Creating new application (existing one already submitted)');
        applicationId = null; // Reset so we create new
      }
    }
    
    if (!applicationId) {
      // Create new application
      console.log('📝 Creating new application');

      // Generate client reference from user ID (format: C + user_id first 8 chars)
      const userIdShort = session.user.id.substring(0, 8).toUpperCase();
      const clientReference = `C${userIdShort}`;

      const applicationData = {
        user_id: session.user.id,
        amount: Number(pendingLoanConfig.amount),
        term_months: Number(pendingLoanConfig.period),
        purpose: sessionStorage.getItem('pendingLoanPurpose') || 'Personal Loan',
        status: 'STARTED',
        bank_account_id: bankAccountId,
        repayment_start_date: firstPaymentDateIso,
        ...offerFields,
        offer_details: {
          interest_rate: pendingLoanConfig.interestRate,
          total_interest: summary?.totalInterest,
          total_repayment: summary?.totalRepayment,
          monthly_payment: summary?.monthlyPayment,
          first_payment_date: firstPaymentDateIso,
          signature_data: pendingLoanConfig.signature
        }
      };

      const { data: createdApp, error: createError } = await supabase
        .from('loan_applications')
        .insert([applicationData])
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      // Generate loan_reference: ClientNumber-LoanNumber (e.g., C12345678-L001)
      if (createdApp?.id && clientReference) {
        const loanNumber = String(createdApp.id).padStart(6, '0');
        const loanReference = `${clientReference}-L${loanNumber}`;
        const agreementNumber = `AGR${createdApp.id}`;

        const { data: updatedApp, error: refError } = await supabase
          .from('loan_applications')
          .update({
            loan_reference: loanReference,
            agreement_number: agreementNumber
          })
          .eq('id', createdApp.id)
          .eq('user_id', session.user.id)
          .select()
          .single();

        if (!refError) {
          newApplication = updatedApp;
        } else {
          console.warn('Failed to update loan reference:', refError);
          newApplication = createdApp;
        }
      } else {
        newApplication = createdApp;
      }
    }

    sessionStorage.setItem('lastApplicationId', newApplication.id);
    sessionStorage.removeItem(PENDING_LOAN_KEY);
    sessionStorage.removeItem('currentApplicationId'); // Clear so next application creates new record
    sessionStorage.removeItem('pendingLoanPurpose');   // Clear stored purpose

    // Route online applications to head office via server
    try {
        await fetch(`/api/applications/${newApplication.id}/route-to-head-office`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            }
        });
    } catch (_) { /* non-blocking */ }

    // Create notification for application submission (for user)
    const { notifyApplicationSubmitted, notifyAdminsNewApplication } = await import('/Services/notificationService.js');
    await notifyApplicationSubmitted(session.user.id, newApplication.id, newApplication.amount);
    
    // Create notification for admins about new application
    const userName = session.user.user_metadata?.full_name || session.user.email || 'User';
    await notifyAdminsNewApplication(session.user.id, newApplication.id, newApplication.amount, userName);

    // Refresh saved accounts from database
    await loadSavedAccountsFromDB(supabase, session.user.id);
    renderSavedAccounts();
    disableFormFields(true);
    setSubmissionStatus('Application submitted successfully.', 'success');
    showSubmissionResult(newApplication.id, bankDetails);
    submissionCompleted = true;
    submitBtn.innerHTML = '<i class="fas fa-check"></i> Submitted';
    
    // Mark step 4 as completed and save to session storage
    const step4 = document.querySelector('.step.active');
    if (step4) {
      step4.classList.add('completed');
    }
    sessionStorage.setItem('applicationSubmitted', 'true');
    
  } catch (error) {
    console.error('Failed to submit application:', error);
    setSubmissionStatus(error.message || 'Unable to submit application.', 'error');
  } finally {
    if (submissionCompleted) {
      submitBtn.disabled = true;
      // Redirect to dashboard shortly after successful submission so user sees confirmation
      setTimeout(() => {
        if (typeof loadPage === 'function') {
          loadPage('dashboard');
        } else {
          window.location.href = '/user-portal/?page=dashboard';
        }
      }, 1100);
    } else {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Submit application</span> <i class="fas fa-arrow-right"></i>';
    }
  }
}

function bindSubmitButton() {
  const btn = document.getElementById('submitConfirmationBtn');
  if (!btn || btn.dataset.bound) {
    return;
  }
  btn.dataset.bound = 'true';
  btn.addEventListener('click', handleBankFormSubmit);
}

async function loadBankingFormModule() {
  try {
    // Load CSS if not already loaded
    if (!document.getElementById('banking-form-css')) {
      const link = document.createElement('link');
      link.id = 'banking-form-css';
      link.rel = 'stylesheet';
      link.href = '/user-portal/modules-css/banking-form.css';
      document.head.appendChild(link);
    }

    const response = await fetch('/user-portal/modules/banking-form.html');
    if (!response.ok) {
      throw new Error('Failed to load banking form');
    }
    const html = await response.text();
    const moduleContent = document.getElementById('module-content');
    const moduleContainer = document.getElementById('module-container');
    
    if (moduleContent && moduleContainer) {
      moduleContent.innerHTML = html;
      moduleContainer.classList.remove('hidden');
      
      // Render loan summary in the modal
      renderLoanSummary();
      
      // Load and render saved accounts from database
      try {
        const { supabase } = await import('/Services/supabaseClient.js');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          await loadSavedAccountsFromDB(supabase, session.user.id);
        }
      } catch (err) {
        console.error('Error loading saved accounts:', err);
      }
      
      renderSavedAccounts();
      
      // Re-bind event handlers for the modal form
      bindUseSavedAccountButton();
      bindSubmitButton();
      bindCancelButton();
    }
  } catch (error) {
    console.error('Error loading banking form:', error);
    alert('Failed to load banking form. Please try again.');
  }
}

function closeBankingModal() {
  const moduleContainer = document.getElementById('module-container');
  if (moduleContainer) {
    moduleContainer.classList.add('hidden');
  }
}

function bindCancelButton() {
  const btn = document.getElementById('cancelBankingBtn');
  if (!btn || btn.dataset.bound) {
    return;
  }
  btn.dataset.bound = 'true';
  btn.addEventListener('click', closeBankingModal);
}

// Make functions available globally for onclick handlers
window.loadBankingFormModule = loadBankingFormModule;
window.closeBankingModal = closeBankingModal;

async function initConfirmationPage() {
  ensureGoToStep();
  pendingLoanConfig = readPendingLoanConfig();
  
  // Check if application was already submitted in this session
  const wasSubmitted = sessionStorage.getItem('applicationSubmitted');
  if (wasSubmitted === 'true') {
    const step4 = document.querySelector('.step.active');
    if (step4) {
      step4.classList.add('completed');
    }
  }
  
  // Load saved accounts from database
  try {
    const { supabase } = await import('/Services/supabaseClient.js');
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      await loadSavedAccountsFromDB(supabase, session.user.id);
    } else {
      savedAccounts = [];
    }
  } catch (error) {
    console.error('Error initializing confirmation page:', error);
    savedAccounts = [];
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initConfirmationPage);
} else {
  initConfirmationPage();
}

window.addEventListener('pageLoaded', (event) => {
  if (event?.detail?.pageName === 'confirmation') {
    initConfirmationPage();
  }
});
