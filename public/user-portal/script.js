// Handles page switching
// Main Dashboard Script

// Safe global stubs for page-specific handlers — prevents inline onclick="..."
// from crashing during SPA page transitions when the owning script isn't loaded.
['toggleConsent'].forEach((fn) => {
  if (typeof window[fn] !== 'function') {
    window[fn] = function () {
      console.warn(`[stub] ${fn}() called before its module loaded — ignored`);
    };
  }
});

const NAV_SEARCH_ITEMS = [
  { label: 'Dashboard', page: 'dashboard', keywords: ['home', 'overview', 'metrics'] },
  { label: 'Apply Loan', page: 'apply-loan', keywords: ['documents', 'upload', 'kyc'] },
  { label: 'Apply Loan - Offers', page: 'apply-loan-2', keywords: ['credit', 'offer', 'summary'] },
  { label: 'Apply Loan - Config', page: 'apply-loan-3', keywords: ['loan config', 'terms', 'offer builder'] },
  { label: 'Confirmation', page: 'confirmation', keywords: ['bank', 'payout', 'final'] },
  { label: 'Payments', page: 'documents', keywords: ['transactions', 'payments', 'bank accounts'] },
  { label: 'Transcripts', page: 'transcripts', keywords: ['credit report', 'history', 'documents'] },
  { label: 'Notifications', page: 'notifications', keywords: ['alerts', 'messages'] },
  { label: 'Support', page: 'support', keywords: ['help', 'contact'] },
  { label: 'Loan Calculator', page: 'loan-calculator', keywords: ['calculator', 'estimate'] }
];

let navSearchMatches = [];
let navSearchActiveIndex = -1;
let globalUserProfile = null;
const DEFAULT_BRAND_LOGO = 'https://static.wixstatic.com/media/f82622_cde1fbd5680141c5b0fccca81fb92ad6~mv2.png';
const FALLBACK_SYSTEM_THEME = {
  primary_color: '#E7762E',
  secondary_color: '#F97316',
  tertiary_color: '#FACC15',
  theme_mode: 'light',
  company_logo_url: null
};
const SYSTEM_THEME_CACHE_MS = 5 * 60 * 1000;
let cachedSystemTheme = null;
let systemThemeFetchedAt = 0;
let systemThemePromise = null;

function isApplyLoanFlowPage(pageName = '') {
  // apply-loan (step 1) is allowed without profile completion — the in-page
  // declarations popup handles gating for consent / document buttons.
  return ['apply-loan-2', 'apply-loan-3', 'confirmation'].includes(pageName);
}

function getProfileState() {
  if (window.globalUserProfile) {
    globalUserProfile = window.globalUserProfile;
  } else if (globalUserProfile) {
    window.globalUserProfile = globalUserProfile;
  }
  return globalUserProfile;
}

// Measure the navbar height and expose it as a CSS variable
function setNavbarOffset() {
  try {
    const navbar = document.getElementById('navbar');
    const isMobile = window.innerWidth <= 768;

    const navbarOffset = (isMobile && navbar) ? (navbar.offsetHeight || 64) : 0;
    document.documentElement.style.setProperty('--navbar-offset', `${navbarOffset}px`);

    const header = document.querySelector('#main-content .dashboard-header');
    const headerOffset = (isMobile && header) ? (Math.ceil(header.getBoundingClientRect().height) || 56) : 0;
    document.documentElement.style.setProperty('--dashboard-header-offset', `${headerOffset}px`);

    const extraOffset = isMobile ? 24 : 0;
    document.documentElement.style.setProperty('--dashboard-extra-offset', `${extraOffset}px`);

    const dashContainer = document.querySelector('#main-content .dashboard-container');
    if (dashContainer) dashContainer.style.paddingTop = `calc(1rem + ${navbarOffset}px + ${headerOffset}px + ${extraOffset}px)`;
  } catch (err) {
    console.warn('setNavbarOffset error', err);
  }
}

// Initialize observers to watch navbar and dashboard header
function initOffsetObservers() {
  try {
    const navbar = document.getElementById('navbar');
    const header = document.querySelector('#main-content .dashboard-header');

    function scheduleRecalc() {
      if (window.__setNavbarOffsetTimeout) clearTimeout(window.__setNavbarOffsetTimeout);
      window.__setNavbarOffsetTimeout = setTimeout(() => setNavbarOffset(), 60);
    }

    // Disconnect any prior observers to prevent accumulation across page loads
    if (window.__zw_ro && typeof window.__zw_ro.disconnect === 'function') {
      try { window.__zw_ro.disconnect(); } catch (_) {}
    }
    if (window.__zw_mo && typeof window.__zw_mo.disconnect === 'function') {
      try { window.__zw_mo.disconnect(); } catch (_) {}
    }

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => scheduleRecalc());
      if (navbar) ro.observe(navbar);
      if (header) ro.observe(header);
      window.__zw_ro = ro;
    }

    if (header && window.MutationObserver) {
      const mo = new MutationObserver(() => scheduleRecalc());
      mo.observe(header, { childList: true, subtree: true, characterData: true });
      window.__zw_mo = mo;
    }
  } catch (err) {
    console.warn('initOffsetObservers error', err);
  }
}

// Per-session asset version (set once at script load) so the browser can cache
// page HTML/CSS/JS across tab switches instead of refetching every time.
const ASSET_VERSION = (window.__ZW_ASSET_VERSION = window.__ZW_ASSET_VERSION || Date.now());
const __pageHtmlCache = new Map();

// Track the navigation generation so a slow load can't overwrite a newer click.
let __navToken = 0;

