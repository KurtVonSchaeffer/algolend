import '/user-portal/Services/sessionGuard.js'; // Production auth guard

window.consentGiven = false;

const REQUIRED_DOCUMENTS = ['tillslip', 'bankstatement'];
const documentState = {
  tillslip: 'pending',
  bankstatement: 'pending',
  kyc: 'pending'
};

const documentButtonRefs = {
  tillslip: { button: null, chip: null },
  bankstatement: { button: null, chip: null }
};

let moduleStatusRef = null;
let nextBtnRef = null;
let loginRequired = false;
let activeUserId = null;
let refreshDocumentsHandler = null;
let documentServices = null;
let supabaseClientInstance = null;
let kycButtonRef = null;
let kycStatusRef = null;
let isKycLaunching = false;
let kycStatusInterval = null;

// ── Declarations-popup state ──
let declarationsCompleted = false;   // true once user has accepted_std_conditions
let pendingActionAfterDeclarations = null;  // callback to execute after popup save

const APPLY_LOAN_PAGE = 'apply-loan';

async function getSupabaseClient() {
  if (supabaseClientInstance) {
    return supabaseClientInstance;
  }
  const { supabase } = await import('/Services/supabaseClient.js');
  supabaseClientInstance = supabase;
  return supabaseClientInstance;
}

function resetDocumentStateFlags() {
  Object.keys(documentState).forEach(key => {
    documentState[key] = 'pending';
  });
}

function resetDocumentReferences() {
  moduleStatusRef = null;
  nextBtnRef = null;
  Object.keys(documentButtonRefs).forEach(key => {
    documentButtonRefs[key].button = null;
    documentButtonRefs[key].chip = null;
  });
}

function detachDocumentUploadedListener() {
  if (refreshDocumentsHandler) {
    window.removeEventListener('document:uploaded', refreshDocumentsHandler);
    refreshDocumentsHandler = null;
  }
}

function cacheKycReferences() {
  kycButtonRef = document.getElementById('kycBtn');
  kycStatusRef = document.getElementById('kycBtnStatus');
}

function setKycStatus(variant, label) {
  if (!kycStatusRef) {
    return;
  }
  kycStatusRef.className = 'document-status';
  if (variant) {
    kycStatusRef.classList.add(variant);
  }
  kycStatusRef.textContent = label || '';
}

function formatKycStatusLabel(status) {
  if (!status) {
    return '';
  }
  return status
    .toString()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function refreshKycStatus() {
  cacheKycReferences();
  if (!kycButtonRef || !kycStatusRef) {
    return;
  }

  try {
    const supabase = await getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      setKycStatus('partial', 'Log in to start');
      kycButtonRef.disabled = true;
      return;
    }

    kycButtonRef.disabled = false;

    const response = await fetch(`/api/kyc/user/${session.user.id}/status`);
    if (!response.ok) {
      throw new Error('Unable to check status');
    }

    const data = await response.json();
    console.log('📋 KYC status response:', data);
    
    // Check for approved status
    if (data.verified) {
      setKycStatus('ready', 'Verified');
      kycButtonRef.disabled = true;
      kycButtonRef.classList.add('completed');
      kycButtonRef.setAttribute('aria-disabled', 'true');
      documentState.kyc = 'complete';
      
      // Stop polling once approved
      if (kycStatusInterval) {
        clearInterval(kycStatusInterval);
        kycStatusInterval = null;
      }
      
      // Update next button state
      updateNextButtonState();
      renderModuleStatus();
      return;
    }
    
    // Show intermediate statuses (Started, In Progress, etc.)
    if (data.normalizedStatus) {
      const statusMap = {
        'started': 'Verification Started',
        'in progress': 'Verification In Progress',
        'in_progress': 'Verification In Progress',
        'pending': 'Pending Review',
        'rejected': 'Verification Failed',
        'expired': 'Session Expired'
      };
      
      const displayStatus = statusMap[data.normalizedStatus] || data.status || 'Pending';
      
      if (data.normalizedStatus === 'rejected' || data.normalizedStatus === 'expired') {
        setKycStatus('partial', displayStatus);
        documentState.kyc = 'pending';
      } else if (data.normalizedStatus === 'started' || data.normalizedStatus.includes('progress')) {
        setKycStatus('partial', displayStatus);
        documentState.kyc = 'partial';
      } else {
        setKycStatus('partial', displayStatus);
        documentState.kyc = 'partial';
      }
      
      updateNextButtonState();
      renderModuleStatus();
      return;
    }
    
    // Not verified, so KYC is not complete
    documentState.kyc = 'pending';

    const statusLabel = formatKycStatusLabel(data.status);
    if (statusLabel) {
      setKycStatus('partial', statusLabel);
    } else {
      setKycStatus(null, 'Start');
    }
  } catch (err) {
    console.error('Failed to refresh KYC status:', err);
    setKycStatus('partial', 'Status unavailable');
  }
}

async function handleKycButtonClick() {
  // Gate: if declarations haven't been completed, show popup first  
  if (!declarationsCompleted) {
    pendingActionAfterDeclarations = () => {
      activateConsentUI();
      handleKycButtonClickInternal();
    };
    showDeclarationsPopup();
    return;
  }

  handleKycButtonClickInternal();
}

