// User Portal Profile Page (full profile  management)
import '/user-portal/Services/sessionGuard.js'; // Production auth guard

let supabase;
let currentUserProfile = null;
let currentFinancialProfile = null;
let isUploading = false;

// Centralized handler to flip completion flags and unlock navigation once
function handleProfileCompletionUnlock(hasFinancial = false, hasDeclarations = false) {
  const completionAchieved = Boolean(hasFinancial && hasDeclarations);
  const wasIncomplete = !currentUserProfile?.isProfileComplete;

  if (currentUserProfile) {
    currentUserProfile.isProfileComplete = completionAchieved;
  }

  if (window.globalUserProfile) {
    window.globalUserProfile.hasFinancialProfile = hasFinancial;
    window.globalUserProfile.hasDeclarations = hasDeclarations;
    window.globalUserProfile.isProfileComplete = completionAchieved;
  }

  if (!completionAchieved || !wasIncomplete) {
    return;
  }

  if (typeof window.unlockSidebar === 'function') {
    window.unlockSidebar();
  }

  // Small delay lets the success toast breathe before redirecting
  setTimeout(() => {
    if (typeof window.loadPage === 'function') {
      window.loadPage('dashboard');
    } else {
      window.location.href = '/user-portal/?page=dashboard';
    }
  }, 400);
}

// --- Theme-aware helpers ---
const getThemeColor = (variableName, fallback) => {
  try {
    const root = document?.documentElement;
    if (!root) return fallback;
    const value = getComputedStyle(root).getPropertyValue(variableName);
    return value?.trim() || fallback;
  } catch (error) {
    console.warn('Unable to resolve theme color for', variableName, error);
    return fallback;
  }
};

const getInitials = (name = '') => {
  const cleaned = name.trim();
  if (!cleaned) return 'U';
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('') || 'U';
};

const buildAvatarPlaceholder = (displayName, { useGradient = false } = {}) => {
  const primary = getThemeColor('--color-primary', '#E7762E');
  const secondary = getThemeColor('--color-secondary', '#F97316');
  const initials = getInitials(displayName);
  const gradientDef = useGradient
    ? `<defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primary}" />
      <stop offset="100%" stop-color="${secondary}" />
    </linearGradient>
  </defs>`
    : '';
  const rectFill = useGradient ? 'url(#grad)' : primary;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  ${gradientDef}
  <rect width="256" height="256" rx="128" ry="128" fill="${rectFill}" />
  <text x="50%" y="58%" text-anchor="middle" font-size="96" fill="#ffffff" font-family="'Inter', 'Segoe UI', sans-serif" font-weight="700">${initials}</text>
</svg>`;
  try {
    const encoded = btoa(unescape(encodeURIComponent(svg)));
    return `data:image/svg+xml;base64,${encoded}`;
  } catch (error) {
    console.warn('Falling back to static avatar placeholder', error);
    const hex = primary.replace('#', '') || 'E7762E';
    return `https://ui-avatars.com/api/?name=${initials}&background=${hex}&color=fff`;
  }
};

const getAvatarAsset = (profile) => {
  const displayName = profile?.full_name || 'User';
  if (profile?.avatar_url) {
    return {
      url: `${profile.avatar_url}?t=${new Date().getTime()}`,
      isPlaceholder: false,
      hoverUrl: null
    };
  }
  return {
    url: buildAvatarPlaceholder(displayName, { useGradient: false }),
    hoverUrl: buildAvatarPlaceholder(displayName, { useGradient: true }),
    isPlaceholder: true
  };
};

const setupAvatarPlaceholderHover = (asset) => {
  const avatarImg = document.getElementById('avatar-preview');
  const avatarContainer = avatarImg?.closest('.avatar-container');
  if (!avatarImg || !avatarContainer) {
    return;
  }

  // Reset previous handlers
  avatarContainer.onmouseenter = null;
  avatarContainer.onmouseleave = null;

  if (!asset?.isPlaceholder) {
    avatarImg.removeAttribute('data-placeholder-base');
    avatarImg.removeAttribute('data-placeholder-hover');
    return;
  }

  avatarImg.dataset.placeholderBase = asset.url;
  avatarImg.dataset.placeholderHover = asset.hoverUrl || asset.url;

  avatarContainer.onmouseenter = () => {
    const hoverSrc = avatarImg.dataset.placeholderHover || avatarImg.dataset.placeholderBase;
    if (hoverSrc) {
      avatarImg.src = hoverSrc;
    }
  };

  avatarContainer.onmouseleave = () => {
    if (avatarImg.dataset.placeholderBase) {
      avatarImg.src = avatarImg.dataset.placeholderBase;
    }
  };
};

// --- Helper Functions ---
function formatCurrency(amount) {
  if (amount == null) return 'N/A';
  return 'R ' + Number(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 });
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
}

const getAvatarUrl = (profile) => {
  const asset = getAvatarAsset(profile);
  return asset.url;
};

const getRoleBadge = (role) => {
  const roleMap = {
    'super_admin': 'background: #FEE2E2; color: #991B1B;',
    'admin': 'background: #DBEAFE; color: #1E40AF;',
    'base_admin': 'background: #FEF3C7; color: #92400E;',
    'borrower': 'background: #F3F4F6; color: #1F2937;'
  };
  return roleMap[role] || roleMap['borrower'];
};

// --- Tab Rendering Functions ---
function renderProfileTab() {
  console.log('🎨 Rendering Profile Tab with data:', currentUserProfile);
  
  const content = document.getElementById('settings-content');
  if (!content) {
    console.error('❌ settings-content element not found');
    return;
  }
  
  if (!currentUserProfile) {
    console.error('❌ currentUserProfile is null');
    content.innerHTML = '<div style="color: white; padding: 2rem;">Loading profile data...</div>';
    return;
  }
  
  const roleClass = `role-${(currentUserProfile.role || 'borrower').replace('_', '-')}`;
  const avatarAsset = getAvatarAsset(currentUserProfile);
  
  content.innerHTML = `
    <div class="section-header">
      <h3>My Profile</h3>
      <p>Manage your personal account details and information</p>
    </div>
    
    <div class="inner-card">
      <form id="profile-form">
        <!-- Avatar Upload Section -->
        <div class="avatar-section">
          <div class="avatar-container">
            <img id="avatar-preview" src="${avatarAsset.url}" alt="Profile" class="avatar-preview" data-is-placeholder="${avatarAsset.isPlaceholder}" data-placeholder-hover="${avatarAsset.hoverUrl || ''}">
            <label for="avatar-upload" class="avatar-overlay">
              <i class="fa-solid fa-camera"></i>
            </label>
            <input type="file" id="avatar-upload" style="display: none;" accept="image/png, image/jpeg, image/jpg, image/gif">
            <div id="avatar-spinner" class="avatar-spinner">
              <i class="fa-solid fa-spinner fa-spin"></i>
            </div>
          </div>
          <div class="avatar-info">
            <h4>${currentUserProfile.full_name || 'No Name Set'}</h4>
            <p>${currentUserProfile.email || 'No Email'}</p>
            <span class="role-badge ${roleClass}">
              ${(currentUserProfile.role || 'borrower').replace(/_/g, ' ')}
            </span>
          </div>
        </div>
        
        <!-- Personal Details Form -->
        <div class="form-grid">
          <div class="form-group">
            <label for="first_name">First Name</label>
            <input type="text" id="first_name" value="${currentUserProfile.first_name || ''}" placeholder="Enter your first name" required>
          </div>
          <div class="form-group">
            <label for="last_name">Surname</label>
            <input type="text" id="last_name" value="${currentUserProfile.last_name || ''}" placeholder="Enter your surname" required>
          </div>
          <div class="form-group">
            <label for="full_name">Full Name</label>
            <input type="text" id="full_name" value="${currentUserProfile.full_name || ''}" placeholder="Enter your full name" required>
          </div>
          <div class="form-group">
            <label for="email">Email Address</label>
            <input type="email" id="email" value="${currentUserProfile.email || ''}" placeholder="your@email.com" disabled>
          </div>
          <div class="form-group">
            <label for="contact_number">Contact Number</label>
            <input type="text" id="contact_number" value="${currentUserProfile.contact_number || ''}" placeholder="+27 XX XXX XXXX">
          </div>
          <div class="form-group">
            <label for="identity_number">ID Number</label>
            <input type="text" id="identity_number" value="${currentUserProfile.identity_number || ''}" placeholder="Enter your SA ID number" maxlength="20" autocomplete="off">
          </div>
          <div class="form-group">
            <label for="gender">Gender</label>
            <select id="gender">
              <option value="">Select gender</option>
              <option value="M" ${(currentUserProfile.gender || '').toUpperCase() === 'M' ? 'selected' : ''}>Male</option>
              <option value="F" ${(currentUserProfile.gender || '').toUpperCase() === 'F' ? 'selected' : ''}>Female</option>
            </select>
          </div>
          <div class="form-group">
            <label for="date_of_birth">Date of Birth</label>
            <input type="date" id="date_of_birth" value="${currentUserProfile.date_of_birth ? String(currentUserProfile.date_of_birth).substring(0, 10) : ''}">
          </div>
          <div class="form-group">
            <label for="address">Street Address</label>
            <input type="text" id="address" value="${currentUserProfile.address || ''}" placeholder="Street address">
          </div>
          <div class="form-group">
            <label for="postal_code">Postal Code</label>
            <input type="text" id="postal_code" value="${currentUserProfile.postal_code || ''}" placeholder="e.g. 0123" maxlength="4">
          </div>
          <div class="form-group">
            <label for="suburb_area">Suburb / Area</label>
            <input type="text" id="suburb_area" value="${currentUserProfile.suburb_area || ''}" placeholder="Suburb or area">
          </div>
          <div class="form-group">
            <label for="cell_tel_no">Cell Phone Number</label>
            <input type="text" id="cell_tel_no" value="${currentUserProfile.cell_tel_no || currentUserProfile.contact_number || ''}" placeholder="e.g. 0821234567" maxlength="10">
          </div>
          <div class="form-group">
            <label for="user_id">User ID</label>
            <input type="text" id="user_id" value="${currentUserProfile.id || ''}" disabled>
          </div>
        </div>
        
        <div class="info-message">
          <i class="fa-solid fa-info-circle"></i>
          <span>Your profile information is securely stored and can be updated at any time.</span>
        </div>
        
        <div class="btn-container">
          <button type="submit" id="save-profile-btn" class="btn-primary">
            <i class="fa-solid fa-save"></i> Save Changes
          </button>
        </div>
      </form>
    </div>
  `;
  
  // Attach form listeners
  document.getElementById('profile-form').addEventListener('submit', handleProfileUpdate);
  document.getElementById('avatar-upload').addEventListener('change', handleAvatarUpload);
  setupAvatarPlaceholderHover(avatarAsset);
}