function renderPageSkeleton(pageName) {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;
  const cards = (n) => Array.from({ length: n }, () => '<div class="sk sk-card"></div>').join('');
  const lines = (n) => Array.from({ length: n }, (_, i) =>
    `<div class="sk sk-line${i % 3 === 2 ? ' short' : ''}"></div>`
  ).join('');
  mainContent.innerHTML = `
    <div class="page-skeleton" aria-busy="true" aria-label="Loading">
      <div class="sk sk-title"></div>
      <div class="sk sk-sub"></div>
      <div class="sk-row">${cards(3)}</div>
      <div class="sk-row"><div class="sk sk-block"></div></div>
      <div class="sk-row">${lines(3)}</div>
    </div>`;
  mainContent.style.visibility = 'visible';
}

async function getSystemTheme(force = false) {
  const now = Date.now();
  const isCacheFresh = !force && cachedSystemTheme && (now - systemThemeFetchedAt) < SYSTEM_THEME_CACHE_MS;
  if (isCacheFresh) return cachedSystemTheme;

  if (!force && systemThemePromise) return systemThemePromise;

  systemThemePromise = (async () => {
    try {
      const response = await fetch('/api/system-settings');
      if (!response.ok) throw new Error(`Theme fetch failed (${response.status})`);
      const payload = await response.json();
      const normalized = { ...FALLBACK_SYSTEM_THEME, ...(payload?.data || payload || {}) };
      cachedSystemTheme = normalized;
      systemThemeFetchedAt = now;
      return normalized;
    } catch (error) {
      console.warn('System theme request failed:', error.message || error);
      if (!cachedSystemTheme) {
        cachedSystemTheme = { ...FALLBACK_SYSTEM_THEME };
      }
      return cachedSystemTheme;
    } finally {
      systemThemePromise = null;
    }
  })();

  return systemThemePromise;
}

function applyBrandLogo(theme) {
  const desiredLogo = (theme?.company_logo_url || '').trim() || DEFAULT_BRAND_LOGO;
  const targets = document.querySelectorAll('[data-brand-logo]');
  targets.forEach((target) => {
    if (target.tagName === 'IMG') {
      if (target.src !== desiredLogo) {
        target.src = desiredLogo;
      }
      target.onload = () => target.classList.remove('hidden');
      target.onerror = () => {
        target.src = DEFAULT_BRAND_LOGO;
      };
    } else {
      target.style.backgroundImage = `url('${desiredLogo}')`;
    }
  });
}

/** Convert a hex colour string (#RRGGBB or #RGB) to "R, G, B" format */
function hexToRgbString(hex) {
  if (!hex) return null;
  hex = hex.replace('#', '').trim();
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length !== 6) return null;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return isNaN(r) ? null : `${r}, ${g}, ${b}`;
}

/** Apply brand colours as CSS variables on :root so every stylesheet responds */
function applyBrandColors(theme) {
  const root = document.documentElement;
  const primary   = (theme?.primary_color   || '#E7762E').trim();
  const secondary = (theme?.secondary_color || '#F97316').trim();
  const tertiary  = (theme?.tertiary_color  || '#FACC15').trim();

  root.style.setProperty('--color-primary',   primary);
  root.style.setProperty('--color-secondary', secondary);
  root.style.setProperty('--color-tertiary',  tertiary);

  const primaryRgb = hexToRgbString(primary);
  if (primaryRgb) root.style.setProperty('--color-primary-rgb', primaryRgb);

  // Also feed the design-system tokens so ds-* variables update instantly
  root.style.setProperty('--ds-orange',     primary);
  root.style.setProperty('--ds-orange-rgb', primaryRgb || '231, 118, 46');
}

async function hydrateBranding() {
  try {
    const theme = await getSystemTheme();
    applyBrandLogo(theme);
    applyBrandColors(theme);
  } catch (error) {
    console.warn('Branding hydration error:', error);
    applyBrandLogo(FALLBACK_SYSTEM_THEME);
    applyBrandColors(FALLBACK_SYSTEM_THEME);
  }
}

// Periodic session validation
setInterval(async () => {
  try {
    const { supabase } = await import('/Services/supabaseClient.js');
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      console.log('🔒 Session validation failed - redirecting to login');
      window.location.replace('/auth/login.html');
    }
  } catch (err) {
    console.error('Session check error:', err);
  }
}, 2 * 60 * 1000);

// ================================================================
// DOM CONTENT LOADED - MAIN ENTRY POINT
// ================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication first
  const userProfile = await checkAuth(); 
  globalUserProfile = userProfile;
  window.globalUserProfile = userProfile;
  
  // Load navbar & sidebar
  await loadNavbar(); 
  setNavbarOffset(); 
  await loadSidebar(); 
  setNavbarOffset(); 
  
  // Populate user info (Initials & Dropdown data)
  if (userProfile) {
    populateUserDropdown(userProfile);
  }

  // Load Initial Page
  const initialPage = getPageFromURL() || 'dashboard';
  await loadPage(initialPage);
  setNavbarOffset();

  // Setup listeners 
  setupNavigation();
  loadUnreadCount();
  setupRealtimeNotifications();

  // Resize Listeners
  window.addEventListener('resize', setNavbarOffset);
  initOffsetObservers();
});

// Auth Check
async function checkAuth() {
  const { supabase } = await import('/Services/supabaseClient.js');
  
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    console.log('⛔ No session - redirecting to login');
    window.location.replace('/auth/login.html');
    return null;
  }
  
  const role = session.user?.app_metadata?.role || session.user?.user_metadata?.role || 'borrower';
  const ALLOWED_ROLES = ['borrower', 'super_admin', 'admin', 'base_admin', 'owner'];
  if (!ALLOWED_ROLES.includes(role)) {
    console.log('⛔ Access denied. Role not permitted:', role);
    await supabase.auth.signOut();
    window.location.replace('/auth/login.html');
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (!profile) {
    console.log('⛔ No profile row found for user');
    await supabase.auth.signOut();
    window.location.replace('/auth/login.html');
    return null;
  }
  profile.role = role;
  profile.email = profile.email || session.user?.email;
  
  const { data: financialProfile } = await supabase
    .from('financial_profiles')
    .select('*')
    .eq('user_id', profile.id)
    .maybeSingle();
  
  const { data: declarations } = await supabase
    .from('declarations')
    .select('*')
    .eq('user_id', profile.id)
    .maybeSingle();
  
  profile.hasFinancialProfile = !!financialProfile && financialProfile.monthly_income > 0;
  profile.hasDeclarations = !!declarations && declarations.accepted_std_conditions === true;
  profile.isProfileComplete = profile.hasFinancialProfile && profile.hasDeclarations;

  // Track last active time (non-blocking)
  supabase.from('profiles')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', profile.id)
    .then(() => {})
    .catch(() => {});

  return profile;
}