async function handleKycButtonClickInternal() {
  if (isKycLaunching) {
    return;
  }

  cacheKycReferences();
  if (!kycButtonRef || !kycStatusRef) {
    return;
  }

  try {
    isKycLaunching = true;
    kycButtonRef.disabled = true;
    setKycStatus('partial', 'Launching verification...');

    const supabase = await getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      setKycStatus('partial', 'Log in to start');
      return;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, identity_number, contact_number')
      .eq('id', session.user.id)
      .maybeSingle();

    const resolvedFullName =
      profileData?.full_name
      || session.user.user_metadata?.full_name
      || session.user.user_metadata?.name
      || '';

    const resolvedIdentityNumber =
      profileData?.identity_number
      || session.user.user_metadata?.identity_number
      || session.user.user_metadata?.id_number
      || session.user.user_metadata?.idNumber
      || null;

    const payload = {
      userId: session.user.id,
      email: session.user.email,
      metadata: {
        full_name: resolvedFullName
      }
    };

    if (resolvedIdentityNumber) {
      payload.metadata.identity_number = resolvedIdentityNumber;
      payload.metadata.id_number = resolvedIdentityNumber;
    }

    const phone =
      profileData?.contact_number
      || session.user.phone
      || session.user.user_metadata?.phone
      || session.user.user_metadata?.phone_number;
    if (phone) {
      payload.phone = phone;
    }

    const response = await fetch('/api/kyc/create-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.verification_url) {
      const detailsText = data?.details?.providerResponse
        ? ` (${typeof data.details.providerResponse === 'string' ? data.details.providerResponse : JSON.stringify(data.details.providerResponse)})`
        : '';
      throw new Error((data.error || 'Unable to start verification') + detailsText);
    }

    window.open(data.verification_url, '_blank', 'width=900,height=700');
    setKycStatus('partial', 'Verification started');

    // Start polling for status updates every 5 seconds
    if (kycStatusInterval) {
      clearInterval(kycStatusInterval);
    }
    kycStatusInterval = setInterval(async () => {
      await refreshKycStatus();
    }, 5000);
  } catch (err) {
    console.error('Failed to start KYC verification:', err);
    setKycStatus('partial', err.message || 'Unable to start verification');
  } finally {
    isKycLaunching = false;
    if (kycButtonRef && !kycStatusRef?.classList.contains('ready')) {
      kycButtonRef.disabled = false;
    }
  }
}

async function initKycButton() {
  cacheKycReferences();
  if (!kycButtonRef || !kycStatusRef) {
    return;
  }

  if (!kycButtonRef.dataset.bound) {
    kycButtonRef.addEventListener('click', handleKycButtonClick);
    kycButtonRef.dataset.bound = 'true';
  }

  await refreshKycStatus();
}

window.toggleConsent = async function () {
  // If we don't yet know the declarations are saved, re-check the database before
  // popping the form — avoids re-asking when the initial check hasn't returned yet.
  if (!declarationsCompleted) {
    await ensureDeclarationsKnown();
  }
  if (!declarationsCompleted) {
    pendingActionAfterDeclarations = () => {
      // After declarations are saved, activate consent automatically
      activateConsentUI();
    };
    showDeclarationsPopup();
    return;
  }

  // Normal toggle when declarations are already done
  window.consentGiven = !window.consentGiven;
  const btn = document.getElementById('consentBtn');
  const icon = btn?.querySelector('i');
  const documentList = document.getElementById('documentList');

  if (!btn || !icon || !documentList) {
    return;
  }

  if (window.consentGiven) {
    btn.classList.add('active');
    icon.classList.remove('fa-square');
    icon.classList.add('fa-check-square');
    documentList.classList.remove('hidden-consent');
  } else {
    btn.classList.remove('active');
    icon.classList.remove('fa-check-square');
    icon.classList.add('fa-square');
    documentList.classList.add('hidden-consent');
  }

  updateNextButtonState();
}

// Helper to activate consent UI without toggling
function activateConsentUI() {
  window.consentGiven = true;
  const btn = document.getElementById('consentBtn');
  const icon = btn?.querySelector('i');
  const documentList = document.getElementById('documentList');
  if (btn && icon && documentList) {
    btn.classList.add('active');
    icon.classList.remove('fa-square');
    icon.classList.add('fa-check-square');
    documentList.classList.remove('hidden-consent');
  }
  updateNextButtonState();
}

window.showApplyLoan2 = function() {
  // Use goToStep for validation instead of direct navigation
  window.goToStep(2);
}

async function loadModule(name) {
  // Re-check declarations from DB before showing the popup, in case the initial
  // async check is still in flight.
  if (!declarationsCompleted) {
    await ensureDeclarationsKnown();
  }
  // Gate: if declarations still aren't completed after the check, show popup first
  if (!declarationsCompleted) {
    pendingActionAfterDeclarations = () => {
      // After declarations saved, auto-consent and then open the module
      activateConsentUI();
      loadModuleInternal(name);
    };
    showDeclarationsPopup();
    return;
  }

  loadModuleInternal(name);
}