async function loadAffordabilityStatus() {
  try {
    const response = await fetch(`/api/experian/affordability-status/${currentUserProfile.id}`);
    const { success, status } = await response.json();

    if (!success || !status) return;

    const container = document.getElementById('affordability-status-container');
    if (!container) return;

    if (!status.eligible && status.can_view_reason) {
      // Fetch detailed decline reason information
      const declineResponse = await fetch(`/api/experian/decline-reason/${currentUserProfile.id}`);
      const declineData = await declineResponse.json();

      let detailedMessage = declineData.message || status.decline_reason;
      let recommendation = declineData.recommendation || 'Please update your financial information and reapply.';

      container.innerHTML = `
        <div class="inner-card" style="border-left: 4px solid #ef4444;">
          <div style="display: flex; align-items: flex-start; gap: 1rem;">
            <i class="fa-solid fa-circle-exclamation" style="font-size: 2rem; color: #ef4444; flex-shrink: 0; margin-top: 0.25rem;"></i>
            <div style="flex: 1;">
              <h4 style="color: #ef4444; margin-bottom: 0.5rem;">Application Not Approved</h4>
              <p style="margin-bottom: 0.75rem; color: #7f1d1d; font-weight: 500;">
                ${detailedMessage}
              </p>
              <div style="background-color: #fef2f2; border-left: 3px solid #fca5a5; padding: 0.75rem; border-radius: 0.25rem; margin-bottom: 0.75rem;">
                <p style="margin: 0; color: #7f1d1d; font-size: 0.95rem;">
                  <i class="fa-solid fa-lightbulb" style="margin-right: 0.5rem;"></i>
                  <strong>What you can do:</strong> ${recommendation}
                </p>
              </div>
              <p style="color: #9ca3af; font-size: 0.9rem; margin: 0;">
                <i class="fa-solid fa-circle-info"></i>
                Contact our support team for assistance
              </p>
            </div>
          </div>
        </div>
      `;
    } else if (status.eligible && status.source === 'experian') {
      container.innerHTML = `
        <div class="inner-card" style="border-left: 4px solid #10b981;">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <i class="fa-solid fa-circle-check" style="font-size: 2rem; color: #10b981;"></i>
            <div>
              <h4 style="color: #10b981; margin-bottom: 0.5rem;">Affordability Verified</h4>
              <p style="margin-bottom: 0.25rem; color: #047857;">✓ Your financial profile meets lending requirements</p>
              <p style="color: #9ca3af; font-size: 0.9rem;">Reference: ${status.reference || 'N/A'}</p>
            </div>
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading affordability status:', error);
  }
}

function renderFinancialTab() {
  console.log('💰 Rendering Financial Tab');
  
  const content = document.getElementById('settings-content');
  if (!content) {
    console.error('❌ settings-content element not found');
    return;
  }
  
  if (!currentUserProfile) {
    console.error('❌ currentUserProfile is null');
    content.innerHTML = '<div style="color: white; padding: 2rem;">Loading profile data...</div>';
    return;
  }
  
  // Parse existing financial data or initialize defaults
  const financialData = currentFinancialProfile?.parsed_data || {
    income: {
      salary: 0,
      other_monthly_earnings: 0
    },
    expenses: {
      housing_rent: 0,
      school: 0,
      maintenance: 0,
      petrol: 0,
      groceries: 0,
      other: 0
    }
  };
  
  const totalIncome = (parseFloat(financialData.income.salary) || 0) + 
                      (parseFloat(financialData.income.other_monthly_earnings) || 0);
  
  const totalExpenses = (parseFloat(financialData.expenses.housing_rent) || 0) +
                        (parseFloat(financialData.expenses.school) || 0) +
                        (parseFloat(financialData.expenses.maintenance) || 0) +
                        (parseFloat(financialData.expenses.petrol) || 0) +
                        (parseFloat(financialData.expenses.groceries) || 0) +
                        (parseFloat(financialData.expenses.other) || 0);
  
  const disposableIncome = totalIncome - totalExpenses;
  
  // Calculate affordability threshold using amortized loan formula
  let affordabilityThreshold = totalIncome * 0.20; // Default fallback (20%)
  let displayAmount = Math.max(disposableIncome, affordabilityThreshold);
  let displayLabel = disposableIncome > affordabilityThreshold 
    ? "Disposable Income" 
    : "Affordability Threshold (20%)";
  
  // Fetch calculated affordability from backend (async, will update on load)
  if (totalIncome > 0) {
    fetch('/api/calculate-affordability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        monthly_income: totalIncome,
        affordability_percent: 20,
        annual_interest_rate: 20,
        loan_term_months: 6
      })
    })
    .then(res => res.json())
    .then(data => {
      affordabilityThreshold = data.max_monthly_payment;
      displayAmount = Math.max(disposableIncome, affordabilityThreshold);
      displayLabel = disposableIncome > affordabilityThreshold 
        ? "Disposable Income" 
        : "Affordability Threshold (20%)";
      
      // Update display after calculation
      const displayElem = document.getElementById('disposable-income-display');
      const labelElem = displayElem?.previousElementSibling;
      if (displayElem) {
        displayElem.textContent = `R ${displayAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
      }
      if (labelElem?.classList.contains('summary-label-large')) {
        labelElem.textContent = displayLabel;
      }
    })
    .catch(err => console.error('Affordability calculation error:', err));
  }
  
  content.innerHTML = `
    <div class="section-header">
      <h3><i class="fa-solid fa-chart-line" style="color: var(--color-primary);"></i> Financial Overview</h3>
      <p>Complete your financial profile to help us assess your loan eligibility</p>
    </div>

    <div id="affordability-status-container"></div>

    <div class="inner-card financial-card">
      <form id="financial-form">
        
        <!-- INCOME SECTION -->
        <div class="financial-section-header income-header">
          <div class="section-icon">
            <i class="fa-solid fa-money-bill-trend-up"></i>
          </div>
          <div>
            <h4>Monthly Income</h4>
            <p>All sources of regular income you receive each month</p>
          </div>
        </div>
        
        <div class="financial-input-grid">
          <div class="financial-input-group">
            <label for="income_salary">
              <i class="fa-solid fa-briefcase"></i> 
              <span>Salary Income</span>
              <span class="required-badge">Required</span>
            </label>
            <div class="currency-input-wrapper">
              <span class="currency-symbol">R</span>
              <input 
                type="number" 
                id="income_salary" 
                value="${financialData.income.salary || ''}" 
                placeholder="0.00" 
                step="0.01" 
                min="0"
                class="currency-input"
                required>
            </div>
            <small class="input-hint">
              <i class="fa-solid fa-circle-info"></i> Your monthly salary before deductions
            </small>
          </div>
          
          <div class="financial-input-group">
            <label for="income_other">
              <i class="fa-solid fa-coins"></i> 
              <span>Other Earnings</span>
            </label>
            <div class="currency-input-wrapper">
              <span class="currency-symbol">R</span>
              <input 
                type="number" 
                id="income_other" 
                value="${financialData.income.other_monthly_earnings || ''}" 
                placeholder="0.00" 
                step="0.01" 
                min="0"
                class="currency-input">
            </div>
            <small class="input-hint">
              <i class="fa-solid fa-circle-info"></i> Freelance, bonuses, rental income, investments
            </small>
          </div>
        </div>
        
        <!-- Total Income Display -->
        <div class="financial-summary-card income-summary">
          <div class="summary-icon">
            <i class="fa-solid fa-wallet"></i>
          </div>
          <div class="summary-content">
            <span class="summary-label">Total Monthly Income</span>
            <span class="summary-amount" id="total-income-display">
              R ${totalIncome.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div class="summary-badge income-badge">
            <i class="fa-solid fa-arrow-trend-up"></i>
          </div>
        </div>
        
        <!-- EXPENSES SECTION -->
        <div class="financial-section-header expense-header">
          <div class="section-icon">
            <i class="fa-solid fa-receipt"></i>
          </div>
          <div>
            <h4>Monthly Expenses</h4>
            <p>Your regular monthly costs and financial obligations</p>
          </div>
        </div>
        
        <div class="financial-input-grid expense-grid">
          <div class="financial-input-group">
            <label for="expense_housing">
              <i class="fa-solid fa-house"></i> 
              <span>Housing</span>
              <span class="required-badge">Required</span>
            </label>
            <div class="currency-input-wrapper">
              <span class="currency-symbol">R</span>
              <input 
                type="number" 
                id="expense_housing" 
                value="${financialData.expenses.housing_rent || ''}" 
                placeholder="0.00" 
                step="0.01" 
                min="0"
                class="currency-input"
                required>
            </div>
            <small class="input-hint">
              <i class="fa-solid fa-circle-info"></i> Rent or bond payment
            </small>
          </div>
          
          <div class="financial-input-group">
            <label for="expense_school">
              <i class="fa-solid fa-graduation-cap"></i> 
              <span>Education</span>
            </label>
            <div class="currency-input-wrapper">
              <span class="currency-symbol">R</span>
              <input 
                type="number" 
                id="expense_school" 
                value="${financialData.expenses.school || ''}" 
                placeholder="0.00" 
                step="0.01" 
                min="0"
                class="currency-input">
            </div>
            <small class="input-hint">
              <i class="fa-solid fa-circle-info"></i> School fees, uniforms, books
            </small>
          </div>
          
          <div class="financial-input-group">
            <label for="expense_maintenance">
              <i class="fa-solid fa-hand-holding-dollar"></i> 
              <span>Maintenance</span>
            </label>
            <div class="currency-input-wrapper">
              <span class="currency-symbol">R</span>
              <input 
                type="number" 
                id="expense_maintenance" 
                value="${financialData.expenses.maintenance || ''}" 
                placeholder="0.00" 
                step="0.01" 
                min="0"
                class="currency-input">
            </div>
            <small class="input-hint">
              <i class="fa-solid fa-circle-info"></i> Child or spousal support
            </small>
          </div>
          
          <div class="financial-input-group">
            <label for="expense_petrol">
              <i class="fa-solid fa-gas-pump"></i> 
              <span>Transport</span>
            </label>
            <div class="currency-input-wrapper">
              <span class="currency-symbol">R</span>
              <input 
                type="number" 
                id="expense_petrol" 
                value="${financialData.expenses.petrol || ''}" 
                placeholder="0.00" 
                step="0.01" 
                min="0"
                class="currency-input">
            </div>
            <small class="input-hint">
              <i class="fa-solid fa-circle-info"></i> Fuel, taxi, car payments
            </small>
          </div>
          
          <div class="financial-input-group">
            <label for="expense_groceries">
              <i class="fa-solid fa-cart-shopping"></i> 
              <span>Groceries</span>
            </label>
            <div class="currency-input-wrapper">
              <span class="currency-symbol">R</span>
              <input 
                type="number" 
                id="expense_groceries" 
                value="${financialData.expenses.groceries || ''}" 
                placeholder="0.00" 
                step="0.01" 
                min="0"
                class="currency-input">
            </div>
            <small class="input-hint">
              <i class="fa-solid fa-circle-info"></i> Food and household supplies
            </small>
          </div>
          
          <div class="financial-input-group">
            <label for="expense_other">
              <i class="fa-solid fa-ellipsis"></i> 
              <span>Other</span>
            </label>
            <div class="currency-input-wrapper">
              <span class="currency-symbol">R</span>
              <input 
                type="number" 
                id="expense_other" 
                value="${financialData.expenses.other || ''}" 
                placeholder="0.00" 
                step="0.01" 
                min="0"
                class="currency-input">
            </div>
            <small class="input-hint">
              <i class="fa-solid fa-circle-info"></i> Insurance, medical, loans, etc.
            </small>
          </div>
        </div>
        
        <!-- ADDITIONAL INCOME SOURCES (Optional) -->
        <div class="financial-section-header" style="margin-top: 2rem;">
          <div class="section-icon" style="background: #d4af37;">
            <i class="fa-solid fa-wallet" style="color: #1f2937;"></i>
          </div>
          <div>
            <h4>Additional Income Sources</h4>
            <p>Add any other regular income (optional - helps us calculate better loan options)</p>
          </div>
        </div>
        <div id="additional-income-container" class="financial-input-grid"></div>
        <button type="button" id="add-income-source-btn" class="btn-secondary" style="margin-top: 1rem;">
          <i class="fa-solid fa-plus"></i> Add Income Source
        </button>

        <!-- OTHER BANK ACCOUNTS (Optional) -->
        <div class="financial-section-header" style="margin-top: 2rem;">
          <div class="section-icon" style="background: #60a5fa;">
            <i class="fa-solid fa-building-columns" style="color: #1f2937;"></i>
          </div>
          <div>
            <h4>Other Bank Accounts</h4>
            <p>Add details of other bank accounts for better credit assessment (optional)</p>
          </div>
        </div>
        <div id="other-banks-container" class="financial-input-grid"></div>
        <button type="button" id="add-bank-account-btn" class="btn-secondary" style="margin-top: 1rem;">
          <i class="fa-solid fa-plus"></i> Add Bank Account
        </button>

        <!-- Total Expenses Display -->
        <div class="financial-summary-card expense-summary">
          <div class="summary-icon">
            <i class="fa-solid fa-credit-card"></i>
          </div>
          <div class="summary-content">
            <span class="summary-label">Total Monthly Expenses</span>
            <span class="summary-amount" id="total-expenses-display">
              R ${totalExpenses.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div class="summary-badge expense-badge">
            <i class="fa-solid fa-arrow-trend-down"></i>
          </div>
        </div>
        
        <!-- Disposable Income Display -->
        <div class="financial-summary-card disposable-summary">
          <div class="summary-icon-large">
            <i class="fa-solid fa-piggy-bank"></i>
          </div>
          <div class="summary-content-large">
            <span class="summary-label-large">${displayLabel}</span>
            <span class="summary-amount-large" id="disposable-income-display">
              R ${displayAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
            </span>
            <small class="summary-hint">
              <i class="fa-solid fa-circle-info"></i> 
              ${disposableIncome > affordabilityThreshold 
                ? 'Your disposable income exceeds the 20% affordability threshold' 
                : 'Maximum 20% of your income can be used for loan repayments'}
            </small>
          </div>
        </div>
        
        <div class="financial-info-card">
          <div class="info-icon">
            <i class="fa-solid fa-shield-halved"></i>
          </div>
          <div class="info-content">
            <strong>Why we need this information</strong>
            <ul>
              <li><i class="fa-solid fa-check"></i> To assess your affordability and ensure responsible lending</li>
              <li><i class="fa-solid fa-check"></i> To determine appropriate loan amounts and repayment terms</li>
              <li><i class="fa-solid fa-check"></i> To comply with National Credit Regulator (NCR) requirements</li>
              <li><i class="fa-solid fa-check"></i> To protect you from over-indebtedness</li>
            </ul>
          </div>
        </div>
        
        <div class="btn-container">
          <button type="submit" id="save-financial-btn" class="btn-primary">
            <i class="fa-solid fa-floppy-disk"></i> Save Financial Information
          </button>
        </div>
      </form>
    </div>
    
    ${currentFinancialProfile ? `
    <div class="inner-card" style="margin-top: 1.5rem;">
      <h4 style="font-size: 1.25rem; font-weight: 600; color: var(--color-primary); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
        <i class="fa-solid fa-clock-rotate-left"></i> Update History
      </h4>
      <div style="color: #9CA3AF; line-height: 1.6;">
        <p style="margin-bottom: 0.5rem;">
          <strong style="color: #ffffff;">Last Updated:</strong> 
          ${new Date(currentFinancialProfile.updated_at).toLocaleDateString('en-ZA', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
        <p style="margin-bottom: 0;">
          <strong style="color: #ffffff;">Created:</strong> 
          ${new Date(currentFinancialProfile.created_at).toLocaleDateString('en-ZA', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric'
          })}
        </p>
      </div>
    </div>
    ` : ''}
  `;
  
  // Attach form listener
  document.getElementById('financial-form').addEventListener('submit', handleFinancialUpdate);
  
  // Update totals and disposable income on input change
  const incomeInputs = ['income_salary', 'income_other'];
  const expenseInputs = ['expense_housing', 'expense_school', 'expense_maintenance', 'expense_petrol', 'expense_groceries', 'expense_other'];
  
  const updateTotals = () => {
    // Calculate total income
    const totalInc = incomeInputs.reduce((sum, id) => {
      const val = parseFloat(document.getElementById(id).value) || 0;
      return sum + val;
    }, 0);
    
    // Calculate total expenses
    const totalExp = expenseInputs.reduce((sum, id) => {
      const val = parseFloat(document.getElementById(id).value) || 0;
      return sum + val;
    }, 0);
    
    // Calculate disposable
    const disposable = totalInc - totalExp;
    
    // Calculate affordability threshold using backend API
    if (totalInc > 0) {
      fetch('/api/calculate-affordability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthly_income: totalInc,
          affordability_percent: 20,
          annual_interest_rate: 20,
          loan_term_months: 1
        })
      })
      .then(res => res.json())
      .then(data => {
        const affordabilityThreshold = data.max_monthly_payment;
        const displayAmount = Math.max(disposable, affordabilityThreshold);
        
        // Update displays
        document.getElementById('total-income-display').textContent = 
          `R ${totalInc.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
        
        document.getElementById('total-expenses-display').textContent = 
          `R ${totalExp.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
        
        const disposableDisplay = document.getElementById('disposable-income-display');
        disposableDisplay.textContent = `R ${displayAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
        disposableDisplay.style.color = displayAmount >= 0 ? 'var(--color-primary)' : '#EF4444';
        
        // Update label
        const labelElement = disposableDisplay.previousElementSibling;
        if (labelElement && labelElement.classList.contains('summary-label-large')) {
          labelElement.textContent = disposable > affordabilityThreshold 
            ? "Disposable Income" 
            : "Affordability Threshold (20%)";
        }
      })
      .catch(err => {
        console.error('Affordability calculation error:', err);
        // Fallback to simple calculation
        const affordabilityThreshold = totalInc * 0.20;
        const displayAmount = Math.max(disposable, affordabilityThreshold);
        
        document.getElementById('total-income-display').textContent = 
          `R ${totalInc.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
        document.getElementById('total-expenses-display').textContent = 
          `R ${totalExp.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
        
        const disposableDisplay = document.getElementById('disposable-income-display');
        disposableDisplay.textContent = `R ${displayAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
        disposableDisplay.style.color = displayAmount >= 0 ? 'var(--color-primary)' : '#EF4444';
      });
    } else {
      // If no income, just update with zeros
      document.getElementById('total-income-display').textContent = 
        `R ${totalInc.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
      document.getElementById('total-expenses-display').textContent = 
        `R ${totalExp.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
      const disposableDisplay = document.getElementById('disposable-income-display');
      disposableDisplay.textContent = `R ${disposable.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
      disposableDisplay.style.color = disposable >= 0 ? 'var(--color-primary)' : '#EF4444';
    }
  };
  
  // Attach listeners to all inputs
  [...incomeInputs, ...expenseInputs].forEach(id => {
    document.getElementById(id).addEventListener('input', updateTotals);
  });
}

function renderSecurityTab() {
  console.log('🔒 Rendering Security Tab');
  
  const content = document.getElementById('settings-content');
  if (!content) {
    console.error('❌ settings-content element not found');
    return;
  }
  
  if (!currentUserProfile) {
    console.error('❌ currentUserProfile is null');
    content.innerHTML = '<div style="color: white; padding: 2rem;">Loading profile data...</div>';
    return;
  }
  
  content.innerHTML = `
    <div class="section-header">
      <h3>Security Settings</h3>
      <p>Manage your account security and password preferences</p>
    </div>

    <!-- Push notifications toggle -->
    <div class="inner-card" id="push-notifications-card" style="margin-bottom:24px">
      <h4 style="font-size: 1.25rem; font-weight: 600; color: var(--color-primary); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
        <i class="fa-solid fa-bell"></i> Push Notifications
      </h4>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px;background:#F8FAFC;border-radius:12px;border:1px solid rgba(15,23,42,0.05)">
        <div style="flex:1;min-width:0">
          <p style="margin:0 0 4px;font-weight:700;color:#0F172A;font-size:14px" id="push-status-label">Loading...</p>
          <p style="margin:0;font-size:12px;color:#64748B;line-height:1.5">Get instant alerts when your loan is approved, payment is confirmed, or your account needs attention.</p>
        </div>
        <button id="push-toggle-btn" onclick="window.togglePushNotifications()"
          style="flex-shrink:0;padding:10px 18px;background:var(--color-primary,#E7762E);color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-size:13px">
          Enable
        </button>
      </div>
      <button id="push-test-btn" onclick="window.testPushNotification()" style="display:none;width:100%;margin-top:10px;padding:10px;background:transparent;color:var(--color-primary,#E7762E);border:1px dashed var(--color-primary,#E7762E);border-radius:10px;font-weight:700;cursor:pointer;font-size:12px">
        Send a test notification
      </button>
    </div>

    <div class="inner-card">
      <h4 style="font-size: 1.25rem; font-weight: 600; color: var(--color-primary); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
        <i class="fa-solid fa-shield-halved"></i> Change Password
      </h4>
      <form id="password-form">
        <div class="form-grid">
          <div class="form-group">
            <label for="new_password">
              <i class="fa-solid fa-key"></i> New Password
            </label>
            <input type="password" id="new_password" placeholder="Enter new password (min. 6 characters)" required minlength="6">
            <div id="password-strength" class="password-strength">
              <div id="password-strength-bar" class="password-strength-bar"></div>
            </div>
          </div>
          <div class="form-group">
            <label for="confirm_password">
              <i class="fa-solid fa-check-double"></i> Confirm Password
            </label>
            <input type="password" id="confirm_password" placeholder="Re-enter your new password" required minlength="6">
          </div>
        </div>
        
        <div class="info-message">
          <i class="fa-solid fa-exclamation-triangle"></i>
          <div>
            <strong>Password Requirements:</strong>
            <ul style="margin: 0.5rem 0 0 1.25rem; color: #9CA3AF;">
              <li>Minimum 6 characters</li>
              <li>Use a mix of letters, numbers, and symbols for stronger security</li>
              <li>Don't use common words or personal information</li>
            </ul>
          </div>
        </div>
        
        <div class="btn-container">
          <button type="button" class="btn-secondary" onclick="document.getElementById('password-form').reset();">
            <i class="fa-solid fa-times"></i> Cancel
          </button>
          <button type="submit" id="save-password-btn" class="btn-primary">
            <i class="fa-solid fa-lock"></i> Update Password
          </button>
        </div>
      </form>
    </div>
    
    <!-- Additional Security Info -->
    <div class="inner-card" style="margin-top: 1.5rem;">
      <h4 style="font-size: 1.25rem; font-weight: 600; color: var(--color-primary); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
        <i class="fa-solid fa-user-shield"></i> Account Security
      </h4>
      <div class="security-metric-list">
        <div class="security-metric">
          <span class="security-metric-label">Last Password Change</span>
          <span class="security-metric-value" id="last-password-change">Not available</span>
        </div>
        <div class="security-metric">
          <span class="security-metric-label">Account Created</span>
          <span class="security-metric-value">
            ${new Date(currentUserProfile.created_at).toLocaleDateString('en-ZA', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </span>
        </div>
        <div class="security-metric">
          <span class="security-metric-label">Account Status</span>
          <span class="security-metric-value security-status">
            <i class="fa-solid fa-check-circle"></i>
            Active
          </span>
        </div>
      </div>
    </div>
  `;
  
  // Attach form listener
  document.getElementById('password-form').addEventListener('submit', handlePasswordUpdate);
  
  // Password strength indicator
  const passwordInput = document.getElementById('new_password');
  const strengthBar = document.getElementById('password-strength-bar');
  
  passwordInput.addEventListener('input', (e) => {
    const password = e.target.value;
    let strength = 0;
    
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    strengthBar.className = 'password-strength-bar';
    if (strength <= 2) {
      strengthBar.classList.add('strength-weak');
    } else if (strength <= 4) {
      strengthBar.classList.add('strength-medium');
    } else {
      strengthBar.classList.add('strength-strong');
    }
  });
}

function renderDeclarationsTab() {
  console.log('📝 Rendering Declarations Tab');
  const content = document.getElementById('settings-content');
  if (!content) return;

  const existing = currentUserProfile?.declarations || {};

  const hdStatus = existing.historically_disadvantaged === true ? 'yes' : (existing.historically_disadvantaged === false ? 'no' : '');
  const acceptedStd = existing.accepted_std_conditions === true;
  const homeOwnership = existing.home_ownership || '';
  const maritalStatus = existing.marital_status || '';
  const highestQualification = existing.highest_qualification || '';
  const referralProvided = existing.referral_provided === true;
  const referralName = existing.referral_name || '';
  const referralPhone = existing.referral_phone || '';

  content.innerHTML = `
    <div class="section-header">
      <h3>Declarations</h3>
      <p>Please complete the declarations below. These help us with compliance and assessment.</p>
    </div>
    
    <form id="declarations-form" class="declarations-form">
      <!-- Historically Disadvantaged Status -->
      <div class="declaration-card">
        <div class="declaration-card-header">
          <div class="declaration-icon">
            <i class="fa-solid fa-user-shield"></i>
          </div>
          <div>
            <h4>Historically Disadvantaged Status</h4>
            <p>Are you historically disadvantaged in South Africa?</p>
          </div>
        </div>
        <div class="radio-group">
          <div class="radio-option">
            <input type="radio" id="hd_yes" name="hd_status" value="yes" ${hdStatus === 'yes' ? 'checked' : ''}>
            <label for="hd_yes" class="radio-label">
              <i class="fa-solid fa-circle-check"></i>
              <span>Yes</span>
            </label>
          </div>
          <div class="radio-option">
            <input type="radio" id="hd_no" name="hd_status" value="no" ${hdStatus === 'no' ? 'checked' : ''}>
            <label for="hd_no" class="radio-label">
              <i class="fa-solid fa-circle-xmark"></i>
              <span>No</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Standard Conditions -->
      <div class="declaration-card">
        <div class="declaration-card-header">
          <div class="declaration-icon">
            <i class="fa-solid fa-file-contract"></i>
          </div>
          <div>
            <h4>Standard Conditions</h4>
            <p>Credit agreement terms and conditions</p>
          </div>
        </div>
        <div class="checkbox-group">
          <div class="checkbox-option">
            <input type="checkbox" id="std_conditions" ${acceptedStd ? 'checked' : ''}>
            <label for="std_conditions" class="checkbox-label">
              <div class="checkbox-icon">
                <i class="fa-solid fa-check"></i>
              </div>
              <div class="checkbox-text">
                I confirm that I have read and accepted the <strong>Standard Conditions of Credit Agreement</strong>. 
                I understand all terms, fees, and obligations associated with this loan application.
              </div>
            </label>
          </div>
        </div>
      </div>

      <!-- Home Ownership -->
      <div class="declaration-card">
        <div class="declaration-card-header">
          <div class="declaration-icon">
            <i class="fa-solid fa-house"></i>
          </div>
          <div>
            <h4>Home Ownership</h4>
            <p>Do you own or rent your primary residence?</p>
          </div>
        </div>
        <div class="radio-group">
          <div class="radio-option">
            <input type="radio" id="home_own" name="home_ownership" value="own" ${homeOwnership === 'own' ? 'checked' : ''}>
            <label for="home_own" class="radio-label">
              <i class="fa-solid fa-house-user"></i>
              <span>Own</span>
            </label>
          </div>
          <div class="radio-option">
            <input type="radio" id="home_rent" name="home_ownership" value="rent" ${homeOwnership === 'rent' ? 'checked' : ''}>
            <label for="home_rent" class="radio-label">
              <i class="fa-solid fa-key"></i>
              <span>Rent</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Marital Status -->
      <div class="declaration-card">
        <div class="declaration-card-header">
          <div class="declaration-icon">
            <i class="fa-solid fa-heart"></i>
          </div>
          <div>
            <h4>Marital Status</h4>
            <p>Your current marital status</p>
          </div>
        </div>
        <div class="radio-group" style="flex-wrap: wrap;">
          <div class="radio-option" style="flex: 0 0 calc(50% - 0.5rem);">
            <input type="radio" id="marital_single" name="marital_status" value="single" ${maritalStatus === 'single' ? 'checked' : ''}>
            <label for="marital_single" class="radio-label">
              <i class="fa-solid fa-user"></i>
              <span>Single</span>
            </label>
          </div>
          <div class="radio-option" style="flex: 0 0 calc(50% - 0.5rem);">
            <input type="radio" id="marital_married" name="marital_status" value="married" ${maritalStatus === 'married' ? 'checked' : ''}>
            <label for="marital_married" class="radio-label">
              <i class="fa-solid fa-heart"></i>
              <span>Married</span>
            </label>
          </div>
          <div class="radio-option" style="flex: 0 0 calc(33.33% - 0.67rem);">
            <input type="radio" id="marital_divorced" name="marital_status" value="divorced" ${maritalStatus === 'divorced' ? 'checked' : ''}>
            <label for="marital_divorced" class="radio-label">
              <i class="fa-solid fa-heart-crack"></i>
              <span>Divorced</span>
            </label>
          </div>
          <div class="radio-option" style="flex: 0 0 calc(33.33% - 0.67rem);">
            <input type="radio" id="marital_widowed" name="marital_status" value="widowed" ${maritalStatus === 'widowed' ? 'checked' : ''}>
            <label for="marital_widowed" class="radio-label">
              <i class="fa-solid fa-ribbon"></i>
              <span>Widowed</span>
            </label>
          </div>
          <div class="radio-option" style="flex: 0 0 calc(33.33% - 0.67rem);">
            <input type="radio" id="marital_separated" name="marital_status" value="separated" ${maritalStatus === 'separated' ? 'checked' : ''}>
            <label for="marital_separated" class="radio-label">
              <i class="fa-solid fa-arrows-split-up-and-left"></i>
              <span>Separated</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Highest Qualification -->
      <div class="declaration-card">
        <div class="declaration-card-header">
          <div class="declaration-icon">
            <i class="fa-solid fa-graduation-cap"></i>
          </div>
          <div>
            <h4>Highest Qualification</h4>
            <p>Your highest level of education</p>
          </div>
        </div>
        <div class="select-group">
          <div class="select-wrapper">
            <select id="highest_qualification">
              <option value="">Please select your highest qualification</option>
              <option value="N/A" ${highestQualification === 'N/A' ? 'selected' : ''}>N/A</option>
              <option value="Matric" ${highestQualification === 'Matric' ? 'selected' : ''}>Matric</option>
              <option value="Degree" ${highestQualification === 'Degree' ? 'selected' : ''}>Degree</option>
              <option value="Honours" ${highestQualification === 'Honours' ? 'selected' : ''}>Honours Degree</option>
              <option value="Masters" ${highestQualification === 'Masters' ? 'selected' : ''}>Masters</option>
              <option value="PhD" ${highestQualification === 'PhD' ? 'selected' : ''}>PhD / Doctorate</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Referral / Next of Kin -->
      <div class="declaration-card">
        <div class="declaration-card-header">
          <div class="declaration-icon">
            <i class="fa-solid fa-user-plus"></i>
          </div>
          <div>
            <h4>Referral / Next of Kin</h4>
            <p>Would you like to provide a referral or next of kin contact?</p>
          </div>
        </div>
        <div class="radio-group">
          <div class="radio-option">
            <input type="radio" id="referral_yes" name="referral_provided" value="yes" ${referralProvided ? 'checked' : ''}>
            <label for="referral_yes" class="radio-label">
              <i class="fa-solid fa-circle-check"></i>
              <span>Yes, I'll provide details</span>
            </label>
          </div>
          <div class="radio-option">
            <input type="radio" id="referral_no" name="referral_provided" value="no" ${!referralProvided ? 'checked' : ''}>
            <label for="referral_no" class="radio-label">
              <i class="fa-solid fa-circle-xmark"></i>
              <span>No, skip this</span>
            </label>
          </div>
        </div>

        <div id="referral-fields" class="conditional-fields" style="display: ${referralProvided ? 'block' : 'none'};">
          <div class="conditional-fields-header">
            <i class="fa-solid fa-address-card"></i>
            <span>Contact Details</span>
          </div>
          <div class="conditional-field">
            <label for="referral_name">Full Name</label>
            <input type="text" id="referral_name" value="${referralName}" placeholder="Enter full name">
          </div>
          <div class="conditional-field">
            <label for="referral_phone">Cellphone Number</label>
            <input type="text" id="referral_phone" value="${referralPhone}" placeholder="e.g., 0821234567">
          </div>
        </div>
      </div>

      <!-- Submit Section -->
      <div class="declarations-submit">
        <div class="declarations-info">
          <i class="fa-solid fa-shield-heart"></i>
          <h5>Your Privacy Matters</h5>
          <p>All declarations are securely stored and used solely for compliance and assessment purposes. 
          Your information is protected under our privacy policy.</p>
        </div>
        <button type="submit" id="save-declarations-btn" class="btn-primary">
          <i class="fa-solid fa-floppy-disk"></i> Save Declarations
        </button>
      </div>
    </form>
  `;

  // Attach interactions
  document.getElementById('declarations-form').addEventListener('submit', handleDeclarationsSave);
  document.querySelectorAll('input[name="referral_provided"]').forEach(r => r.addEventListener('change', (e) => {
    const v = e.target.value === 'yes';
    const fieldsDiv = document.getElementById('referral-fields');
    if (v) {
      fieldsDiv.style.display = 'block';
    } else {
      fieldsDiv.style.display = 'none';
    }
  }));
}

async function handleDeclarationsSave(e) {
  e.preventDefault();
  const btn = document.getElementById('save-declarations-btn');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

  const hdStatus = document.querySelector('input[name="hd_status"]:checked')?.value || '';
  const acceptedStd = document.getElementById('std_conditions').checked;
  const homeOwnership = document.querySelector('input[name="home_ownership"]:checked')?.value || '';
  const maritalStatus = document.querySelector('input[name="marital_status"]:checked')?.value || '';
  const highestQualification = document.getElementById('highest_qualification').value || '';
  const referralProvided = document.querySelector('input[name="referral_provided"]:checked')?.value === 'yes';
  const referralName = document.getElementById('referral_name')?.value.trim() || null;
  const referralPhone = document.getElementById('referral_phone')?.value.trim() || null;

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
    // 1) Upsert into declarations table (separate columns)
    const payload = {
      user_id: currentUserProfile.id,
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

    // 2) Also update auth user metadata as backup
    await supabase.auth.updateUser({ data: { declarations: JSON.stringify(declarations) } });

    // Update local cache
    currentUserProfile.declarations = declarations;
    if (!currentUserProfile.user_metadata) currentUserProfile.user_metadata = {};
    currentUserProfile.user_metadata.declarations = JSON.stringify(declarations);
    
    // Check if declarations are now complete (accepted_std_conditions is the key requirement)
    currentUserProfile.hasDeclarations = acceptedStd;
    
    // Check if profile is now complete (both financial and declarations)
    const hasFinancial = currentUserProfile.hasFinancialProfile === true;
    const hasDeclarations = acceptedStd === true;
    handleProfileCompletionUnlock(hasFinancial, hasDeclarations);

    showNotification('✅ Declarations saved successfully!', 'success');
    
    setTimeout(() => {
      if (!currentUserProfile.isProfileComplete) {
        renderDeclarationsTab();
      }
    }, 800);


  } catch (err) {
    console.error('Error saving declarations:', err);
    showNotification('❌ Failed to save declarations', 'error');
  }

  btn.disabled = false;
  btn.innerHTML = orig;
}

// --- Event Handlers ---
function attachTabListeners() {
  console.log('🔗 Attaching tab listeners...');
  const tabs = document.querySelectorAll('.tab-button');
  console.log('Found', tabs.length, 'tabs');
  
  tabs.forEach(tab => {
    // Remove any existing listeners by cloning
    const newTab = tab.cloneNode(true);
    tab.parentNode.replaceChild(newTab, tab);
    
    newTab.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('🖱️ Tab clicked:', newTab.dataset.tab);
      
      // Update active states
      document.querySelectorAll('.tab-button').forEach(t => {
        t.classList.remove('active');
      });
      newTab.classList.add('active');
      
      // Render appropriate tab content
      const tabName = newTab.dataset.tab;
      if (tabName === 'profile') {
        console.log('📋 Rendering Profile Tab');
        renderProfileTab();
      } else if (tabName === 'financial') {
        console.log('💰 Rendering Financial Tab');
        renderFinancialTab();
        loadAffordabilityStatus();
      } else if (tabName === 'security') {
        console.log('🔒 Rendering Security Tab');
        renderSecurityTab();
      } else if (tabName === 'declarations') {
        console.log('📝 Rendering Declarations Tab');
        renderDeclarationsTab();
      }
    });
  });
  
  console.log('✅ Tab listeners attached');
}

function switchToTab(tabName) {
  const targetTab = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
  if (targetTab) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    targetTab.click();
  }
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  const btn = document.getElementById('save-profile-btn');
  const originalContent = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
  
  const profileData = {
    first_name: document.getElementById('first_name')?.value.trim() || null,
    last_name: document.getElementById('last_name')?.value.trim() || null,
    full_name: document.getElementById('full_name').value.trim(),
    contact_number: document.getElementById('contact_number').value.trim(),
    identity_number: document.getElementById('identity_number')?.value.trim() || null,
    gender: document.getElementById('gender')?.value || null,
    date_of_birth: document.getElementById('date_of_birth')?.value || null,
    address: document.getElementById('address')?.value.trim() || null,
    postal_code: document.getElementById('postal_code')?.value.trim() || null,
    suburb_area: document.getElementById('suburb_area')?.value.trim() || null,
    cell_tel_no: document.getElementById('cell_tel_no')?.value.trim() || null,
    updated_at: new Date().toISOString()
  };
  
  // Validate inputs
  if (!profileData.full_name) {
    alert('❌ Full name is required');
    btn.disabled = false;
    btn.innerHTML = originalContent;
    return;
  }
  
  // Check if phone number was just added (unlocking guard)
  const wasPhoneMissing = !currentUserProfile.contact_number || currentUserProfile.contact_number.trim() === '';
  const isPhoneNowProvided = profileData.contact_number && profileData.contact_number.trim() !== '';
  
  try {
    // Update profile in database
    const { error } = await supabase
      .from('profiles')
      .update(profileData)
      .eq('id', currentUserProfile.id);
    
    if (error) throw error;
    
    // Update local state
    currentUserProfile.first_name = profileData.first_name;
    currentUserProfile.last_name = profileData.last_name;
    currentUserProfile.full_name = profileData.full_name;
    currentUserProfile.contact_number = profileData.contact_number;
    currentUserProfile.identity_number = profileData.identity_number;
    currentUserProfile.gender = profileData.gender;
    currentUserProfile.date_of_birth = profileData.date_of_birth;
    currentUserProfile.address = profileData.address;
    currentUserProfile.postal_code = profileData.postal_code;
    currentUserProfile.suburb_area = profileData.suburb_area;
    currentUserProfile.cell_tel_no = profileData.cell_tel_no;
    
    // Create notification for account update
    const { notifyAccountUpdated } = await import('/Services/notificationService.js');
    await notifyAccountUpdated(currentUserProfile.id, 'profile');
    
    // If phone number was just added, unlock navigation and create special notification
    if (wasPhoneMissing && isPhoneNowProvided) {
      // Unlock navigation (call global function from script.js)
      if (typeof window.unlockNavigation === 'function') {
        window.unlockNavigation();
      }
      
      // Create special notification for phone number completion
      const { createNotification } = await import('/Services/notificationService.js');
      await createNotification(
        currentUserProfile.id,
        'success',
        '🎉 Account Activated',
        'Your contact number has been added! You now have full access to all features.',
        { priority: 'high' }
      );
    }
    
    // Update navbar if it exists
    const userName = document.getElementById('userName');
    if (userName) userName.textContent = profileData.full_name;
    
    // Show success message
    showNotification('✅ Profile updated successfully!', 'success');

    setTimeout(() => switchToTab('financial'), 800);
    
    // Refresh the tab to show updated info
    setTimeout(() => renderProfileTab(), 500);
    
  } catch (error) {
    console.error('Profile update error:', error);
    showNotification(`❌ Error: ${error.message}`, 'error');
  }
  
  btn.disabled = false;
  btn.innerHTML = originalContent;
}

async function handleFinancialUpdate(e) {
  e.preventDefault();
  const btn = document.getElementById('save-financial-btn');
  const originalContent = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
  
  // Collect income data
  const incomeSalary = parseFloat(document.getElementById('income_salary').value) || 0;
  const incomeOther = parseFloat(document.getElementById('income_other').value) || 0;
  const totalIncome = incomeSalary + incomeOther;
  
  // Collect expense data
  const expenseHousing = parseFloat(document.getElementById('expense_housing').value) || 0;
  const expenseSchool = parseFloat(document.getElementById('expense_school').value) || 0;
  const expenseMaintenance = parseFloat(document.getElementById('expense_maintenance').value) || 0;
  const expensePetrol = parseFloat(document.getElementById('expense_petrol').value) || 0;
  const expenseGroceries = parseFloat(document.getElementById('expense_groceries').value) || 0;
  const expenseOther = parseFloat(document.getElementById('expense_other').value) || 0;
  const totalExpenses = expenseHousing + expenseSchool + expenseMaintenance + expensePetrol + expenseGroceries + expenseOther;
  
  // Validation
  if (totalIncome <= 0) {
    showNotification('❌ Please enter at least some income', 'error');
    btn.disabled = false;
    btn.innerHTML = originalContent;
    return;
  }
  
  if (totalExpenses < 0) {
    showNotification('❌ Please enter valid expenses', 'error');
    btn.disabled = false;
    btn.innerHTML = originalContent;
    return;
  }
  
  try {
    // Check if financial profile exists
    const { data: existing } = await supabase
      .from('financial_profiles')
      .select('*')
      .eq('user_id', currentUserProfile.id)
      .single();
    
    // Calculate disposable income (income - expenses)
    const disposableIncome = totalIncome - totalExpenses;
    
    // Calculate debt-to-income ratio if user has active loans
    let debtToIncomeRatio = null;
    try {
      const { data: loans } = await supabase
        .from('loans')
        .select('monthly_payment')
        .eq('user_id', currentUserProfile.id)
        .eq('status', 'active');
      
      if (loans && loans.length > 0) {
        const totalMonthlyDebt = loans.reduce((sum, loan) => sum + parseFloat(loan.monthly_payment || 0), 0);
        debtToIncomeRatio = totalIncome > 0 ? ((totalMonthlyDebt / totalIncome) * 100).toFixed(2) : null;
      }
    } catch (err) {
      console.log('Could not calculate debt-to-income ratio:', err);
    }
    
    // Calculate affordability ratio using backend amortized formula
    let affordabilityRatio = null;
    let maxLoanAmount = null;
    try {
      const response = await fetch('/api/calculate-affordability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthly_income: totalIncome,
          affordability_percent: 20,
          annual_interest_rate: 20,
          loan_term_months: 1
        })
      });
      
      const affordabilityData = await response.json();
      affordabilityRatio = totalIncome > 0 ? affordabilityData.max_monthly_payment.toFixed(2) : null;
      maxLoanAmount = totalIncome > 0 ? affordabilityData.max_loan_amount.toFixed(2) : null;
    } catch (err) {
      console.log('Could not calculate affordability ratio, using fallback:', err);
      // Fallback to simple 20% calculation
      const affordabilityThreshold = totalIncome * 0.20;
      affordabilityRatio = totalIncome > 0 ? affordabilityThreshold.toFixed(2) : null;
      
      // Fallback max loan calculation (1 month at 20% APR)
      const monthlyRate = (0.20 / 12);
      const fallbackMaxLoan = affordabilityThreshold * ((1 - Math.pow(1 + monthlyRate, -1)) / monthlyRate);
      maxLoanAmount = totalIncome > 0 ? fallbackMaxLoan.toFixed(2) : null;
    }
    
    const financialData = {
      user_id: currentUserProfile.id,
      monthly_income: totalIncome,
      monthly_expenses: totalExpenses,
      debt_to_income_ratio: debtToIncomeRatio,
      affordability_ratio: affordabilityRatio,
      max_loan_amount: maxLoanAmount,
      parsed_data: {
        income: {
          salary: incomeSalary,
          other_monthly_earnings: incomeOther
        },
        expenses: {
          housing_rent: expenseHousing,
          school: expenseSchool,
          maintenance: expenseMaintenance,
          petrol: expensePetrol,
          groceries: expenseGroceries,
          other: expenseOther
        }
      }
    };
    
    let error;
    
    if (existing) {
      // Update existing record
      const result = await supabase
        .from('financial_profiles')
        .update(financialData)
        .eq('user_id', currentUserProfile.id);
      error = result.error;
    } else {
      // Insert new record
      const result = await supabase
        .from('financial_profiles')
        .insert([financialData]);
      error = result.error;
    }
    
    if (error) throw error;
    
    // Fetch updated financial profile
    const { data: updatedProfile } = await supabase
      .from('financial_profiles')
      .select('*')
      .eq('user_id', currentUserProfile.id)
      .single();
    
    currentFinancialProfile = updatedProfile;
    
    // Check if financial info is now complete
    const wasIncompleteFinancial = !currentUserProfile.hasFinancialProfile;
    currentUserProfile.hasFinancialProfile = totalIncome > 0;
    
    // Check if profile is now complete (both financial and declarations)
    const hasFinancial = totalIncome > 0;
    const hasDeclarations = currentUserProfile.hasDeclarations === true;
    handleProfileCompletionUnlock(hasFinancial, hasDeclarations);
    
    showNotification('✅ Financial information saved successfully!', 'success');
    
    setTimeout(() => {
      if (!currentUserProfile.isProfileComplete) {
        switchToTab('declarations');
      }
    }, 800);
    
  } catch (error) {
    console.error('Financial update error:', error);
    showNotification(`❌ Error: ${error.message}`, 'error');
  }
  
  btn.disabled = false;
  btn.innerHTML = originalContent;
}

function showNotification(message, type = 'info') {
  // Create notification element - always use dark grey style
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 2rem;
    right: 2rem;
    background: linear-gradient(135deg, #1F2937, #111827);
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    font-weight: 600;
    border: 2px solid #374151;
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

async function handleAvatarUpload(e) {
  if (isUploading) return;
  const file = e.target.files[0];
  if (!file) return;

  isUploading = true;
  const spinner = document.getElementById('avatar-spinner');
  spinner.style.display = 'flex';
  
  try {
    const fileExt = file.name.split('.').pop();
    const filePath = `${currentUserProfile.id}/${Date.now()}.${fileExt}`;

    // 1. Upload file to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // 2. Get the public URL
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);
      
    const publicUrl = data.publicUrl;

    // 3. Update the user's profile table
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', currentUserProfile.id);
      
    if (updateError) throw updateError;
    
    // 4. Update the auth user's metadata
    await supabase.auth.updateUser({
      data: { avatar_url: publicUrl }
    });
    
    // 5. Update the UI instantly
    currentUserProfile.avatar_url = publicUrl;
    const newAvatarAsset = getAvatarAsset(currentUserProfile);
    const avatarPreviewEl = document.getElementById('avatar-preview');
    if (avatarPreviewEl) {
      avatarPreviewEl.src = newAvatarAsset.url;
      setupAvatarPlaceholderHover(newAvatarAsset);
    }
    
    // Update navbar avatar if it exists
    const navAvatar = document.querySelector('.user-avatar img');
    if (navAvatar) navAvatar.src = newAvatarAsset.url;

    // Create notification for profile update
    const { notifyAccountUpdated } = await import('/Services/notificationService.js');
    await notifyAccountUpdated(currentUserProfile.id, 'profile', 'Your profile picture has been updated successfully.');

    alert('Avatar updated successfully!');
  } catch (error) {
    console.error('Avatar upload error:', error);
    alert(`Error uploading avatar: ${error.message}`);
  } finally {
    isUploading = false;
    spinner.style.display = 'none';
  }
}

async function handlePasswordUpdate(e) {
  e.preventDefault();
  const btn = document.getElementById('save-password-btn');
  const originalContent = btn.innerHTML;
  const newPassword = document.getElementById('new_password').value;
  const confirmPassword = document.getElementById('confirm_password').value;
  
  // Validation
  if (newPassword !== confirmPassword) {
    showNotification('❌ Passwords do not match!', 'error');
    return;
  }
  
  if (newPassword.length < 6) {
    showNotification('❌ Password must be at least 6 characters long!', 'error');
    return;
  }
  
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

  try {
    // Update password using Supabase Auth
    const { error } = await supabase.auth.updateUser({ 
      password: newPassword 
    });
    
    if (error) throw error;
    
    // Create notification for password change
    const { notifyAccountUpdated } = await import('/Services/notificationService.js');
    await notifyAccountUpdated(currentUserProfile.id, 'password');
    
    showNotification('✅ Password updated successfully!', 'success');
    e.target.reset();
    
    // Reset password strength bar
    const strengthBar = document.getElementById('password-strength-bar');
    if (strengthBar) {
      strengthBar.className = 'password-strength-bar';
    }
    
  } catch (error) {
    console.error('Password update error:', error);
    showNotification(`❌ Error: ${error.message}`, 'error');
  }
  
  btn.disabled = false;
  btn.innerHTML = originalContent;
}

// --- Main Init ---
async function initProfilePage() {
  console.log('🔧 Initializing Profile Page...');
  
  try {
    // Import Supabase
    const supabaseModule = await import('/Services/supabaseClient.js');
    supabase = supabaseModule.supabase;
    
    console.log('✅ Supabase imported');
    
    // Get current user profile
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('❌ No session found');
      window.location.replace('/auth/login.html');
      return;
    }
    
    console.log('✅ Session found:', session.user.id);
    
    // Fetch profile from database
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    if (error) {
      console.error('❌ Error fetching profile:', error);
      showNotification('Error loading profile data', 'error');
      return;
    }
    
    currentUserProfile = profile;
    console.log('✅ Profile loaded:', currentUserProfile);
    
    // Fetch financial profile
    const { data: financialProfile } = await supabase
      .from('financial_profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .single();
    
    currentFinancialProfile = financialProfile;
    console.log('✅ Financial profile loaded:', currentFinancialProfile);
    
    // Fetch declarations
    const { data: declarationsData } = await supabase
      .from('declarations')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();
    
    if (declarationsData) {
      currentUserProfile.declarations = declarationsData;
      console.log('✅ Declarations loaded:', declarationsData);
    }
    
    // Attach tab listeners and render default tab
    attachTabListeners();
    renderProfileTab();
    
  } catch (error) {
    console.error('❌ Profile page initialization error:', error);
    showNotification('Failed to load profile page', 'error');
  }
}

// Execute on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProfilePage);
} else {
  // DOM is already loaded
  initProfilePage();
}

// Also listen for the custom pageLoaded event from the router
window.addEventListener('pageLoaded', (e) => {
  if (e.detail?.pageName === 'profile') {
    console.log('📄 Profile page loaded via router');
    initProfilePage();
  }
});

// ── Push Notifications ─────────────────────────────────────────
async function refreshPushUI() {
    const label   = document.getElementById('push-status-label');
    const btn     = document.getElementById('push-toggle-btn');
    const testBtn = document.getElementById('push-test-btn');
    if (!label || !btn) return;

    if (!window.zwanePush?.supported) {
        label.textContent = 'Not supported in this browser';
        btn.disabled = true; btn.style.opacity = '0.5'; btn.textContent = 'Unavailable';
        return;
    }

    const subscribed = await window.zwanePush.isSubscribed();
    const permission = Notification.permission;

    if (subscribed && permission === 'granted') {
        label.textContent = '✓ Notifications enabled';
        label.style.color = '#10B981';
        btn.textContent = 'Disable';
        btn.style.background = '#FEF2F2';
        btn.style.color = '#EF4444';
        if (testBtn) testBtn.style.display = 'block';
    } else if (permission === 'denied') {
        label.textContent = 'Blocked — enable in browser settings';
        label.style.color = '#EF4444';
        btn.textContent = 'Blocked';
        btn.disabled = true;
        btn.style.opacity = '0.5';
        if (testBtn) testBtn.style.display = 'none';
    } else {
        label.textContent = 'Notifications disabled';
        label.style.color = '#0F172A';
        btn.textContent = 'Enable';
        btn.style.background = 'var(--color-primary, #E7762E)';
        btn.style.color = '#fff';
        if (testBtn) testBtn.style.display = 'none';
    }
}

window.togglePushNotifications = async function() {
    if (!window.zwanePush) return;
    const subscribed = await window.zwanePush.isSubscribed();
    if (subscribed) {
        await window.zwanePush.unsubscribe();
    } else {
        await window.zwanePush.askPermission();
    }
    setTimeout(refreshPushUI, 300);
};

window.testPushNotification = async function() {
    try {
        const r = await window.zwanePush.sendTest();
        if (r.sent > 0) {
            // visual feedback
        } else if (r.reason) {
            alert(`No notifications sent: ${r.reason}`);
        } else if (r.disabled) {
            alert('Push notifications are not configured on the server.');
        }
    } catch (e) {
        alert('Test failed: ' + e.message);
    }
};

// Refresh push UI when profile renders security tab
const _origRenderSecurityTab = window.renderSecurityTab;
setInterval(() => {
    if (document.getElementById('push-toggle-btn')) refreshPushUI();
}, 2000);

// ── Phone OTP Verification ─────────────────────────────────────
window.sendPhoneOTP = async function() {
    const phone  = document.getElementById('cell_tel_no')?.value.trim();
    const status = document.getElementById('otp-status');
    const row    = document.getElementById('otp-verify-row');
    const btn    = document.getElementById('btn-send-otp');
    if (!phone || phone.length < 10) { if (status) { status.textContent = 'Enter a valid 10-digit number first.'; status.style.color = '#ef4444'; } return; }
    btn.textContent = 'Sending…'; btn.disabled = true;
    try {
        const res  = await fetch('/api/messaging/otp', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });
        const json = await res.json();
        if (json.success || json.message) {
            if (row)    { row.style.display = 'flex'; }
            if (status) { status.textContent = 'Code sent! Check your SMS.'; status.style.color = '#10b981'; }
        } else {
            if (status) { status.textContent = json.error || 'Failed to send OTP.'; status.style.color = '#ef4444'; }
        }
    } catch (e) {
        if (status) { status.textContent = 'Network error. Try again.'; status.style.color = '#ef4444'; }
    } finally {
        btn.textContent = 'Resend'; btn.disabled = false;
    }
};

window.verifyPhoneOTP = async function() {
    const phone  = document.getElementById('cell_tel_no')?.value.trim();
    const otp    = document.getElementById('otp-input')?.value.trim();
    const status = document.getElementById('otp-status');
    if (!otp || otp.length !== 6) { if (status) { status.textContent = 'Enter the 6-digit code.'; status.style.color = '#ef4444'; } return; }
    try {
        const res  = await fetch('/api/messaging/verify-otp', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, otp })
        });
        const json = await res.json();
        if (json.valid) {
            if (status) { status.textContent = '✓ Phone number verified!'; status.style.color = '#10b981'; }
            const row = document.getElementById('otp-verify-row');
            if (row) row.style.display = 'none';
            const btn = document.getElementById('btn-send-otp');
            if (btn) { btn.textContent = '✓ Verified'; btn.style.background = '#10b981'; btn.disabled = true; }
        } else {
            if (status) { status.textContent = json.reason || 'Incorrect code. Try again.'; status.style.color = '#ef4444'; }
        }
    } catch (e) {
        if (status) { status.textContent = 'Verification failed. Try again.'; status.style.color = '#ef4444'; }
    }
};