// Load Navbar
async function loadNavbar() {
  try {
    const response = await fetch('/user-portal/layouts/navbar.html');
    const html = await response.text();
    document.getElementById('navbar').innerHTML = html;
    
    // UI Interaction Controller (Toggles)
    setupNavbarInteractions();
    
    // Logic setup (Logout, Notification Data)
    setupAccountDropdownLogic();
    setupNotificationDropdownLogic();
    
    hydrateBranding();
  } catch (error) {
    console.error('Error loading navbar:', error);
  }
}

// Load Sidebar
async function loadSidebar() {
  try {
    const response = await fetch('/user-portal/layouts/sidebar.html');
    const html = await response.text();
    document.getElementById('sidebar').innerHTML = html;
    hydrateBranding();
    setupLogout();
    initLumaBar(); // Wire up mobile nav after HTML is injected
  } catch (error) {
    console.error('Error loading sidebar:', error);
  }
}

// ── Luma Bar — mobile floating nav ──────────────────────────────
function lumaUpdateGlow() {
  const dock   = document.getElementById('lumaDock');
  const glow   = document.getElementById('lumaGlow');
  const active = dock?.querySelector('.luma-item.active');
  if (!dock || !glow || !active) return;
  const dr = dock.getBoundingClientRect();
  const ar = active.getBoundingClientRect();
  glow.style.transform = `translateX(${ar.left - dr.left + ar.width / 2 - 32}px)`;
}

window.lumaNavigate = function(btn, page) {
  document.querySelectorAll('.luma-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  lumaUpdateGlow();
  if (typeof loadPage === 'function') loadPage(page);
  else window.location.href = '/user-portal/?page=' + page;
};

function initLumaBar() {
  // Set active item based on current page
  const currentPage = getPageFromURL() || 'dashboard';
  document.querySelectorAll('.luma-item[data-page]').forEach(b => {
    b.classList.toggle('active', b.dataset.page === currentPage);
  });
  setTimeout(lumaUpdateGlow, 80);

  // Sync glow when page changes via SPA router
  window.addEventListener('pageLoaded', e => {
    const page = e?.detail?.pageName;
    if (!page) return;
    document.querySelectorAll('.luma-item[data-page]').forEach(b => {
      b.classList.toggle('active', b.dataset.page === page);
    });
    lumaUpdateGlow();
  });

  // Re-calculate glow if screen resizes (orientation change)
  window.addEventListener('resize', lumaUpdateGlow);
}
// ─────────────────────────────────────────────────────────────────

// Load Page Logic
async function loadPage(pageName) {
  try {
    const profileState = getProfileState();
    const applyingForLoan = isApplyLoanFlowPage(pageName);

    if (profileState && !profileState.isProfileComplete && applyingForLoan) {
      showProfileIncompleteToast();
      window.history.replaceState({}, '', '/user-portal/?page=profile');
      pageName = 'profile';
    }
    
    if (profileState && profileState.needsPhoneNumber && applyingForLoan) {
      showPhoneNumberRequiredToast();
      return;
    }
    
    showLoading(true);

    // Show a skeleton immediately so the user never sees unstyled content.
    const myToken = ++__navToken;
    renderPageSkeleton(pageName);

    let cssPageName = pageName;
    if (pageName.startsWith('apply-loan-')) {
      cssPageName = 'apply-loan';
    }
    const cssUrl = `/user-portal/pages-css/${cssPageName}.css`;

    // Fetch HTML and stylesheet in parallel; await both before swapping.
    const htmlPromise = (async () => {
      let cached = __pageHtmlCache.get(pageName);
      if (cached) return cached;
      const htmlResponse = await fetch(`/user-portal/pages/${pageName}.html`);
      if (!htmlResponse.ok) throw new Error(`Page not found: ${pageName}`);
      const text = await htmlResponse.text();
      __pageHtmlCache.set(pageName, text);
      return text;
    })();

    const cssPromise = loadPageStylesheet(cssUrl).catch((e) => {
      console.warn(`Could not load CSS for ${pageName}.`, e?.message || e);
    });

    const [htmlContent] = await Promise.all([htmlPromise, cssPromise]);

    // If the user clicked another tab while we were loading, abandon this swap.
    if (myToken !== __navToken) return;

    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = htmlContent;
    mainContent.classList.remove('fade-in');
    // Force reflow so the animation re-triggers
    void mainContent.offsetWidth;
    mainContent.classList.add('fade-in');
    mainContent.style.visibility = 'visible';

    setNavbarOffset();
    if (typeof initOffsetObservers === 'function') initOffsetObservers();

    const scriptLoaded = await loadPageScript(pageName);
    if (!scriptLoaded) {
      console.warn(`JS for ${pageName} not found or failed to load.`);
    }

    document.dispatchEvent(new CustomEvent('pageLoaded', { detail: { pageName } }));
    window.dispatchEvent(new CustomEvent('pageLoaded', { detail: { pageName } }));
    
    if (pageName === 'dashboard') {
      setTimeout(() => {
        if (typeof loadDashboardData === 'function') {
          loadDashboardData();
        }
      }, 100);
    }

    if (pageName === 'apply-loan') {
      const modules = ['tillslip', 'bankstatement', 'idcard'];
      for (const module of modules) {
        try {
          await import(`/user-portal/modules-js/${module}.js?v=${ASSET_VERSION}`);
        } catch (error) {
          console.error(`❌ Failed to load ${module} module:`, error);
        }
      }
    }

    if (pageName === 'apply-loan-2') {
      try {
        const scriptUrl = `/user-portal/modules-js/credit-check.js?v=${ASSET_VERSION}`;
        fetch(scriptUrl)
          .then(response => response.text())
          .then(scriptContent => {
            const script = document.createElement('script');
            script.textContent = scriptContent;
            document.body.appendChild(script);
          })
          .catch(error => console.error('❌ Failed to load credit check script:', error));
      } catch (e) {
        console.error('❌ Error loading credit check module:', e);
      }
    }

    if (pageName === 'apply-loan-3') {
      try {
        const scriptUrl = `/user-portal/modules-js/loan-config.js?v=${ASSET_VERSION}`;
        fetch(scriptUrl)
          .then(response => response.text())
          .then(scriptContent => {
            const script = document.createElement('script');
            script.textContent = scriptContent;
            document.body.appendChild(script);
          })
          .catch(error => console.error('❌ Failed to load loan config script:', error));
      } catch (e) {
        console.error('❌ Error loading loan config module:', e);
      }
    }

    updateActiveNavLink(pageName);
    window.history.pushState({ page: pageName }, '', `/user-portal/?page=${pageName}`);
    showLoading(false);
  } catch (error) {
    console.error('Error loading page:', error);
    showLoading(false);
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.style.visibility = 'visible';
      mainContent.innerHTML = `
      <div class="page-content">
        <div class="card">
          <h2>⚠ Error Loading Page</h2>
          <p>Sorry, we couldn't load the page you requested. Please try again.</p>
        </div>
      </div>
    `;
    }
  }
}