async function loadModuleInternal(name) {
  const overlay = document.getElementById("module-container");
  const moduleContent = document.getElementById("module-content");
  const cssHref = `/user-portal/modules-css/${name}.css`;

  overlay.classList.remove("hidden");
  moduleContent.innerHTML = "<p>Loading...</p>";

  if (!document.querySelector(`link[data-module-css="${name}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${cssHref}?t=${Date.now()}`;
    link.dataset.moduleCss = name;
    document.head.appendChild(link);
  }

  try {
    const res = await fetch(`/user-portal/modules/${name}.html?t=${Date.now()}`);
    if (!res.ok) throw new Error(`Module ${name} not found`);
    const html = await res.text();
    moduleContent.innerHTML = html;

    await import(`/user-portal/modules-js/${name}.js?t=${Date.now()}`);
  } catch (err) {
    console.error(`❌ Failed to load ${name} module:`, err);
    moduleContent.innerHTML = `<p style="color:red;">${err.message}</p>`;
  }
}

function closeModule() {
  const overlay = document.getElementById("module-container");
  overlay.classList.add("hidden");
}

function showMinimalNotice(title, message) {
  const existing = document.getElementById('minimalNotice');
  if (existing) {
    existing.remove();
  }

  const notice = document.createElement('div');
  notice.id = 'minimalNotice';
  notice.className = 'minimal-notice';
  notice.innerHTML = `<strong>${title}</strong><span>${message}</span>`;
  document.body.appendChild(notice);

  window.setTimeout(() => notice.classList.add('visible'), 10);
  window.setTimeout(() => {
    notice.classList.remove('visible');
    window.setTimeout(() => notice.remove(), 250);
  }, 2600);
}

// Navigation function for step buttons
window.goToStep = function(step) {
  // Guard: Cannot proceed to step 2+ without consent and all documents
  if (step >= 2) {
    if (!window.consentGiven) {
      showMinimalNotice('Consent required', 'Please consent to the Privacy Policy first.');
      return;
    }
    
    const docsComplete = REQUIRED_DOCUMENTS.every(doc => documentState[doc] === 'complete');
    const kycComplete = documentState.kyc === 'complete';
    
    if (!docsComplete || !kycComplete) {
      const pending = [];
      if (!kycComplete) pending.push('KYC Verification');
      REQUIRED_DOCUMENTS.forEach(doc => {
        if (documentState[doc] !== 'complete') {
          if (doc === 'tillslip') pending.push('Payslip');
          if (doc === 'bankstatement') pending.push('Bank Statement');
        }
      });
      
      const pendingNames = pending.join(', ');
      showMinimalNotice('Documents required', `Please complete: ${pendingNames}`);
      return;
    }
  }
  
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

// Make functions globally accessible
window.loadModule = loadModule;
window.closeModule = closeModule;

function cacheElementReferences() {
  moduleStatusRef = moduleStatusRef || document.getElementById('module-status');
  nextBtnRef = nextBtnRef || document.getElementById('nextBtn');

  documentButtonRefs.tillslip.button = document.getElementById('tillslipBtn');
  documentButtonRefs.tillslip.chip = document.getElementById('tillslipBtnStatus');
  documentButtonRefs.bankstatement.button = document.getElementById('bankstatementBtn');
  documentButtonRefs.bankstatement.chip = document.getElementById('bankstatementBtnStatus');

  if (nextBtnRef) {
    nextBtnRef.disabled = true;
  }
}

function setModuleStatusLoading() {
  if (moduleStatusRef) {
    moduleStatusRef.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Checking your documents...';
  }
}

function showModuleStatusError(message) {
  if (moduleStatusRef) {
    moduleStatusRef.innerHTML = `<i class="fas fa-exclamation-triangle" style="color:#d14343;"></i> ${message}`;
  }
}

function renderModuleStatus() {
  if (!moduleStatusRef) {
    return;
  }

  if (loginRequired) {
    moduleStatusRef.innerHTML = '<i class="fas fa-lock" style="color:#555;"></i> Log in to upload your documents.';
    return;
  }

  const completed = REQUIRED_DOCUMENTS.filter(doc => documentState[doc] === 'complete').length;
  if (completed === REQUIRED_DOCUMENTS.length) {
    moduleStatusRef.innerHTML = '<i class="fas fa-check-circle" style="color:#6b7280;"></i> All required items are complete.';
  } else {
    moduleStatusRef.innerHTML = `<i class="fas fa-info-circle" style="color:#7a7a7a;"></i> ${completed}/${REQUIRED_DOCUMENTS.length} documents ready.`;
  }
}

function updateNextButtonState() {
  nextBtnRef = nextBtnRef || document.getElementById('nextBtn');
  if (!nextBtnRef) {
    return;
  }

  const docsComplete = REQUIRED_DOCUMENTS.every(doc => documentState[doc] === 'complete');
  const kycComplete = documentState.kyc === 'complete';
  const allComplete = docsComplete && kycComplete;
  
  nextBtnRef.disabled = !(window.consentGiven && allComplete);
  
  // Mark step 1 as completed when all documents are ready
  const step1 = document.querySelector('.step.active');
  if (step1 && allComplete && window.consentGiven) {
    step1.classList.add('completed');
  } else if (step1) {
    step1.classList.remove('completed');
  }
}

function updateDocumentButtonState(key, state) {
  const refs = documentButtonRefs[key];
  if (!refs) {
    return;
  }

  const { button, chip } = refs;
  if (!chip) {
    return;
  }

  documentState[key] = state;

  chip.className = 'document-status';
  if (button) {
    button.disabled = false;
    button.classList.remove('completed');
    button.removeAttribute('aria-disabled');
  }

  switch (state) {
    case 'complete':
      chip.textContent = key === 'bankstatement' ? 'Captured' : 'Uploaded';
      chip.classList.add('ready');
      if (button) {
        button.disabled = true;
        button.classList.add('completed');
        button.setAttribute('aria-disabled', 'true');
      }
      break;
    case 'partial':
      chip.textContent = 'Partial';
      chip.classList.add('partial');
      break;
    case 'login':
      chip.textContent = 'Log in first';
      if (button) {
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
      }
      break;
    default:
      chip.textContent = 'Pending';
  }
}

function setLoginRequiredState() {
  loginRequired = true;
  Object.keys(documentButtonRefs).forEach(key => updateDocumentButtonState(key, 'login'));
  renderModuleStatus();
  updateNextButtonState();
}

async function refreshDocumentStatuses(showSpinner = false) {
  if (!documentServices || !activeUserId) return;
  if (showSpinner) setModuleStatusLoading();

  try {
    const [tillSlipExists, bankStatementExists, truidResponse] = await Promise.all([
      documentServices.checkDocumentExistsByUser(activeUserId, 'till_slip'),
      documentServices.checkDocumentExistsByUser(activeUserId, 'bank_statement'),
      fetch(`/api/truid/user/${activeUserId}/status`).then(res => res.ok ? res.json() : null)
    ]);

    // Ensure we have data before trying to save
    if (truidResponse) {
      try {
        const supabase = await getSupabaseClient();
        const { error: upsertError } = await supabase
          .from('truid_collections')
          .upsert({
            user_id: activeUserId,
            collection_id: truidResponse.collectionId || truidResponse.id,
            status: truidResponse.status,
            normalized_status: truidResponse.normalizedStatus || truidResponse.status,
            verified: !!truidResponse.verified,
            collection_payload: truidResponse,
            summary_payload: truidResponse.summary || {},
            updated_at: new Date().toISOString()
          }, { onConflict: 'collection_id' });

        // 400 likely means truid_collections table doesn't exist yet — non-blocking
        if (upsertError && upsertError.code !== '42P01') {
          console.warn('[TruID] Sync warning:', upsertError.message);
        }
      } catch (_) { /* table may not exist yet — non-blocking */ }
    }

    const bankStatementReady = bankStatementExists || !!truidResponse?.verified;

    updateDocumentButtonState('tillslip', tillSlipExists ? 'complete' : 'pending');
    updateDocumentButtonState('bankstatement', bankStatementReady ? 'complete' : 'pending');

    renderModuleStatus();
    updateNextButtonState();
    
  } catch (err) {
    console.error('Error in status sync:', err);
    showModuleStatusError('Unable to sync verification data.');
  }
}

async function initDocumentChecklist() {
  resetDocumentReferences();
  cacheElementReferences();

  if (!moduleStatusRef) {
    return;
  }

  setModuleStatusLoading();

  try {
    detachDocumentUploadedListener();
    const [supabase, docServiceModule] = await Promise.all([
      getSupabaseClient(),
      import('/user-portal/Services/documentService.js')
    ]);

    documentServices = {
      checkDocumentExistsByUser: docServiceModule.checkDocumentExistsByUser,
      checkIdCardExistsByUser: docServiceModule.checkIdCardExistsByUser
    };

    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }

    activeUserId = session?.user?.id || null;

    if (!activeUserId) {
      setLoginRequiredState();
      return;
    }

    await refreshDocumentStatuses(true);

    refreshDocumentsHandler = () => {
      refreshDocumentStatuses(false).catch(err => {
        console.error('Failed to refresh document statuses:', err);
      });
    };

    window.addEventListener('document:uploaded', refreshDocumentsHandler);
  } catch (err) {
    console.error('Failed to initialize document checklist:', err);
    showModuleStatusError('Unable to retrieve document status.');
  }
}

// ═══════════════════════════════════════════════════════════
//  DECLARATIONS POPUP — show / hide / save / check
// ═══════════════════════════════════════════════════════════

function showDeclarationsPopup() {
  const overlay = document.getElementById('declarations-popup-overlay');
  if (overlay) {
    loadPopupPrefillData().catch((error) => {
      console.error('Failed to prefill popup data:', error);
    });
    overlay.classList.remove('hidden');
  }
}

function hideDeclarationsPopup(clearPending = true) {
  const overlay = document.getElementById('declarations-popup-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
  if (clearPending) {
    pendingActionAfterDeclarations = null;
  }
}

function initDeclarationsPopup() {
  // Close button
  const closeBtn = document.getElementById('closeDeclarationsPopup');
  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.addEventListener('click', () => hideDeclarationsPopup(true));
    closeBtn.dataset.bound = 'true';
  }

  // Close on overlay click (outside popup)
  const overlay = document.getElementById('declarations-popup-overlay');
  if (overlay && !overlay.dataset.bound) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        hideDeclarationsPopup(true);
      }
    });
    overlay.dataset.bound = 'true';
  }

  // Referral toggle
  const referralRadios = document.querySelectorAll('input[name="popup_referral"]');
  referralRadios.forEach(r => {
    if (!r.dataset.bound) {
      r.addEventListener('change', () => {
        const fields = document.getElementById('popup-referral-fields');
        if (fields) {
          fields.style.display = r.value === 'yes' && r.checked ? 'flex' : 'none';
        }
      });
      r.dataset.bound = 'true';
    }
  });

  // Form submit
  const form = document.getElementById('popup-declarations-form');
  if (form && !form.dataset.bound) {
    form.addEventListener('submit', handlePopupDeclarationsSave);
    form.dataset.bound = 'true';
  }
}

async function loadPopupPrefillData() {
  const supabase = await getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return;
  }

  const userId = session.user.id;
  const [profileResult, financialResult, declarationResult] = await Promise.all([
    supabase.from('profiles').select('identity_number').eq('id', userId).maybeSingle(),
    supabase.from('financial_profiles').select('monthly_income, affordability_ratio, parsed_data').eq('user_id', userId).maybeSingle(),
    supabase.from('declarations').select('*').eq('user_id', userId).maybeSingle()
  ]);

  const profileData = profileResult.data || {};
  const financialData = financialResult.data || {};
  const declarationData = declarationResult.data || {};

  const parseMaybeJson = (value) => {
    if (!value || typeof value !== 'string') {
      return null;
    }
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

  const metadataDeclarations = declarationData?.metadata && typeof declarationData.metadata === 'object'
    ? declarationData.metadata
    : {};
  const authMetadataDeclarations = parseMaybeJson(session?.user?.user_metadata?.declarations) || {};

  const resolvedDeclarations = {
    ...authMetadataDeclarations,
    ...metadataDeclarations,
    ...declarationData
  };

  const setValue = (id, value) => {
    const element = document.getElementById(id);
    if (element) {
      element.value = value ?? '';
    }
  };

  // Reset possible stale state first (popup can be opened multiple times)
  document.querySelectorAll('input[name="popup_hd_status"]').forEach((input) => { input.checked = false; });
  document.querySelectorAll('input[name="popup_home_ownership"]').forEach((input) => { input.checked = false; });
  document.querySelectorAll('input[name="popup_marital_status"]').forEach((input) => { input.checked = false; });
  document.querySelectorAll('input[name="popup_referral"]').forEach((input) => { input.checked = false; });

  setValue('popup_identity_number', profileData.identity_number || session.user.user_metadata?.identity_number || session.user.user_metadata?.id_number || '');
  setValue('popup_first_name', profileData.first_name || '');
  setValue('popup_last_name', profileData.last_name || '');
  setValue('popup_gender', (profileData.gender || '').toUpperCase());
  setValue('popup_date_of_birth', profileData.date_of_birth ? String(profileData.date_of_birth).substring(0, 10) : '');
  setValue('popup_address', profileData.address || '');
  setValue('popup_postal_code', profileData.postal_code || '');
  setValue('popup_suburb_area', profileData.suburb_area || '');
  setValue('popup_cell_tel_no', profileData.cell_tel_no || profileData.contact_number || '');

  const parsedFinancial = financialData.parsed_data || {};
  const incomeData = parsedFinancial.income || {};
  const expenseData = parsedFinancial.expenses || {};

  setValue('popup_income_salary', incomeData.salary ?? financialData.monthly_income ?? '');
  setValue('popup_income_other', incomeData.other_monthly_earnings ?? '');
  setValue('popup_expense_housing', expenseData.housing_rent ?? financialData.monthly_expenses ?? '');
  setValue('popup_expense_school', expenseData.school ?? '');
  setValue('popup_expense_maintenance', expenseData.maintenance ?? '');
  setValue('popup_expense_petrol', expenseData.petrol ?? '');
  setValue('popup_expense_groceries', expenseData.groceries ?? '');
  setValue('popup_expense_other', expenseData.other ?? '');

  const checkRadio = (name, value) => {
    if (!value && value !== false) {
      return;
    }
    const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (radio) {
      radio.checked = true;
    }
  };

  if (resolvedDeclarations.historically_disadvantaged === true) checkRadio('popup_hd_status', 'yes');
  if (resolvedDeclarations.historically_disadvantaged === false) checkRadio('popup_hd_status', 'no');
  checkRadio('popup_home_ownership', resolvedDeclarations.home_ownership || '');
  checkRadio('popup_marital_status', resolvedDeclarations.marital_status || '');
  checkRadio('popup_referral', resolvedDeclarations.referral_provided === true ? 'yes' : 'no');

  const stdCheckbox = document.getElementById('popup_std_conditions');
  if (stdCheckbox) {
    stdCheckbox.checked = resolvedDeclarations.accepted_std_conditions === true;
  }

  const qualificationSelect = document.getElementById('popup_highest_qualification');
  if (qualificationSelect) {
    qualificationSelect.value = resolvedDeclarations.highest_qualification || '';
  }

  setValue('popup_referral_name', resolvedDeclarations.referral_name || '');
  setValue('popup_referral_phone', resolvedDeclarations.referral_phone || '');

  const referralFields = document.getElementById('popup-referral-fields');
  if (referralFields) {
    referralFields.style.display = resolvedDeclarations.referral_provided ? 'flex' : 'none';
  }
}