async function loadPageStylesheet(cssUrl) {
  return new Promise((resolve, reject) => {
    const fullUrl = `${cssUrl}?v=${ASSET_VERSION}`;
    const existing = document.getElementById('page-specific-css');

    // Already the active stylesheet — nothing to do.
    if (existing && existing.href && existing.href.endsWith(`${cssUrl}?v=${ASSET_VERSION}`)) {
      resolve(true);
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = fullUrl;

    let settled = false;
    const complete = (ok) => {
      if (settled) return;
      settled = true;
      if (ok) {
        // Only remove the previous page CSS once the new one is parsed,
        // so we never get a flash of unstyled content.
        if (existing) existing.remove();
        link.id = 'page-specific-css';
        resolve(true);
      } else {
        try { link.remove(); } catch (_) {}
        reject(new Error('Stylesheet failed to load'));
      }
    };

    link.onload = () => complete(true);
    link.onerror = () => complete(false);

    document.head.appendChild(link);
  });
}

async function loadPageScript(pageName) {
  return new Promise((resolve) => {
    const existingScript = document.getElementById('page-specific-js');
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.id = 'page-specific-js';
    script.type = 'module';
    // Stable per-session URL so the browser can cache the module.
    script.src = `/user-portal/pages-js/${pageName}.js?v=${ASSET_VERSION}`;
    script.onload = () => resolve(true);
    script.onerror = () => {
      script.remove();
      resolve(false);
    };

    document.body.appendChild(script);
  });
}

async function fetchWithTimeout(resource, ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(resource, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

function setupNavigation() {
  document.addEventListener('click', (e) => {
    const navLink = e.target.closest('.nav-link');
    if (navLink) {
      e.preventDefault();
      const pageName = navLink.dataset.page;
      // Highlight immediately so the user sees the click register before loading.
      updateActiveNavLink(pageName);
      loadPage(pageName);
    }
  });
}

// ================================================================
// UNIFIED NAVBAR CONTROLLER (FIXED)
// ================================================================
function setupNavbarInteractions() {
  const isMobile = () => window.innerWidth <= 768;

  // 1. Search Logic
  // ------------------------------------------------------
  const desktopInput = document.getElementById('desktopSearchInput'); 
  const desktopResults = document.getElementById('desktopSearchResults'); 
  const mobileOverlay = document.getElementById('searchOverlay');
  const mobileInput = document.getElementById('mobileSearchInput');
  const closeSearchBtn = document.getElementById('closeSearch');
  
  // Desktop Search Button
  const desktopSearchBtn = document.getElementById('desktopSearchButton');
  if (desktopSearchBtn) {
    // Clone to remove old listeners
    const newBtn = desktopSearchBtn.cloneNode(true);
    desktopSearchBtn.parentNode.replaceChild(newBtn, desktopSearchBtn);

    newBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close other dropdowns first
      document.querySelectorAll('.notification-dropdown, .account-dropdown').forEach(el => el.classList.remove('active'));
      
      if (desktopResults) {
        desktopResults.classList.toggle('hidden');
        if (!desktopResults.classList.contains('hidden')) {
          desktopInput?.focus();
          // Trigger search immediately if there is text
          if (desktopInput.value) updateNavbarSearchDropdown(desktopInput.value);
        }
      }
    });
  }

  // Mobile Search Trigger
  const mobileSearchTrigger = document.getElementById('mobileSearchTrigger');
  if (mobileSearchTrigger) {
    const newBtn = mobileSearchTrigger.cloneNode(true);
    mobileSearchTrigger.parentNode.replaceChild(newBtn, mobileSearchTrigger);
    
    newBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (mobileOverlay) {
        mobileOverlay.classList.add('open');
        // Prevent background scroll and hide sticky dashboard header on mobile
        document.body.classList.add('search-overlay-open');
        
        // FIX: Explicitly hide dashboard header when search opens
        const dashboardHeader = document.querySelector('#main-content .dashboard-header');
        if (dashboardHeader) {
          dashboardHeader.style.display = 'none';
        }
        
        setTimeout(() => mobileInput?.focus(), 100);
        renderMobileResults(""); 
      }
    });
  }

  // Search Input Listeners (Typing)
  if (desktopInput) {
    desktopInput.addEventListener('input', (e) => updateNavbarSearchDropdown(e.target.value));
    desktopInput.addEventListener('focus', (e) => updateNavbarSearchDropdown(e.target.value));
  }
  if (mobileInput) {
    mobileInput.addEventListener('input', (e) => renderMobileResults(e.target.value));
  }
  if (closeSearchBtn && mobileOverlay) {
    closeSearchBtn.addEventListener('click', () => {
      mobileOverlay.classList.remove('open');
      document.body.classList.remove('search-overlay-open');
      
      // FIX: Restore dashboard header when search closes
      const dashboardHeader = document.querySelector('#main-content .dashboard-header');
      if (dashboardHeader) {
        dashboardHeader.style.display = '';
      }
    });
  }


  // 2. Dropdown Logic (Account & Notifications)
  // ------------------------------------------------------
  // Helper: Close all dropdowns
  const closeAllDropdowns = () => {
    if (desktopResults) desktopResults.classList.add('hidden');
    document.querySelectorAll('.notification-dropdown, .account-dropdown').forEach(el => el.classList.remove('active'));
  };

  // Generic Handler for Dropdown Toggles
  // This looks for the dropdown *inside* the same container as the clicked button
  // ensuring Mobile buttons open Mobile dropdowns, and Desktop opens Desktop.
  const setupDropdownToggle = (btnSelector, dropdownSelector) => {
    document.querySelectorAll(btnSelector).forEach(btn => {
      // remove old listeners by cloning
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);

      newBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Find the specific dropdown sibling to this button
        const container = newBtn.closest('.notification-dropdown-container') || newBtn.closest('.account-dropdown-container');
        const specificDropdown = container ? container.querySelector(dropdownSelector) : null;

        const wasActive = specificDropdown && specificDropdown.classList.contains('active');
        
        closeAllDropdowns(); // Close others

        if (!wasActive && specificDropdown) {
          specificDropdown.classList.add('active');
          
          // If it's the notification dropdown, load data
          if (dropdownSelector.includes('notification')) {
            if (typeof loadNotifications === 'function') loadNotifications();
            // Hide badge
            const badge = newBtn.querySelector('.notification-badge');
            if (badge) badge.style.display = 'none';
          }
        }
      });
    });
  };

  // Initialize Handlers
  setupDropdownToggle('.account-btn', '.account-dropdown');
  setupDropdownToggle('.notification-btn', '.notification-dropdown');

  // 3. Global Closer (Click Outside)
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.navbar-search') && 
        !e.target.closest('.notification-dropdown-container') && 
        !e.target.closest('.account-dropdown-container')) {
      closeAllDropdowns();
    }
  });
}
// ================================================================
// USER DATA & INITIALS POPULATION
// ================================================================
function populateUserDropdown(profile) {
  // 1. Update Names and Emails (Targeting ALL instances by class)
  if (profile.full_name) {
    document.querySelectorAll('.user-name').forEach(el => el.textContent = profile.full_name);
  }
  if (profile.email) {
    document.querySelectorAll('.user-email').forEach(el => el.textContent = profile.email);
  }

  // 2. Calculate Initials
  let initials = 'U';
  if (profile.full_name) {
    const names = profile.full_name.split(' ').filter(n => n.length > 0);
    initials = names.length > 1 
      ? names[0][0] + names[names.length - 1][0]
      : names[0][0];
    initials = initials.toUpperCase();
  }

  // 3. Update Avatars (Desktop & Mobile Dropdown Headers)
  document.querySelectorAll('.user-avatar').forEach(el => {
    el.innerHTML = `<span style="font-weight:700;">${initials}</span>`; 
  });

  // 4. Update Navbar Buttons (The circles in the top bar)
  const accountBtns = document.querySelectorAll('.account-btn');
  accountBtns.forEach(btn => {
    btn.innerHTML = ''; // Clean old icon
    const circle = document.createElement('div');
    circle.style.cssText = `
      width: 32px; height: 32px; background: var(--color-primary, #E7762E); 
      color: #fff; border-radius: 50%; display: flex; align-items: center; 
      justify-content: center; font-size: 14px; font-weight: 700;
      border: 2px solid #fff; user-select: none;
    `;
    circle.textContent = initials;
    btn.appendChild(circle);
  });
}