function clearPopupRequiredMarkers() {
  document.querySelectorAll('.popup-required-missing').forEach((node) => {
    node.classList.remove('popup-required-missing');
  });
}

function showPopupAllRequiredMessage(targetElement) {
  if (targetElement) {
    targetElement.classList.add('popup-required-missing');
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof targetElement.focus === 'function') {
      targetElement.focus({ preventScroll: true });
    }
  }

  if (typeof window.showToast === 'function') {
    window.showToast('Required', 'All fields are required. Please complete every field to continue.', 'warning');
  } else {
    showMinimalNotice('Required', 'All fields are required. Please complete every field to continue.');
  }
}

async function handlePopupDeclarationsSave(e) {
  e.preventDefault();

  const btn = document.getElementById('popup-save-declarations');
  if (!btn) return;
  const origHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  // Collect values
  const hdStatus = document.querySelector('input[name="popup_hd_status"]:checked')?.value || '';
  const acceptedStd = document.getElementById('popup_std_conditions')?.checked || false;
  const homeOwnership = document.querySelector('input[name="popup_home_ownership"]:checked')?.value || '';
  const maritalStatus = document.querySelector('input[name="popup_marital_status"]:checked')?.value || '';
  const highestQualification = document.getElementById('popup_highest_qualification')?.value || '';
  const referralProvided = document.querySelector('input[name="popup_referral"]:checked')?.value === 'yes';
  const referralName = document.getElementById('popup_referral_name')?.value.trim() || null;
  const referralPhone = document.getElementById('popup_referral_phone')?.value.trim() || null;
  const identityNumber = document.getElementById('popup_identity_number')?.value.trim() || null;
  const firstName = document.getElementById('popup_first_name')?.value.trim() || null;
  const lastName = document.getElementById('popup_last_name')?.value.trim() || null;
  const gender = document.getElementById('popup_gender')?.value || null;
  const dateOfBirth = document.getElementById('popup_date_of_birth')?.value || null;
  const streetAddress = document.getElementById('popup_address')?.value.trim() || null;
  const postalCode = document.getElementById('popup_postal_code')?.value.trim() || null;
  const suburbArea = document.getElementById('popup_suburb_area')?.value.trim() || null;
  const cellTelNo = document.getElementById('popup_cell_tel_no')?.value.trim() || null;

  // Purpose of loan
  const loanPurpose = document.getElementById('popup_loan_purpose')?.value?.trim() || '';

  // Income only — expenses removed per business decision
  const incomeSalary = parseFloat(document.getElementById('popup_income_salary')?.value) || 0;
  const incomeOther  = parseFloat(document.getElementById('popup_income_other')?.value) || 0;
  const totalIncome  = incomeSalary + incomeOther;
  const totalExpenses = 0; // expenses not collected

  // Next of Kin
  const nokName         = document.getElementById('popup_nok_name')?.value?.trim() || '';
  const nokPhone        = document.getElementById('popup_nok_phone')?.value?.trim() || '';
  const nokRelationship = document.getElementById('popup_nok_relationship')?.value?.trim() || '';

  clearPopupRequiredMarkers();

  const requiredChecks = [
    { valid: !!identityNumber,  element: document.getElementById('popup_identity_number') },
    { valid: !!firstName,       element: document.getElementById('popup_first_name') },
    { valid: !!lastName,        element: document.getElementById('popup_last_name') },
    { valid: !!gender,          element: document.getElementById('popup_gender') },
    { valid: !!dateOfBirth,     element: document.getElementById('popup_date_of_birth') },
    { valid: !!streetAddress,   element: document.getElementById('popup_address') },
    { valid: !!postalCode,      element: document.getElementById('popup_postal_code') },
    { valid: !!loanPurpose,     element: document.getElementById('popup_loan_purpose') },
    { valid: incomeSalary > 0,  element: document.getElementById('popup_income_salary') },
    { valid: !!nokName,         element: document.getElementById('popup_nok_name') },
    { valid: !!nokPhone,        element: document.getElementById('popup_nok_phone') },
    { valid: !!nokRelationship, element: document.getElementById('popup_nok_relationship') },
    { valid: !!hdStatus,        element: document.querySelector('input[name="popup_hd_status"]') },
    { valid: !!homeOwnership,   element: document.querySelector('input[name="popup_home_ownership"]') },
    { valid: !!maritalStatus,   element: document.querySelector('input[name="popup_marital_status"]') },
    { valid: !!highestQualification, element: document.getElementById('popup_highest_qualification') },
    { valid: !!document.querySelector('input[name="popup_referral"]:checked'), element: document.querySelector('input[name="popup_referral"]') },
    { valid: !referralProvided || !!referralName,  element: document.getElementById('popup_referral_name') },
    { valid: !referralProvided || !!referralPhone, element: document.getElementById('popup_referral_phone') },
    { valid: acceptedStd, element: document.getElementById('popup_std_conditions') }
  ];

  const firstMissing = requiredChecks.find(check => !check.valid);
  if (firstMissing) {
    showPopupAllRequiredMessage(firstMissing.element);
    btn.disabled = false;
    btn.innerHTML = origHTML;
    return;
  }

  if (totalIncome <= 0) {
    showPopupAllRequiredMessage(document.getElementById('popup_income_salary'));
    btn.disabled = false;
    btn.innerHTML = origHTML;
    return;
  }

  const declarations = {
    historically_disadvantaged: hdStatus,
    accepted_std_conditions: acceptedStd,
    home_ownership: homeOwnership,
    marital_status: maritalStatus,
    highest_qualification: highestQualification,
    referral_provided: referralProvided,
    referral_name: referralProvided ? referralName : null,
    referral_phone: referralProvided ? referralPhone : null
  };

  try {
    const supabase = await getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      throw new Error('Not authenticated');
    }

    const userId = session.user.id;

    // Check for duplicate ID number on another account
    if (identityNumber) {
      const { data: dupProfiles, error: dupErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('identity_number', identityNumber)
        .neq('id', userId);
      if (!dupErr && dupProfiles && dupProfiles.length > 0) {
        showDuplicateIdError();
        btn.disabled = false;
        btn.innerHTML = origHTML;
        return;
      }
    }

    const profilePayload = {
        first_name:       firstName,
        last_name:        lastName,
        identity_number:  identityNumber,
        gender,
        date_of_birth:    dateOfBirth,
        address:          streetAddress,
        postal_code:      postalCode,
        suburb_area:      suburbArea,
        cell_tel_no:      cellTelNo,
        contact_number:   cellTelNo || null,
        full_name:        [firstName, lastName].filter(Boolean).join(' ') || null,
        // Next of Kin
        nok_name:         nokName         || null,
        nok_phone:        nokPhone        || null,
        nok_relationship: nokRelationship || null,
        updated_at: new Date().toISOString()
    };

    // Store loan purpose in sessionStorage so confirmation.js can attach it
    if (loanPurpose) sessionStorage.setItem('pendingLoanPurpose', loanPurpose);

    const { error: profileErr } = await supabase
      .from('profiles')
      .update(profilePayload)
      .eq('id', userId);

    if (profileErr) throw profileErr;

    let affordabilityRatio = null;
    let maxLoanAmount = null;
    try {
      const affordabilityResponse = await fetch('/api/calculate-affordability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthly_income: totalIncome,
          affordability_percent: 20,
          annual_interest_rate: 20,
          loan_term_months: 1
        })
      });
      const affordabilityData = await affordabilityResponse.json();
      affordabilityRatio = totalIncome > 0 ? affordabilityData.max_monthly_payment?.toFixed(2) : null;
      maxLoanAmount = totalIncome > 0 ? affordabilityData.max_loan_amount?.toFixed(2) : null;
    } catch (error) {
      const fallbackThreshold = totalIncome * 0.20;
      affordabilityRatio = totalIncome > 0 ? fallbackThreshold.toFixed(2) : null;
      const monthlyRate = (0.20 / 12);
      const fallbackMaxLoan = fallbackThreshold * ((1 - Math.pow(1 + monthlyRate, -1)) / monthlyRate);
      maxLoanAmount = totalIncome > 0 ? fallbackMaxLoan.toFixed(2) : null;
    }

    const financialPayload = {
      user_id: userId,
      monthly_income: totalIncome,
      affordability_ratio: affordabilityRatio,
      max_loan_amount: maxLoanAmount,
      parsed_data: {
        income: {
          salary: incomeSalary,
          other_monthly_earnings: incomeOther
        }
      }
    };

    const { data: existingFinancial } = await supabase
      .from('financial_profiles')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    let financialError = null;
    if (existingFinancial?.user_id) {
      const updateResult = await supabase
        .from('financial_profiles')
        .update(financialPayload)
        .eq('user_id', userId);
      financialError = updateResult.error;
    } else {
      const insertResult = await supabase
        .from('financial_profiles')
        .insert([financialPayload]);
      financialError = insertResult.error;
    }

    if (financialError) throw financialError;

    // Upsert into declarations table (same shape as profile.js)
    const payload = {
      user_id: userId,
      historically_disadvantaged: hdStatus === 'yes',
      accepted_std_conditions: acceptedStd,
      home_ownership: homeOwnership || null,
      marital_status: maritalStatus || null,
      highest_qualification: highestQualification || null,
      referral_provided: referralProvided,
      referral_name: referralProvided ? referralName : null,
      referral_phone: referralProvided ? referralPhone : null,
      metadata: declarations,
      updated_at: new Date().toISOString()
    };

    const { error: declErr } = await supabase
      .from('declarations')
      .upsert([payload], { onConflict: 'user_id' });

    if (declErr) throw declErr;

    // Also update auth user metadata as backup
    await supabase.auth.updateUser({ data: { declarations: JSON.stringify(declarations) } });

    // Update global profile state so other pages know declarations are done
    if (window.globalUserProfile) {
      window.globalUserProfile.first_name = firstName;
      window.globalUserProfile.last_name = lastName;
      window.globalUserProfile.identity_number = identityNumber;
      window.globalUserProfile.gender = gender;
      window.globalUserProfile.date_of_birth = dateOfBirth;
      window.globalUserProfile.address = streetAddress;
      window.globalUserProfile.postal_code = postalCode;
      window.globalUserProfile.suburb_area = suburbArea;
      window.globalUserProfile.cell_tel_no = cellTelNo;
      window.globalUserProfile.contact_number = cellTelNo || window.globalUserProfile.contact_number;
      window.globalUserProfile.full_name = [firstName, lastName].filter(Boolean).join(' ') || window.globalUserProfile.full_name;
      window.globalUserProfile.hasDeclarations = true;
      window.globalUserProfile.hasFinancialProfile = totalIncome > 0;
      window.globalUserProfile.declarations = declarations;
      window.globalUserProfile.isProfileComplete = (window.globalUserProfile.hasFinancialProfile === true) && true;

      // If profile is now fully complete, unlock sidebar
      if (window.globalUserProfile.isProfileComplete && typeof window.unlockSidebar === 'function') {
        window.unlockSidebar();
      }
    }

    // Mark all popup-required items as completed locally
    declarationsCompleted = !!identityNumber && totalIncome > 0 && acceptedStd === true;

    const action = pendingActionAfterDeclarations;
    pendingActionAfterDeclarations = null;

    // Close popup
    hideDeclarationsPopup(false);

    // Show success
    if (typeof window.showToast === 'function') {
      window.showToast('Declarations Saved', 'Your declarations have been saved to your profile.', 'success');
    } else {
      showMinimalNotice('Saved', 'Declarations saved successfully.');
    }

    // Execute pending action (e.g. activate consent + open module)
    if (action) {
      action();
    }
  } catch (err) {
    console.error('Failed to save declarations from popup:', err);
    const isDuplicateId = err?.code === '23505' && /identity_number/i.test(err?.message || '');
    if (isDuplicateId) {
      showDuplicateIdError();
    } else if (typeof window.showToast === 'function') {
      window.showToast('Error', 'Failed to save declarations. Please try again.', 'error');
    } else {
      showMinimalNotice('Error', 'Failed to save. Please try again.');
    }
    btn.disabled = false;
    btn.innerHTML = origHTML;
  }
}