// ================================================================
// DROPDOWN CONTENT LOGIC
// ================================================================

function setupAccountDropdownLogic() {
  const logoutDropdownBtn = document.getElementById('logoutDropdownBtn');
  if (logoutDropdownBtn) {
    const newBtn = logoutDropdownBtn.cloneNode(true);
    logoutDropdownBtn.parentNode.replaceChild(newBtn, logoutDropdownBtn);

    newBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      showToast('Signing Out', 'Please wait while we sign you out...', 'info', 2000);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      try {
        const { supabase } = await import('/Services/supabaseClient.js');
        const { error } = await supabase.auth.signOut();
        
        if (error) {
          showToast('Error', 'Failed to sign out. Please try again.', 'warning', 3000);
          console.error('Sign out error:', error);
          return;
        }
        
        showToast('Goodbye! 👋', 'You have been signed out successfully.', 'success', 2000);
        
        setTimeout(() => {
          window.location.href = '/auth/login.html';
        }, 1500);
        
      } catch (err) {
        console.error('Logout error:', err);
        showToast('Error', 'Something went wrong. Please try again.', 'warning', 3000);
      }
    });
  }
}

function setupNotificationDropdownLogic() {
  const markAllReadBtn = document.querySelector('.mark-all-read-btn');
  if (markAllReadBtn) {
    const newBtn = markAllReadBtn.cloneNode(true);
    markAllReadBtn.parentNode.replaceChild(newBtn, markAllReadBtn);
    
    newBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      const { markAllAsRead } = await import('/Services/notificationService.js');
      await markAllAsRead();
      
      const unreadItems = document.querySelectorAll('.notification-item.unread');
      unreadItems.forEach(item => item.classList.remove('unread'));
      
      const badge = document.querySelector('.notification-badge');
      if (badge) {
        badge.textContent = '0';
        badge.style.display = 'none';
      }
    });
  }
}