function showDuplicateIdError() {
  const idEl = document.getElementById('popup_identity_number');
  if (idEl) {
    idEl.classList.add('popup-required-missing');
    let errEl = document.getElementById('popup_identity_number_error');
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.id = 'popup_identity_number_error';
      errEl.style.cssText = 'color: #d32f2f; background: #ffebee; border: 1px solid #ef9a9a; border-radius: 6px; padding: 8px 12px; margin-top: 6px; font-size: 13px; font-weight: 600; line-height: 1.4;';
      errEl.textContent = '⚠️ This ID number is already registered on another account. Please use a different ID number.';
      idEl.parentNode?.insertBefore(errEl, idEl.nextSibling);
    }
    idEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    try { idEl.focus({ preventScroll: true }); } catch (_) {}
    const removeOnInput = () => {
      errEl?.remove();
      idEl.classList.remove('popup-required-missing');
      idEl.removeEventListener('input', removeOnInput);
    };
    idEl.addEventListener('input', removeOnInput);
  }
  if (typeof window.showToast === 'function') {
    window.showToast('Duplicate ID', 'This ID number is already registered on another account.', 'error', 5000);
  }
}

let declarationsStatusPromise = null;
async function checkDeclarationsStatus() {
  // Reuse an in-flight check so multiple callers await the same network round-trip.
  if (declarationsStatusPromise) return declarationsStatusPromise;
  declarationsStatusPromise = (async () => {
    try {
      const supabase = await getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return declarationsCompleted;

      const userId = session.user.id;
      const [profileResult, financialResult, declarationResult] = await Promise.all([
        supabase.from('profiles').select('identity_number, first_name, last_name, gender, date_of_birth, address, postal_code').eq('id', userId).maybeSingle(),
        supabase.from('financial_profiles').select('monthly_income').eq('user_id', userId).maybeSingle(),
        supabase.from('declarations').select('accepted_std_conditions').eq('user_id', userId).maybeSingle()
      ]);

      const hasId = !!profileResult?.data?.identity_number;
      const hasExperianProfile = !!(
        profileResult?.data?.first_name
        && profileResult?.data?.last_name
        && profileResult?.data?.gender
        && profileResult?.data?.date_of_birth
        && profileResult?.data?.address
        && profileResult?.data?.postal_code
      );
      const hasFinancial = (Number(financialResult?.data?.monthly_income) || 0) > 0;
      const hasStdConditions = declarationResult?.data?.accepted_std_conditions === true;

      declarationsCompleted = hasId && hasExperianProfile && hasFinancial && hasStdConditions;
    } catch (err) {
      console.error('Failed to check declarations status:', err);
      // Don't flip to false on transient errors — keep last known good state.
    } finally {
      // Allow next call to refresh from the server
      setTimeout(() => { declarationsStatusPromise = null; }, 0);
    }
    return declarationsCompleted;
  })();
  return declarationsStatusPromise;
}

// Ensure declarations status is fresh before deciding whether to show the popup.
// This closes the race where a click happens before the initial async check resolves.
async function ensureDeclarationsKnown() {
  if (declarationsCompleted) return true;
  await checkDeclarationsStatus();
  return declarationsCompleted;
}

// ═══════════════════════════════════════════════════════════

function bootApplyLoanPage() {
  // Check if declarations are already completed
  checkDeclarationsStatus();
  // Set up popup interactions
  initDeclarationsPopup();

  initDocumentChecklist();
  initKycButton().catch(err => {
    console.error('Failed to initialize KYC button:', err);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApplyLoanPage, { once: true });
} else {
  bootApplyLoanPage();
}

window.addEventListener('pageLoaded', (event) => {
  const pageName = event?.detail?.pageName;
  if (pageName === APPLY_LOAN_PAGE) {
    resetDocumentStateFlags();
    checkDeclarationsStatus();
    initDeclarationsPopup();
    initDocumentChecklist();
    initKycButton().catch(err => {
      console.error('Failed to initialize KYC button after SPA navigation:', err);
    });
  } else {
    detachDocumentUploadedListener();
    // Clean up KYC polling when leaving the page
    if (kycStatusInterval) {
      clearInterval(kycStatusInterval);
      kycStatusInterval = null;
    }
  }
});