// ================================================================
// SEARCH LOGIC & RENDERING
// ================================================================

function updateNavbarSearchDropdown(query = '') {
  // FIX: ID updated to 'desktopSearchResults'
  const dropdown = document.getElementById('desktopSearchResults'); 
  if (!dropdown) return;

  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    navSearchMatches = NAV_SEARCH_ITEMS.slice(0, 5);
  } else {
    navSearchMatches = NAV_SEARCH_ITEMS
      .map((item) => ({
        ...item,
        score: getNavbarSearchScore(item, normalized)
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }

  navSearchActiveIndex = navSearchMatches.length > 0 ? 0 : -1;
  renderNavbarSearchDropdown();
}

function renderNavbarSearchDropdown() {
  // FIX: ID updated to 'desktopSearchResults'
  const dropdown = document.getElementById('desktopSearchResults');
  if (!dropdown) return;

  if (!navSearchMatches || navSearchMatches.length === 0) {
    dropdown.innerHTML = '';
    dropdown.classList.add('hidden');
    return;
  }

  dropdown.innerHTML = navSearchMatches
    .map((item, index) => {
      const keywords = item.keywords?.slice(0, 2).join(', ');
      const meta = keywords ? `${item.page} · ${keywords}` : item.page;
      return `
        <div class="search-result-item ${index === navSearchActiveIndex ? 'active' : ''}" data-search-index="${index}" role="option" onclick="handleMenuNav('${item.page}')">
          <span class="search-result-label">${item.label}</span>
          <span class="search-result-meta">${meta}</span>
        </div>
      `;
    })
    .join('');

  // IMPORTANT: Make sure we unhide it when results are found
  dropdown.classList.remove('hidden');
}

function renderMobileResults(query) {
  const container = document.querySelector('.search-results-container');
  if (!container) return;

  const items = (typeof NAV_SEARCH_ITEMS !== 'undefined') ? NAV_SEARCH_ITEMS : [];
  let matches = [];

  const queryLower = query.toLowerCase().trim();

  if (!queryLower) {
    matches = items.slice(0, 5);
  } else {
    matches = items
      .map(item => ({
        ...item,
        score: getNavbarSearchScore(item, queryLower)
      }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }

  container.innerHTML = matches.length === 0 
    ? `<div style="padding: 20px; text-align: center; color: #9ca3af;">No matches found</div>`
    : matches.map(item => `
        <div class="menu-list-item" style="padding: 12px; border-bottom: 1px solid #f0f0f0; display:flex; justify-content:space-between; align-items:center;" onclick="handleMenuNav('${item.page}')">
          <div>
             <div style="font-weight:600; color:#333;">${item.label}</div>
             <small style="color: #9ca3af;">${item.page}</small>
          </div>
          <i class="fa-solid fa-chevron-right" style="color:#ccc;"></i>
        </div>
      `).join('');
}

function getNavbarSearchScore(item, normalizedQuery) {
  const label = item.label.toLowerCase();
  const keywords = (item.keywords || []).map((kw) => kw.toLowerCase());

  if (label === normalizedQuery) return 5;
  if (label.startsWith(normalizedQuery)) return 4;
  if (label.includes(normalizedQuery)) return 3;
  if (keywords.some((kw) => kw === normalizedQuery)) return 2;
  if (keywords.some((kw) => kw.includes(normalizedQuery))) return 1;
  return 0;
}

// ================================================================
// MOBILE NAVIGATION & ISLAND LOGIC (PRESERVED)
// ================================================================

function updateActiveNavLink(pageName) {
  // 1. Update standard Sidebar links
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.remove('active');
  });
  document.querySelector(`.nav-link[data-page="${pageName}"]`)?.classList.add('active');

  // 2. Update Mobile Island Dock icons (The lime green circle)
  document.querySelectorAll('.dock-item').forEach((item) => {
    item.classList.remove('active');
    
    // Check if the onclick attribute contains the current page name
    const onClickAttr = item.getAttribute('onclick') || '';
    if (onClickAttr.includes(`'${pageName}'`)) {
      item.classList.add('active');
    }
  });
}

// Mobile "More" Menu Listener
document.addEventListener('click', (e) => {
  const menuOverlay = document.getElementById('fullScreenMenu');
  if (!menuOverlay) return;

  // Toggle "More" Menu Open
  if (e.target.closest('#moreMenuToggle')) {
    menuOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  
  // Toggle "More" Menu Close
  if (e.target.closest('#closeMenu')) {
    menuOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }
});

window.handleMenuNav = function(pageName) {
  // 1. Close Sidebar/More Menu
  const menuOverlay = document.getElementById('fullScreenMenu');
  if (menuOverlay) {
    menuOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  // 2. NEW: Close Mobile Search Overlay
  const searchOverlay = document.getElementById('searchOverlay');
  if (searchOverlay) {
    searchOverlay.classList.remove('open');
    document.body.classList.remove('search-overlay-open');
    
    // FIX: Restore dashboard header when navigating away from search
    const dashboardHeader = document.querySelector('#main-content .dashboard-header');
    if (dashboardHeader) {
      dashboardHeader.style.display = '';
    }
  }
  
  // 3. Navigate
  if (typeof window.loadPage === 'function') {
    window.loadPage(pageName);
  } else {
    window.location.href = `/user-portal/?page=${pageName}`;
  }
};

// ================================================================
// NOTIFICATION LOGIC (FULL)
// ================================================================

async function loadNotifications() {
  const { fetchUserNotifications } = await import('/Services/notificationService.js');
  const { data: notifications } = await fetchUserNotifications(20);
  
  const notificationBody = document.querySelector('.notification-dropdown-body');
  if (!notificationBody) return;
  
  // 1. Styled Empty State
  if (!notifications || notifications.length === 0) {
    notificationBody.innerHTML = `
      <div class="notification-empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <p>All caught up! No new notifications.</p>
      </div>
    `;
    return;
  }
  
  // 2. Map notifications to non-bold HTML structure
  const listHtml = notifications.map(notif => {
    const timeAgo = getTimeAgo(new Date(notif.created_at));
    const iconType = getNotificationIconType(notif.type);
    
    return `
      <div class="notification-item ${!notif.is_read ? 'unread' : ''}" data-id="${notif.id}">
        <div class="notification-icon ${iconType}">
          ${getNotificationIcon(iconType)}
        </div>
        <div class="notification-content">
          <p class="notification-text">${notif.message}</p>
          <span class="notification-time">${timeAgo}</span>
        </div>
        <button class="notification-close-btn" data-id="${notif.id}" title="Dismiss">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `;
  }).join('');

  // 3. Set full HTML (List + Styled Footer)
  notificationBody.innerHTML = `
    <div class="notification-list-wrapper">
      ${listHtml}
    </div>
    <div class="notification-dropdown-footer">
      <button class="notification-footer-btn" onclick="handleMenuNav('notifications')">
        View All Notifications
      </button>
    </div>
  `;
  
  // 4. Re-attach interaction listeners
  attachNotificationListeners(notificationBody);
}

function attachNotificationListeners(container) {
  // Mark as Read Logic
  container.querySelectorAll('.notification-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      if (e.target.closest('.notification-close-btn')) return;
      
      const notifId = item.dataset.id;
      if (item.classList.contains('unread')) {
        const { markAsRead } = await import('/Services/notificationService.js');
        await markAsRead(notifId);
        item.classList.remove('unread');
        await loadUnreadCount();
      }
    });
  });

  // Delete/Dismiss Logic
  container.querySelectorAll('.notification-close-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const notifId = btn.dataset.id;
      const notifItem = btn.closest('.notification-item');
      
      // Visual feedback before removal
      notifItem.style.opacity = '0';
      notifItem.style.transform = 'translateX(20px)';
      
      setTimeout(async () => {
        const { deleteNotification } = await import('/Services/notificationService.js');
        await deleteNotification(notifId);
        notifItem.remove();
        await loadUnreadCount();

        // Check if list is now empty after deletion to show empty state
        if (container.querySelectorAll('.notification-item').length === 0) {
          loadNotifications(); 
        }
      }, 300);
    });
  });
}

async function loadUnreadCount() {
  const { getUnreadCount } = await import('/Services/notificationService.js');
  const { count } = await getUnreadCount();
  
  const badge = document.querySelector('.notification-badge');
  if (badge) {
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }
}

async function setupRealtimeNotifications() {
  const { supabase } = await import('/Services/supabaseClient.js');
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.warn('⚠️ Cannot setup real-time notifications: No user session');
    return;
  }
  
  console.log('🔌 Setting up real-time notifications for user:', user.id);
  
  const channel = supabase
    .channel('user-notifications-' + user.id)
    .on(
      'postgres_changes',
      {
        event: '*', 
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      },
      (payload) => {
        console.log('🔔 Real-time notification event:', payload.eventType, payload);
        loadUnreadCount();
        
        const notificationDropdown = document.querySelector('.notification-dropdown');
        if (notificationDropdown && notificationDropdown.classList.contains('active')) {
          loadNotifications();
        }
        
        if (payload.eventType === 'INSERT') {
          showNotificationToast(payload.new);
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Subscribed to real-time notifications');
      }
    });
  
  window.notificationChannel = channel;
}

function showNotificationToast(notification) {
  const toast = document.createElement('div');
  toast.className = 'notification-toast';
  toast.innerHTML = `
    <div class="toast-icon">${getNotificationIcon(getNotificationIconType(notification.type))}</div>
    <div class="toast-content">
      <strong>${notification.title || 'New Notification'}</strong>
      <p>${notification.message}</p>
    </div>
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 100);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

function showToast(title, message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = 'notification-toast';
  toast.innerHTML = `
    <div class="toast-icon">${getNotificationIcon(type)}</div>
    <div class="toast-content">
      <strong>${title}</strong>
      <p>${message}</p>
    </div>
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 100);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
window.showToast = showToast;

function getNotificationIconType(type) {
  const typeMap = {
    'application_status': 'info',
    'payment_due': 'warning',
    'application_submitted': 'success',
    'application_editable': 'info',
    'payment_received': 'success',
    'loan_disbursed': 'success',
    'document_required': 'warning',
    'account_updated': 'info'
  };
  return typeMap[type] || 'info';
}

function getNotificationIcon(type) {
  const icons = {
    success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
    warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
  };
  return icons[type] || icons.info;
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  const intervals = { year: 31536000, month: 2592000, week: 604800, day: 86400, hour: 3600, minute: 60 };
  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
  }
  return 'Just now';
}

function getPageFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('page');
}

function showLoading(show) {}

// ================================================================
// GUARDS & UTILS (FULL)
// ================================================================

function showPhoneNumberRequiredToast() {
  const existingToast = document.querySelector('.phone-required-toast');
  if (existingToast) return;
  
  const toast = document.createElement('div');
  toast.className = 'phone-required-toast';
  toast.style.cssText = `
    position: fixed; top: 90px; right: 20px; min-width: 350px; max-width: 450px;
    background: linear-gradient(135deg, #EF4444, #DC2626); color: white; padding: 1.25rem;
    border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4); border: 2px solid #EF4444;
    z-index: 9999; display: flex; gap: 12px; align-items: flex-start; animation: slideInRight 0.3s ease;
  `;
  
  toast.innerHTML = `
    <i class="fa-solid fa-phone-slash" style="font-size: 24px; flex-shrink: 0; margin-top: 2px;"></i>
    <div style="flex: 1;">
      <strong style="display: block; font-size: 1rem; margin-bottom: 4px;">Phone Number Required</strong>
      <p style="margin: 0; font-size: 0.9rem; opacity: 0.95; line-height: 1.4;">
        Please add your contact number to unlock full access to your account.
      </p>
    </div>
  `;
  
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

function lockNavigation() {
  document.addEventListener('click', (e) => {
    const navLink = e.target.closest('.nav-link');
    if (navLink && globalUserProfile?.needsPhoneNumber) {
      const page = navLink.dataset.page;
      if (page !== 'profile') {
        e.preventDefault();
        e.stopPropagation();
        showPhoneNumberRequiredToast();
      }
    }
  }, true);
  
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    if (link.dataset.page !== 'profile') {
      link.style.opacity = '0.5';
      link.style.cursor = 'not-allowed';
      link.style.pointerEvents = 'none';
    }
  });
}

function unlockNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.style.opacity = '';
    link.style.cursor = '';
    link.style.pointerEvents = '';
  });
  showToast('Account Unlocked', 'You now have full access to all features!', 'success', 3000);
}
window.unlockNavigation = unlockNavigation;

function showProfileIncompleteToast() {
  const profileState = getProfileState();
  const existingToast = document.querySelector('.profile-incomplete-toast');
  if (existingToast) {
    existingToast.style.animation = 'none';
    setTimeout(() => { existingToast.style.animation = 'pulse 0.3s ease'; }, 10);
    return;
  }
  
  const toast = document.createElement('div');
  toast.className = 'profile-incomplete-toast';
  toast.style.cssText = `
    position: fixed; top: 90px; right: 20px; background: linear-gradient(135deg, #EF4444, #DC2626);
    color: white; padding: 16px 24px; border-radius: 12px; box-shadow: 0 8px 24px rgba(239, 68, 68, 0.3);
    z-index: 10000; animation: slideInRight 0.3s ease; max-width: 400px; font-weight: 600;
    border: 2px solid rgba(255, 255, 255, 0.2);
  `;
  
  const missingItems = [];
  if (!profileState?.hasFinancialProfile) missingItems.push('Financial Information');
  if (!profileState?.hasDeclarations) missingItems.push('Declarations');
  
  toast.innerHTML = `
    <div style="display: flex; align-items: start; gap: 12px;">
      <i class="fa-solid fa-triangle-exclamation" style="font-size: 24px; margin-top: 2px;"></i>
      <div>
        <div style="font-size: 16px; margin-bottom: 8px;">Profile Incomplete</div>
        <div style="font-size: 13px; opacity: 0.95; line-height: 1.5;">
          Please complete: <strong>${missingItems.join(' & ')}</strong>
        </div>
        <div style="font-size: 12px; opacity: 0.85; margin-top: 6px;">
          Go to Profile → ${missingItems[0]}
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

function lockSidebar() {
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    if (link.dataset.page !== 'profile') {
      link.style.opacity = '0.4';
      link.style.cursor = 'not-allowed';
      link.style.pointerEvents = 'auto'; 
      link.style.filter = 'grayscale(1)';
      
      const icon = link.querySelector('i');
      if (icon && !link.querySelector('.lock-icon')) {
        const lockIcon = document.createElement('i');
        lockIcon.className = 'fa-solid fa-lock lock-icon';
        lockIcon.style.cssText = 'position: absolute; right: 12px; font-size: 12px; opacity: 0.6;';
        link.style.position = 'relative';
        link.appendChild(lockIcon);
      }
      
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showProfileIncompleteToast();
      });
    } else {
      link.style.background = 'linear-gradient(135deg, rgb(var(--color-primary-rgb) / 0.15), rgb(var(--color-primary-rgb) / 0.05))';
      link.style.borderLeft = '4px solid var(--color-primary)';
    }
  });
}

function unlockSidebar() {
  const incompleteToast = document.querySelector('.profile-incomplete-toast');
  if (incompleteToast) {
    incompleteToast.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => incompleteToast.remove(), 300);
  }
  
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.style.opacity = '';
    link.style.cursor = '';
    link.style.pointerEvents = '';
    link.style.filter = '';
    link.style.background = '';
    link.style.borderLeft = '';
    
    const lockIcon = link.querySelector('.lock-icon');
    if (lockIcon) lockIcon.remove();
    
    const newLink = link.cloneNode(true);
    link.parentNode.replaceChild(newLink, link);
  });
  
  setupNavigation();
  showToast('Profile Complete', 'You now have full access to all features!', 'success', 3000);
}
window.unlockSidebar = unlockSidebar;

let _logoutDelegationBound = false;
let _logoutInProgress = false;
async function setupLogout() {
  if (_logoutDelegationBound) return;
  _logoutDelegationBound = true;

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.logout-btn, .menu-logout-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if (_logoutInProgress) return;
    _logoutInProgress = true;

    showToast('Signing Out', 'Please wait while we sign you out...', 'info', 2000);

    const forceLocalLogoutAndRedirect = () => {
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith('sb-') || k.includes('supabase'))
          .forEach((k) => localStorage.removeItem(k));
        Object.keys(sessionStorage)
          .filter((k) => k.startsWith('sb-') || k.includes('supabase'))
          .forEach((k) => sessionStorage.removeItem(k));
      } catch (_) {}
      window.location.replace('/auth/login.html');
    };

    try {
      const { supabase } = await import('/Services/supabaseClient.js');
      let { error } = await supabase.auth.signOut();
      if (error) {
        console.warn('Server signOut error, falling back to local signOut:', error);
        try { await supabase.auth.signOut({ scope: 'local' }); } catch (_) {}
      }
      showToast('Goodbye!', 'You have been signed out successfully.', 'success', 1500);
      setTimeout(forceLocalLogoutAndRedirect, 600);
    } catch (err) {
      console.error('Logout error:', err);
      showToast('Signed out', 'Redirecting to login...', 'info', 1500);
      setTimeout(forceLocalLogoutAndRedirect, 600);
    }
  }, true);
}

window.addEventListener('popstate', (e) => {
  const pageName = e.state?.page || 'dashboard';
  loadPage(pageName);
});

// Bind logout delegation as early as possible (independent of sidebar load).
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setupLogout());
} else {
  setupLogout();
}