// Dashboard page JS - Final Production Hybrid
import '/user-portal/Services/sessionGuard.js'; 

// ==========================================
// 1. DATA STATE & CONSTANTS
// ==========================================
const dashboardData = {
    currentBalance: 0,
    nextPayment: { amount: 0, date: null, hasUpcoming: false },
    creditScore: 0,
    totalBorrowed: 0,
    totalRepaid: 0,
    repaymentSeries: null,
    loans: [],
    transactions: [],
    applications: []
};

// Pagination State
let currentLoansPage = 1;
const LOANS_PER_PAGE = 5;

const CREDIT_SCORE_MAX = 999;
const SCORE_RISK_COLORS = {
    'very low risk': { gradient: 'linear-gradient(90deg, #10b981, #22d3ee)', accent: '#10b981' },
    'low risk': { gradient: 'linear-gradient(90deg, #22c55e, #a3e635)', accent: '#22c55e' },
    'medium risk': { gradient: 'linear-gradient(90deg, var(--color-secondary), var(--color-tertiary))', accent: 'var(--color-secondary)' },
    'high risk': { gradient: 'linear-gradient(90deg, var(--color-secondary), #ef4444)', accent: '#ef4444' },
    'very high risk': { gradient: 'linear-gradient(90deg, #dc2626, #7f1d1d)', accent: '#dc2626' }
};

let repaymentChart, loanBreakdownChart;
const currencyFormatter = new Intl.NumberFormat('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getThemePalette = () => {
    const styles = getComputedStyle(document.documentElement);
    const read = (name, fallback) => (styles.getPropertyValue(name).trim() || fallback);
    const primary = read('--color-primary', '#E7762E');

    // Build a reliable rgba() that canvas accepts
    // CSS var might be "231 118 46", "231, 118, 46", or missing
    function primaryAlpha(alpha) {
        try {
            const raw = read('--color-primary-rgb', '231 118 46');
            // Normalise: remove commas, collapse whitespace → "R G B" → "R, G, B"
            const csv = raw.replace(/,/g, ' ').trim().replace(/\s+/g, ', ');
            const rgba = `rgba(${csv}, ${alpha})`;
            // Validate — new OffscreenCanvas test is too heavy; just check pattern
            if (!/^rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)$/.test(rgba)) {
                return `rgba(231, 118, 46, ${alpha})`; // hard fallback
            }
            return rgba;
        } catch (_) {
            return `rgba(231, 118, 46, ${alpha})`;
        }
    }

    return {
        primary,
        surfaceCard: read('--color-surface-card', '#FFFFFF'),
        primaryAlpha
    };
};

// ==========================================
// 2. UTILITY FUNCTIONS
// ==========================================
// ── Status label + colour formatter (single source of truth) ──────
const STATUS_DISPLAY = {
  'STARTED':           { label: 'In Progress',   color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
  'BUREAU_CHECKING':   { label: 'Credit Check',  color: '#3b82f6', bg: 'rgba(59,130,246,0.10)' },
  'BUREAU_OK':         { label: 'Credit Passed', color: '#3b82f6', bg: 'rgba(59,130,246,0.10)' },
  'BUREAU_DECLINE':    { label: 'Declined',      color: '#ef4444', bg: 'rgba(239,68,68,0.10)'  },
  'BUREAU_REFER':      { label: 'Under Review',  color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
  'AFFORD_OK':         { label: 'Approved',      color: '#10b981', bg: 'rgba(16,185,129,0.10)' },
  'AFFORD_REFER':      { label: 'Under Review',  color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
  'OFFERED':           { label: 'Offer Sent',    color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)' },
  'OFFER_ACCEPTED':    { label: 'Accepted',      color: '#10b981', bg: 'rgba(16,185,129,0.10)' },
  'CONTRACT_SIGN':     { label: 'Signing',       color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
  'DEBICHECK_AUTH':    { label: 'DebiCheck',     color: '#3b82f6', bg: 'rgba(59,130,246,0.10)' },
  'READY_TO_DISBURSE': { label: 'Approved',      color: '#10b981', bg: 'rgba(16,185,129,0.10)' },
  'DISBURSED':         { label: 'Disbursed',     color: '#10b981', bg: 'rgba(16,185,129,0.10)' },
  'ACTIVE':            { label: 'Active',        color: '#10b981', bg: 'rgba(16,185,129,0.10)' },
  'SETTLED':           { label: 'Settled',       color: '#6b7280', bg: 'rgba(107,114,128,0.10)' },
  'IN_ARREARS':        { label: 'In Arrears',    color: '#ef4444', bg: 'rgba(239,68,68,0.10)'  },
  'IN_DEFAULT':        { label: 'In Default',    color: '#dc2626', bg: 'rgba(220,38,38,0.10)'  },
  'CANCELLED':         { label: 'Cancelled',     color: '#6b7280', bg: 'rgba(107,114,128,0.10)' },
};

window.getStatusDisplay = function(status) {
  return STATUS_DISPLAY[status] || { label: status, color: '#6b7280', bg: 'rgba(107,114,128,0.10)' };
};

window.renderStatusBadge = function(status) {
  const s = window.getStatusDisplay(status);
  return `<span style="background:${s.bg};color:${s.color};padding:4px 10px;border-radius:100px;font-size:11px;font-weight:700;white-space:nowrap;">${s.label}</span>`;
};

function formatCurrency(value = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 'R 0.00';
    return `R ${currencyFormatter.format(numeric)}`;
}

function formatDueDate(date) {
    if (!date) return null;
    const dateObj = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(dateObj.getTime())) return null;
    return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function calculateMonthlyPayment(principal = 0, annualRate = 0, termMonths = 0) {
    const amount = Number(principal);
    const months = Number(termMonths);
    if (!amount || !months || months <= 0) return 0;
    const monthlyRate = Number(annualRate) / 12;
    if (!monthlyRate) return amount / months;
    const factor = Math.pow(1 + monthlyRate, months);
    return (amount * monthlyRate * factor) / (factor - 1);
}

function parseRandToNumber(val) {
    if (!val) return 0;
    return Number(String(val).replace(/[^0-9.-]/g, '')) || 0;
}

// ==========================================
// 3. UI RENDERING: CAROUSEL
// ==========================================
window.toggleFigureVisibility = function(btn) {
    const card = btn.closest('.snap-card');
    const valueEl = card.querySelector('.card-value');
    const icon = btn.querySelector('i');
    valueEl.classList.toggle('hidden-value');
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
};

function populateDashboardMetrics() {
    const container = document.getElementById('metricsCarousel');
    const dotContainer = document.getElementById('carouselDots');
    if (!container || !dotContainer) return;

    let paymentSubtitle = 'No upcoming payment';
    if (dashboardData.nextPayment.hasUpcoming && dashboardData.nextPayment.date) {
        paymentSubtitle = `Due ${formatDueDate(dashboardData.nextPayment.date)}`;
    } else if (!dashboardData.nextPayment.hasUpcoming && dashboardData.nextPayment.date) {
        paymentSubtitle = `Last paid ${formatDueDate(dashboardData.nextPayment.date)}`;
    }

    const slides = [
        { label: 'Next Payment Due', value: formatCurrency(dashboardData.nextPayment.amount), subtitle: paymentSubtitle },
        { label: 'Outstanding Balance', value: formatCurrency(dashboardData.currentBalance), subtitle: 'Total principal remaining' },
        { label: 'Credit Score', value: dashboardData.creditScore || '---', subtitle: 'Excellent Financial Standing' },
        { label: 'Total Repaid', value: formatCurrency(dashboardData.totalRepaid), subtitle: 'Successfully settled' },
        { label: 'Total Borrowed', value: formatCurrency(dashboardData.totalBorrowed), subtitle: 'Lifetime capacity' }
    ];

    container.innerHTML = slides.map(slide => `
        <div class="snap-card">
            <button class="hide-eye-btn" onclick="toggleFigureVisibility(this)">
                <i class="fas fa-eye"></i>
            </button>
            <div class="card-content">
                <p class="card-label">${slide.label}</p>
                <h2 class="card-value">${slide.value}</h2>
                <p class="card-detail">${slide.subtitle}</p>
            </div>
        </div>
    `).join('');

    dotContainer.innerHTML = slides.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}"></span>`).join('');

    container.addEventListener('scroll', () => {
        const index = Math.round(container.scrollLeft / container.offsetWidth);
        document.querySelectorAll('.dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });
    });
}

// ==========================================
// 4. UI RENDERING: DESKTOP SCORE & PAGINATION
// ==========================================
function applyCreditScoreToDashboard(creditData) {
    const scoreElement = document.getElementById('creditScore');
    const scoreFill = document.querySelector('.credit-score-card .score-fill');
    if (!scoreElement || !scoreFill) return;

    if (!creditData) {
        scoreElement.textContent = '---';
        scoreFill.style.width = '0%';
        return;
    }

    const rawScore = Number(creditData.credit_score ?? creditData.score ?? 0);
    const clampedScore = Math.max(0, Math.min(rawScore, CREDIT_SCORE_MAX));
    const percentage = Math.round((clampedScore / CREDIT_SCORE_MAX) * 100);
    
    const riskLabel = (creditData.score_band || 'Medium Risk').toLowerCase();
    const colorMeta = SCORE_RISK_COLORS[riskLabel] || SCORE_RISK_COLORS['medium risk'];

    // Animated score count-up
    const duration = 1600;
    const startTime = performance.now();
    const startVal = parseInt(scoreElement.textContent) || 0;
    (function tick(now) {
        const elapsed  = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out-cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        scoreElement.textContent = Math.round(startVal + (clampedScore - startVal) * eased).toString();
        if (progress < 1) requestAnimationFrame(tick);
    })(performance.now());

    // Animated bar fill — start from 0 then transition
    scoreFill.style.transition = 'none';
    scoreFill.style.width = '0%';
    scoreFill.style.background = colorMeta.gradient;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            scoreFill.style.transition = 'width 1.6s cubic-bezier(0.22, 1, 0.36, 1)';
            scoreFill.style.width = `${percentage}%`;
        });
    });

    dashboardData.creditScore = clampedScore;
}

window.changeLoanPage = function(direction) {
    const active = dashboardData.loans.filter(l => l.status === 'Active' || l.status === 'Offered');
    const maxPage = Math.ceil(active.length / LOANS_PER_PAGE) || 1;
    currentLoansPage += direction;
    if (currentLoansPage < 1) currentLoansPage = 1;
    if (currentLoansPage > maxPage) currentLoansPage = maxPage;
    populateActiveLoans();
};

function getPaginationHtml(totalItems) {
    const maxPage = Math.ceil(totalItems / LOANS_PER_PAGE) || 1;
    if (maxPage <= 1) return '';
    return `
        <div class="pagination-controls">
            <button class="page-btn" onclick="changeLoanPage(-1)" ${currentLoansPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>
            <span class="page-indicator">Page ${currentLoansPage} of ${maxPage}</span>
            <button class="page-btn" onclick="changeLoanPage(1)" ${currentLoansPage === maxPage ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>
        </div>
    `;
}

// ==========================================
// 5. UI RENDERING: LISTS (DESKTOP & MOBILE)
// ==========================================
// ── Helpers for improved loan cards ──────────────────────────────
function getLoanHealth(loan) {
    const days = loan.rawDaysUntilDue;
    const s    = (loan.rawStatus || '').toUpperCase();
    if (s === 'IN_DEFAULT')  return { label: 'In Default',    color: '#dc2626', bg: 'rgba(220,38,38,0.10)',   icon: 'fa-circle-exclamation' };
    if (s === 'IN_ARREARS')  return { label: 'In Arrears',    color: '#ef4444', bg: 'rgba(239,68,68,0.10)',   icon: 'fa-triangle-exclamation' };
    if (days !== null && days < 0)  return { label: 'Overdue',       color: '#ef4444', bg: 'rgba(239,68,68,0.10)',   icon: 'fa-triangle-exclamation' };
    if (days !== null && days === 0) return { label: 'Due Today',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: 'fa-bell' };
    if (days !== null && days <= 3)  return { label: `${days}d left`, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: 'fa-clock' };
    if (days !== null && days <= 7)  return { label: `${days} days`,  color: '#3b82f6', bg: 'rgba(59,130,246,0.10)',  icon: 'fa-calendar' };
    return { label: 'On Track', color: '#10b981', bg: 'rgba(16,185,129,0.10)', icon: 'fa-circle-check' };
}

function getCountdownText(loan) {
    const days = loan.rawDaysUntilDue;
    if (days === null) return null;
    if (days < 0)  return { text: `${Math.abs(days)} days overdue`, urgent: true };
    if (days === 0) return { text: 'Due today!', urgent: true };
    if (days === 1) return { text: 'Due tomorrow', urgent: true };
    if (days <= 7)  return { text: `Due in ${days} days`, urgent: false };
    return { text: `Due in ${days} days`, urgent: false };
}

function buildRingProgress(pct, size = 56) {
    const r = (size / 2) - 5;
    const circ = 2 * Math.PI * r;
    const fill = (pct / 100) * circ;
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg);flex-shrink:0">
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="#f0f0f0" stroke-width="4"/>
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--color-primary,#E7762E)" stroke-width="4"
          stroke-dasharray="${fill} ${circ}" stroke-linecap="round"
          style="transition:stroke-dasharray 1.2s cubic-bezier(0.22,1,0.36,1)"/>
      </svg>
      <span style="position:absolute;font-size:10px;font-weight:800;color:var(--text-main)">${pct}%</span>`;
}

function buildLoanCard(loan, isMobile = false) {
    const progress = loan.rawTotal > 0
        ? Math.max(0, Math.min(100, Math.round(((loan.rawTotal - loan.rawRemaining) / loan.rawTotal) * 100)))
        : 0;
    const health    = getLoanHealth(loan);
    const countdown = getCountdownText(loan);
    const urgentBorder = (health.color === '#ef4444' || health.color === '#f59e0b')
        ? `border-left: 3px solid ${health.color};` : '';

    // Feature 5: Statement download button
    const stmtBtn = `
      <button onclick="window.downloadLoanStatement('${loan.rawId || loan.id}')"
        style="display:flex;align-items:center;gap:6px;background:none;border:1px solid rgba(0,0,0,0.1);
               border-radius:8px;padding:6px 12px;font-size:11px;font-weight:700;color:var(--text-muted);
               cursor:pointer;transition:all 0.2s;margin-top:12px;width:100%;"
        onmouseover="this.style.borderColor='var(--color-primary)';this.style.color='var(--color-primary)'"
        onmouseout="this.style.borderColor='rgba(0,0,0,0.1)';this.style.color='var(--text-muted)'">
        <i class="fas fa-file-lines" style="font-size:11px"></i> Download Statement
      </button>`;

    // Feature 1: Payment countdown banner
    const countdownBanner = countdown ? `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:10px;
                  background:${countdown.urgent ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.06)'};
                  margin-bottom:12px;border:1px solid ${countdown.urgent ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.15)'}">
        <i class="fas fa-${countdown.urgent ? 'bell' : 'calendar-check'}"
           style="font-size:12px;color:${countdown.urgent ? '#f59e0b' : '#10b981'}"></i>
        <span style="font-size:12px;font-weight:700;color:${countdown.urgent ? '#92400e' : '#065f46'}">
          ${countdown.text} · ${loan.nextPayment}
        </span>
      </div>` : '';

    if (isMobile) {
        return `
        <div class="loan-card-hifi" style="${urgentBorder}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span style="font-size:13px;font-weight:600;color:var(--text-muted)">${loan.id}</span>
            <!-- Feature 2: Health badge -->
            <span style="background:${health.bg};color:${health.color};padding:5px 10px;border-radius:100px;
                         font-size:11px;font-weight:700;display:flex;align-items:center;gap:5px;">
              <i class="fas ${health.icon}" style="font-size:9px"></i>${health.label}
            </span>
          </div>

          <div style="font-size:30px;font-weight:800;color:var(--text-main);letter-spacing:-1px;margin-bottom:4px">${loan.amount}</div>
          <div style="font-size:12px;color:var(--text-muted);font-weight:600;margin-bottom:14px">${loan.remaining} remaining</div>

          ${countdownBanner}

          <!-- Feature 4: Ring progress -->
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:14px">
            <div style="position:relative;display:flex;align-items:center;justify-content:center;width:56px;height:56px">
              ${buildRingProgress(progress)}
            </div>
            <div style="flex:1">
              <div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Repaid</div>
              <div style="font-size:16px;font-weight:800;color:var(--text-main)">${formatCurrency(loan.rawTotal - loan.rawRemaining)}</div>
              <div style="font-size:11px;color:var(--text-muted)">of ${loan.amount}</div>
            </div>
            <div style="flex:1;text-align:right">
              <div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Rate</div>
              <div style="font-size:16px;font-weight:800;color:var(--text-main)">${loan.interestRate}</div>
              <div style="font-size:11px;color:var(--text-muted)">per month</div>
            </div>
          </div>

          ${stmtBtn}
        </div>`;
    }

    // Desktop card
    return `
    <div class="loan-card" style="${urgentBorder}">
      <div class="loan-header">
        <span class="loan-id">${loan.id}</span>
        <!-- Feature 2: Health badge -->
        <span style="background:${health.bg};color:${health.color};padding:5px 12px;border-radius:100px;
                     font-size:11px;font-weight:700;display:flex;align-items:center;gap:5px;">
          <i class="fas ${health.icon}" style="font-size:9px"></i>${health.label}
        </span>
      </div>

      <div class="loan-amount">${loan.amount}</div>

      ${countdownBanner}

      <div class="loan-details-grid">
        <div class="loan-detail"><div class="loan-detail-label">Remaining</div><div class="loan-detail-value">${loan.remaining}</div></div>
        <div class="loan-detail"><div class="loan-detail-label">Next Payment</div><div class="loan-detail-value">${loan.nextPayment}</div></div>
        <div class="loan-detail"><div class="loan-detail-label">Due Date</div><div class="loan-detail-value">${loan.dueDate}</div></div>
        <div class="loan-detail"><div class="loan-detail-label">Interest Rate</div><div class="loan-detail-value">${loan.interestRate}</div></div>
      </div>

      <!-- Feature 4: Ring progress -->
      <div style="display:flex;align-items:center;gap:12px;padding:12px 0 4px">
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:52px;height:52px;flex-shrink:0">
          ${buildRingProgress(progress, 52)}
        </div>
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:6px">
            <span>Repayment Progress</span><span>${progress}%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
        </div>
      </div>

      ${stmtBtn}
    </div>`;
}

// Feature 3: Empty state with CTA
function buildEmptyState(isMobile = false) {
    return `
    <div style="text-align:center;padding:${isMobile ? '40px 20px' : '60px 20px'};${isMobile ? '' : 'grid-column:1/-1;'}">
      <div style="width:72px;height:72px;background:rgba(231,118,46,0.08);border-radius:50%;
                  display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
        <i class="fas fa-file-contract" style="font-size:28px;color:var(--color-primary)"></i>
      </div>
      <h3 style="font-size:18px;font-weight:700;color:var(--text-main);margin:0 0 8px">No active loans</h3>
      <p style="font-size:14px;color:var(--text-muted);margin:0 0 20px;line-height:1.5">
        Ready to apply? Get a decision in minutes.
      </p>
      <button onclick="${isMobile ? "if(typeof loadPage==='function')loadPage('apply-loan');else window.location.href='/user-portal/?page=apply-loan'" : "createNewApplication()"}"
        style="background:linear-gradient(135deg,var(--color-primary),#f08840);color:white;border:none;
               padding:14px 28px;border-radius:14px;font-size:14px;font-weight:700;cursor:pointer;
               box-shadow:0 4px 16px rgba(231,118,46,0.3)">
        Apply for a Loan <i class="fas fa-arrow-right" style="margin-left:8px"></i>
      </button>
    </div>`;
}

function populateActiveLoans() {
    const allActive = dashboardData.loans.filter(l => l.status === 'Active' || l.status === 'Offered');
    const startIdx       = (currentLoansPage - 1) * LOANS_PER_PAGE;
    const activePaginated = allActive.slice(startIdx, startIdx + LOANS_PER_PAGE);
    const paginationHtml  = getPaginationHtml(allActive.length);

    // Desktop
    const desktopGrid = document.getElementById('activeLoansGrid');
    if (desktopGrid) {
        desktopGrid.innerHTML = allActive.length === 0
            ? buildEmptyState(false)
            : activePaginated.map(l => buildLoanCard(l, false)).join('') ;

        const wrapper = document.getElementById('activeLoansGridWrapper');
        if (wrapper) {
            const oldPg = wrapper.querySelector('.pagination-controls');
            if (oldPg) oldPg.remove();
            if (allActive.length > 0) wrapper.insertAdjacentHTML('beforeend', paginationHtml);
        }
    }

    // Mobile
    const mobileGrid = document.getElementById('activeLoansGridMobile');
    if (mobileGrid) {
        mobileGrid.innerHTML = allActive.length === 0
            ? buildEmptyState(true)
            : activePaginated.map(l => buildLoanCard(l, true)).join('') + paginationHtml;
    }

    // Animate rings after render
    requestAnimationFrame(() => {
        document.querySelectorAll('.loan-card circle:last-child, .loan-card-hifi circle:last-child').forEach(c => {
            const orig = c.getAttribute('stroke-dasharray');
            c.setAttribute('stroke-dasharray', `0 ${2 * Math.PI * parseFloat(c.getAttribute('r'))}`);
            setTimeout(() => c.setAttribute('stroke-dasharray', orig), 50);
        });
    });
}

function populateTransactions() {
    const transactionList = document.getElementById('transactionList');
    if (!transactionList) return;
    const recentTransactions = dashboardData.transactions.slice(0, 5);
    if (recentTransactions.length === 0) {
        transactionList.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No transactions yet</p>'; return;
    }
    transactionList.innerHTML = recentTransactions.map(tx => `
        <div class="transaction-item">
            <div class="transaction-icon ${tx.type}"><i class="fas fa-${tx.type === 'inbound' ? 'arrow-down' : 'arrow-up'}"></i></div>
            <div class="item-details"><div class="item-title">${tx.description}</div><div class="item-date">${tx.date}</div></div>
            <div class="item-amount ${tx.type}">${tx.amount}</div>
        </div>
    `).join('');
}

function populateApplications() {
    const applicationList = document.getElementById('applicationList');
    if (!applicationList) return;
    const recentApplications = dashboardData.applications.slice(0, 5);
    if (recentApplications.length === 0) {
        applicationList.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No applications yet</p>'; return;
    }
    applicationList.innerHTML = recentApplications.map(app => {
        const now = new Date();
        const createdAt = new Date(app.createdAt);
        const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);
        const withinTimeWindow = hoursSinceCreation < 2;
        
        const canEdit = withinTimeWindow && app.status !== 'AFFORD_OK' && app.status !== 'APPROVED';
        const canDelete = withinTimeWindow && app.status !== 'APPROVED';
        
        const editLockReason = app.status === 'AFFORD_OK' ? 'Edit locked' : app.status === 'APPROVED' ? 'Edit locked' : 'Edit locked after 2 hours';
        const deleteLockReason = app.status === 'APPROVED' ? 'Delete locked' : 'Delete locked after 2 hours';

        return `
        <div class="application-item">
            <div class="application-icon ${app.status.toLowerCase()}"><i class="fas fa-${app.status === 'Approved' ? 'check' : app.status === 'Pending' ? 'clock' : 'times'}"></i></div>
            <div class="item-details"><div class="item-title">${app.type}</div><div class="item-date">${app.date}</div></div>
            <div style="display: flex; align-items: center; gap: 8px;">
                ${window.renderStatusBadge(app.status)}
                <button class="app-action-btn ${!canEdit ? 'locked' : ''}" onclick="editApplication('${app.rawId}')" ${!canEdit ? 'disabled' : ''} title="${!canEdit ? editLockReason : 'Edit'}">
                    <i class="fas fa-${!canEdit ? 'lock' : 'edit'}"></i>
                </button>
                <button class="app-action-btn delete ${!canDelete ? 'locked' : ''}" onclick="deleteApplication('${app.rawId}')" ${!canDelete ? 'disabled' : ''} title="${!canDelete ? deleteLockReason : 'Delete'}">
                    <i class="fas fa-${!canDelete ? 'lock' : 'trash'}"></i>
                </button>
            </div>
        </div>`;
    }).join('');
}

// ==========================================
// 6. CHARTS & VISUALIZATIONS
// ==========================================
function computeRepaymentSuggestedMax(data = []) {
    const numericData = Array.isArray(data) ? data.map(v => Number(v) || 0) : [];
    const maxVal = Math.max(...numericData, 0);
    const minFloor = 10000;
    const padded = maxVal * 1.25 + 500;
    const bigFloor = maxVal > 200000 ? 300000 : 0;
    return Math.max(padded, minFloor, bigFloor);
}

function buildMonthlySeries(monthCount, payments = []) {
    const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });
    const now = new Date();
    const months = Array.from({ length: monthCount }, (_, i) => {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (monthCount - 1 - i), 1));
        return { key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, label: monthFormatter.format(d) };
    });

    const buckets = months.reduce((acc, m) => ({ ...acc, [m.key]: 0 }), {});
    (payments || []).forEach((p) => {
        if (!p.payment_date) return;
        const dt = new Date(p.payment_date);
        if (Number.isNaN(dt.getTime())) return;
        const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
        if (key in buckets) buckets[key] += Number(p.amount) || 0;
    });

    return { labels: months.map(m => m.label), data: months.map(m => buckets[m.key]) };
}

function applyRepaymentChart(labels = [], data = []) {
    if (!repaymentChart) {
        dashboardData.repaymentSeries = { labels, data };
        return;
    }
    repaymentChart.data.labels = labels;
    repaymentChart.data.datasets[0].data = data;
    repaymentChart.options.scales.y.suggestedMax = computeRepaymentSuggestedMax(data);
    repaymentChart.update();
}

function initializeCharts() {
  try {
    const palette = getThemePalette();
    const repaymentCtx = document.getElementById('repaymentChart');

    if (repaymentCtx) {
        const lineCtx = repaymentCtx.getContext('2d');
        const h = repaymentCtx.clientHeight || repaymentCtx.height || 200;
        const lineGradient = lineCtx.createLinearGradient(0, 0, 0, h);
        lineGradient.addColorStop(0, palette.primaryAlpha(0.35));
        lineGradient.addColorStop(1, palette.primaryAlpha(0.05));

        repaymentChart = new Chart(repaymentCtx, {
            type: 'line',
            data: {
                labels: dashboardData.repaymentSeries?.labels || ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'],
                datasets: [{
                    label: 'Payments Made',
                    data: dashboardData.repaymentSeries?.data || [0, 0, 0, 0, 0, 0],
                    borderColor: palette.primary,
                    backgroundColor: lineGradient,
                    borderWidth: 3, fill: true, tension: 0.45,
                    pointRadius: 5, pointHoverRadius: 8,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: palette.primary, pointBorderWidth: 3,
                    pointHoverBackgroundColor: palette.primary,
                    pointHoverBorderColor: '#ffffff', pointHoverBorderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1400,
                    easing: 'easeInOutQuart',
                    x: { type: 'number', easing: 'easeInOutQuart', duration: 1400, from: NaN, delay(ctx) { return ctx.index * 80; } },
                    y: { type: 'number', easing: 'easeOutBounce', duration: 1400, from(ctx) { return ctx.index === 0 ? ctx.chart.scales.y.getPixelForValue(100) : ctx.chart.getDatasetMeta(ctx.datasetIndex).data[ctx.index - 1].getProps(['y'], true).y; } }
                },
                transitions: { active: { animation: { duration: 300 } } },
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0F172A',
                        titleColor: '#fff',
                        bodyColor: '#ffead6',
                        borderColor: 'rgba(231,118,46,0.3)',
                        borderWidth: 1,
                        padding: 14,
                        displayColors: false,
                        cornerRadius: 12,
                        callbacks: { label: ctx => '  R ' + ctx.parsed.y.toLocaleString() }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        suggestedMax: computeRepaymentSuggestedMax(dashboardData.repaymentSeries?.data || [0,0,0,0,0,0]),
                        grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
                        ticks: { color: '#8E8E93', font: { size: 10, family: 'IBM Plex Sans' }, callback: v => 'R' + (v >= 1000 ? (v/1000)+'k' : v) }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#8E8E93', font: { size: 10, family: 'IBM Plex Sans' } }
                    }
                }
            }
        });
        if (dashboardData.repaymentSeries) applyRepaymentChart(dashboardData.repaymentSeries.labels, dashboardData.repaymentSeries.data);
    }

    const breakdownCtx = document.getElementById('loanBreakdownChart');
    if (breakdownCtx) {
        const donutCtx = breakdownCtx.getContext('2d');
        const brightOrange = donutCtx.createLinearGradient(0, 0, breakdownCtx.width, breakdownCtx.height);
        brightOrange.addColorStop(0, palette.primaryAlpha(0.95));
        brightOrange.addColorStop(1, palette.primaryAlpha(0.9));

        loanBreakdownChart = new Chart(breakdownCtx, {
            type: 'doughnut',
            data: {
                labels: ['Repaid', 'Outstanding'],
                datasets: [{
                    data: [1, 1],
                    backgroundColor: [brightOrange, 'rgba(0,0,0,0.06)'],
                    borderColor: [palette.primary, 'rgba(0,0,0,0.0)'],
                    hoverBorderColor: [palette.primary, palette.primaryAlpha(0.4)],
                    borderWidth: 2,
                    hoverOffset: 10,
                    offset: 4,
                    borderRadius: 6,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 1200,
                    easing: 'easeInOutQuart',
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#0F172A',
                            padding: 16,
                            font: { size: 11, family: 'IBM Plex Sans', weight: '600' },
                            usePointStyle: true,
                            pointStyle: 'circle',
                            boxWidth: 8,
                        }
                    },
                    tooltip: {
                        backgroundColor: '#0F172A',
                        titleColor: '#fff',
                        bodyColor: '#ffead6',
                        borderColor: 'rgba(231,118,46,0.3)',
                        borderWidth: 1,
                        padding: 14,
                        cornerRadius: 12,
                        callbacks: {
                            label: ctx => {
                                const total = ctx.dataset.data.reduce((a,b) => a+b, 0);
                                const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                                return `  ${ctx.label}: R ${ctx.parsed.toLocaleString()} (${pct}%)`;
                            }
                        }
                    }
                },
                cutout: '70%',
                rotation: -90
            }
        });
        updateLoanBreakdownChart(dashboardData.totalRepaid, dashboardData.currentBalance);
    }
  } catch (chartErr) {
    console.warn('[charts] initializeCharts failed:', chartErr.message);
  }
}

function updateLoanBreakdownChart(totalRepaid = 0, outstanding = 0) {
    dashboardData.totalRepaid = totalRepaid; dashboardData.currentBalance = outstanding;
    if (!loanBreakdownChart) return;
    const dataset = loanBreakdownChart.data?.datasets?.[0];
    if (!dataset) return;
    
    const repaidVal = Math.max(totalRepaid, 0);
    const outstandingVal = Math.max(outstanding, 0);
    dataset.data = (repaidVal > 0 || outstandingVal > 0) ? [repaidVal, outstandingVal] : [1, 1];
    loanBreakdownChart.update();
}

function getRepaymentSeriesForPeriod(period = '6m') {
    const fallback6m = buildMonthlySeries(6, []);
    const base6m = dashboardData.repaymentSeries6 || dashboardData.repaymentSeries || fallback6m;
    if (period === '1y') return dashboardData.repaymentSeries12 || base6m || buildMonthlySeries(12, []);
    if (period === 'all') return dashboardData.repaymentSeries12 || base6m;
    return base6m;
}

window.updateChartPeriod = function(period) {
    document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
    if (typeof event !== 'undefined' && event?.target) event.target.classList.add('active');

    const series = getRepaymentSeriesForPeriod(period);
    if (repaymentChart && series) {
        repaymentChart.data.labels = series.labels || [];
        repaymentChart.data.datasets[0].data = series.data || [];
        repaymentChart.options.scales.y.suggestedMax = computeRepaymentSuggestedMax(series.data || []);
        repaymentChart.update();
    }
};

async function ensureChartJs() {
    if (typeof Chart !== 'undefined') return true;
    const existingScript = document.querySelector('script[src*="chart.js"]');
    if (existingScript) {
        return new Promise((resolve) => {
            if (typeof Chart !== 'undefined') return resolve(true);
            existingScript.onload = () => resolve(true);
            existingScript.onerror = () => resolve(false);
            setTimeout(() => resolve(typeof Chart !== 'undefined'), 4000);
        });
    }

    const cdnCandidates = ['/lib/chart.min.js', 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js', 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js'];
    for (const url of cdnCandidates) {
        const loaded = await new Promise((resolve) => {
            const script = document.createElement('script'); script.src = url;
            script.onload = () => resolve(true); script.onerror = () => resolve(false);
            const timeout = setTimeout(() => resolve(typeof Chart !== 'undefined'), 5000);
            script.onload = () => { clearTimeout(timeout); resolve(true); };
            script.onerror = () => { clearTimeout(timeout); resolve(false); };
            document.head.appendChild(script);
        });
        if (loaded && typeof Chart !== 'undefined') return true;
    }
    return false;
}

function renderFallbackLineChart(canvas, labels, values) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.clientWidth || 320;
    const height = canvas.height = canvas.clientHeight || 200;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0f172a'; ctx.font = '12px sans-serif'; ctx.fillText('Repayment Trend', 10, 16);
}

function renderFallbackDoughnut(canvas, paid, balance) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.clientWidth || 200;
    const height = canvas.height = canvas.clientHeight || 200;
    ctx.clearRect(0, 0, width, height);
}

async function tryInitCharts() {
    const repaymentCanvas = document.getElementById('repaymentChart');
    const breakdownCanvas = document.getElementById('loanBreakdownChart');
    if (!repaymentCanvas || !breakdownCanvas) { setTimeout(tryInitCharts, 300); return; }
    
    const chartJsLoaded = await ensureChartJs();
    if (!chartJsLoaded) {
        renderFallbackLineChart(repaymentCanvas, dashboardData.repaymentSeries?.labels || ['Jan','Feb','Mar','Apr'], dashboardData.repaymentSeries?.data || [0,0,0,0]);
        renderFallbackDoughnut(breakdownCanvas, dashboardData.totalRepaid || 0, dashboardData.currentBalance || 0);
        return;
    }
    initializeCharts();
}
tryInitCharts();

// ==========================================
// 7. SUPABASE ENGINE
// ==========================================
async function loadDashboardData() {
    try {
        const { supabase } = await import('/Services/supabaseClient.js');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        await hydrateCreditScore(supabase, session.user.id);
        
        // Fetch payments for "Last paid" fallback
        const { data: payments } = await supabase.from('payments').select('loan_id, amount, payment_date').eq('user_id', session.user.id).order('payment_date', { ascending: false });
        
        let latestPaymentDate = null;
        if (payments && payments.length > 0) {
            latestPaymentDate = payments[0].payment_date;
        }

        const paymentsByLoan = (payments || []).reduce((acc, payment) => {
            acc[payment.loan_id] = (acc[payment.loan_id] || 0) + (Number(payment.amount) || 0); return acc;
        }, {});
        const totalRepaidAllLoans = (payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        const { data: loans } = await supabase.from('loans').select('*').eq('user_id', session.user.id).eq('status', 'active').order('created_at', { ascending: false });
        
        if (loans && loans.length > 0) {
            const enrichedLoans = loans.map((loan) => {
                const principal = Number(loan.principal_amount) || 0;
                const termMonths = Number(loan.term_months) || 1;
                const rawRate = Number(loan.interest_rate) || 0;
                const normalizedRate = rawRate > 1 ? rawRate / 100 : rawRate;
                const monthlyPayment = Number(loan.monthly_payment) || calculateMonthlyPayment(principal, normalizedRate, termMonths);
                
                // Deep Date Check
                let dueDateObj = null;
                const candidateDateStr = loan.next_payment_date || loan.first_payment_date || loan.repayment_start_date;
                
                if (candidateDateStr) {
                    dueDateObj = new Date(candidateDateStr);
                } else if (loan.start_date) {
                    dueDateObj = new Date(loan.start_date);
                    dueDateObj.setDate(dueDateObj.getDate() + 30); // Assume 30 days from start if totally blank
                }

                if (dueDateObj && !Number.isNaN(dueDateObj.getTime())) { 
                    dueDateObj.setUTCHours(0, 0, 0, 0); 
                } else {
                    dueDateObj = null;
                }

                const totalRepayment = Number(loan.total_repayment) || (monthlyPayment * termMonths) || principal;
                const paidToDate = paymentsByLoan[loan.id] || 0;
                const outstandingBalance = Math.max(totalRepayment - paidToDate, 0);
                const nextDueAmount = monthlyPayment > 0 ? Math.min(monthlyPayment, outstandingBalance) : outstandingBalance;
                
                return { 
                    ...loan, principal, termMonths, normalizedRate, monthlyPayment, 
                    nextDueAmount, dueDateObj, outstandingBalance, totalRepayment, paidToDate 
                };
            });

            const loanTotals = enrichedLoans.reduce((acc, loan) => {
                acc.borrowed += loan.principal; acc.outstanding += loan.outstandingBalance; acc.repaid += loan.paidToDate || 0; return acc;
            }, { borrowed: 0, outstanding: 0, repaid: 0 });

            dashboardData.totalBorrowed = loanTotals.borrowed;
            dashboardData.currentBalance = loanTotals.outstanding;
            dashboardData.totalRepaid = loanTotals.repaid || totalRepaidAllLoans;

            // Find the most immediate upcoming payment that has an outstanding balance
            const upcomingPayment = enrichedLoans.reduce((best, loan) => {
                if (!loan.dueDateObj) return best;
                if (loan.outstandingBalance <= 0) return best; 
                if (!best) return loan;
                if (loan.dueDateObj < best.dueDateObj) return loan;
                return best;
            }, null);

            if (upcomingPayment && upcomingPayment.dueDateObj) {
                dashboardData.nextPayment = { 
                    amount: upcomingPayment.nextDueAmount, 
                    date: upcomingPayment.dueDateObj.toISOString(),
                    hasUpcoming: true 
                };
            } else {
                dashboardData.nextPayment = { 
                    amount: 0, 
                    date: latestPaymentDate, 
                    hasUpcoming: false 
                };
            }

            dashboardData.loans = enrichedLoans.map(loan => {
                const readableStatus = loan.status ? `${loan.status.charAt(0).toUpperCase()}${loan.status.slice(1).toLowerCase()}` : 'Active';
                const now = new Date();
                now.setUTCHours(0,0,0,0);
                const daysUntilDue = loan.dueDateObj
                    ? Math.round((loan.dueDateObj - now) / (1000*60*60*24))
                    : null;

                return {
                    id: `LOAN-${loan.id}`,
                    rawId: loan.id,
                    amount: formatCurrency(loan.totalRepayment || loan.principal),
                    remaining: formatCurrency(loan.outstandingBalance),
                    nextPayment: formatCurrency(loan.nextDueAmount),
                    dueDate: loan.dueDateObj ? loan.dueDateObj.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }) : 'TBD',
                    interestRate: `${(loan.normalizedRate * 100).toFixed(2)}%`,
                    status: readableStatus,
                    rawTotal: loan.totalRepayment || loan.principal,
                    rawRemaining: loan.outstandingBalance,
                    rawDaysUntilDue: daysUntilDue,
                    rawMonthlyPayment: loan.nextDueAmount,
                    rawStatus: loan.status
                };
            });
        } else {
            dashboardData.nextPayment = { amount: 0, date: latestPaymentDate, hasUpcoming: false };
            dashboardData.totalBorrowed = 0; 
            dashboardData.currentBalance = 0; 
            dashboardData.totalRepaid = totalRepaidAllLoans;
        }

        // Sync Desktop DOM IDs manually
        document.getElementById('totalBorrowed').textContent = formatCurrency(dashboardData.totalBorrowed);
        document.getElementById('currentBalance').textContent = formatCurrency(dashboardData.currentBalance);
        document.getElementById('totalRepaid').textContent = formatCurrency(dashboardData.totalRepaid);
        
        const nxtAmt = document.getElementById('nextPaymentAmount');
        const nxtDt = document.getElementById('nextPaymentDate');
        if (nxtAmt) nxtAmt.textContent = formatCurrency(dashboardData.nextPayment.amount);
        if (nxtDt) {
            if (dashboardData.nextPayment.hasUpcoming && dashboardData.nextPayment.date) {
                const dueDate  = new Date(dashboardData.nextPayment.date);
                const now      = new Date(); now.setHours(0,0,0,0);
                const daysLeft = Math.round((dueDate - now) / 86400000);
                let label = `Due ${formatDueDate(dashboardData.nextPayment.date)}`;
                let color = '';
                if (daysLeft < 0)      { label = `${Math.abs(daysLeft)} days overdue`; color = '#ef4444'; }
                else if (daysLeft === 0){ label = 'Due today!';                          color = '#f59e0b'; }
                else if (daysLeft === 1){ label = 'Due tomorrow';                        color = '#f59e0b'; }
                else if (daysLeft <= 5) { label = `Due in ${daysLeft} days`;             color = '#f59e0b'; }
                nxtDt.textContent = label;
                if (color) nxtDt.style.color = color;
            } else if (!dashboardData.nextPayment.hasUpcoming && dashboardData.nextPayment.date) {
                nxtDt.textContent = `Last paid ${formatDueDate(dashboardData.nextPayment.date)}`;
            } else {
                nxtDt.textContent = 'No upcoming payment';
            }
        }

        const { data: applications } = await supabase.from('loan_applications').select('*').eq('user_id', session.user.id).neq('status', 'OFFERED').neq('status', 'DISBURSED').order('created_at', { ascending: false }).limit(5);
        if (applications && applications.length > 0) {
            dashboardData.applications = applications.map(app => ({
                id: `APP-${app.id}`, rawId: app.id, type: app.purpose || 'Personal Loan',
                amount: `R ${parseFloat(app.amount).toLocaleString('en-ZA', {minimumFractionDigits: 2})}`,
                date: new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                createdAt: app.created_at, status: app.status
            }));
            populateApplications();
        }
        
        populateDashboardMetrics(); // Rebuilds mobile carousel with live real data
        populateActiveLoans();      // Rebuilds both grids

    } catch (error) { console.error('Error loading dashboard data:', error); }
}

async function hydrateCreditScore(supabase, userId) {
    try {
        const { data } = await supabase.from('credit_checks').select('*').eq('user_id', userId).order('checked_at', { ascending: false }).limit(1).maybeSingle();
        applyCreditScoreToDashboard(data);
    } catch (err) { applyCreditScoreToDashboard(null); }
}

// ==========================================
// 8. UNIVERSAL PRODUCTION MODALS
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

window.openLoansModule = function() {
    const active = dashboardData.loans.filter(l => l.status === 'Active' || l.status === 'Offered');
    const totalRepayment = active.reduce((sum, l) => sum + l.rawTotal, 0);
    const totalRemaining = active.reduce((sum, l) => sum + l.rawRemaining, 0);

    // Full Screen specific styling wrappers
    const statsHtml = `
        <div class="full-screen-content-wrapper">
            <div class="modal-stat-row" style="margin-top: 10px;">
                <div class="modal-stat-box" style="margin-bottom:20px;">
                    <div class="modal-stat-label">Active Balance</div>
                    <div class="modal-stat-val">${formatCurrency(totalRemaining)}</div>
                </div>
            </div>`;

    const listHtml = active.length === 0 ? '<div style="text-align:center; padding:40px; color:var(--text-muted);">No active loans found.</div></div>' : active.map(loan => `
            <div class="modern-list-item">
                <div class="modern-item-header">
                    <span class="modern-item-id">${loan.id}</span>
                    <span class="status-badge" style="background:rgba(231,118,46,0.1); color:var(--color-primary); padding:6px 12px; border-radius:100px; font-size:11px; font-weight:700;">${loan.status}</span>
                </div>
                <div class="modern-item-grid">
                    <div class="modern-grid-col"><div class="label">Amount</div><div class="val">${loan.amount}</div></div>
                    <div class="modern-grid-col"><div class="label">Remaining</div><div class="val">${loan.remaining}</div></div>
                    <div class="modern-grid-col"><div class="label">Next Due</div><div class="val">${loan.nextPayment}</div></div>
                    <div class="modern-grid-col"><div class="label">Due Date</div><div class="val">${loan.dueDate}</div></div>
                </div>
            </div>`).join('') + '</div>';

    // TRUE forces CSS into Full Screen mode
    openUniversalModal('Active Loans', statsHtml + listHtml, true);
};

window.openApplicationsModule = function() {
    const apps = dashboardData.applications;
    const statsHtml = `<div class="modal-stat-row" style="margin-top: 10px;"><div class="modal-stat-box" style="margin-bottom:20px;"><div class="modal-stat-label">Total Requests</div><div class="modal-stat-val">${apps.length}</div></div></div>`;
    const listHtml = apps.length === 0 ? '<div style="text-align:center; padding:40px; color:var(--text-muted);">No active requests.</div>' : apps.map(app => `
        <div class="modern-list-item">
            <div class="modern-item-header">
                <span class="modern-item-id">${app.id}</span>
                <span class="status-badge" style="background:#f4f4f5; color:#666; padding:4px 10px; border-radius:100px; font-size:11px; font-weight:700;">${app.status}</span>
            </div>
            <div class="modern-item-grid">
                <div class="modern-grid-col"><div class="label">Purpose</div><div class="val">${app.type}</div></div>
                <div class="modern-grid-col"><div class="label">Amount</div><div class="val">${app.amount}</div></div>
                <div class="modern-grid-col"><div class="label">Date</div><div class="val">${app.date}</div></div>
            </div>
        </div>`).join('');

    openUniversalModal('Recent Applications', statsHtml + listHtml, false);
};

window.openTransactionsModule = function() {
    openUniversalModal('Transactions', '<div style="text-align:center; padding:40px; color:var(--text-muted); font-weight:500;">No transactions to display yet.</div>', false);
};

// Mobile Full Screen Modals (Bottom Sheet) Overrides
window.openFullScreenModal = function(type) {
    const modal = document.getElementById('fullScreenModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    if(!modal) return;
    
    modal.classList.remove('hidden');
    if (type === 'transactions') {
        title.innerText = 'History';
        body.innerHTML = '<div style="text-align:center; padding: 40px; color:var(--text-muted); font-weight:500;">No transactions found.</div>';
    } else if (type === 'applications') {
        title.innerText = 'Requests';
        body.innerHTML = dashboardData.applications.length === 0 
            ? '<div style="text-align:center; padding: 40px; color:var(--text-muted); font-weight:500;">No requests found.</div>'
            : dashboardData.applications.map(app => `
                <div class="modern-list-item" style="padding: 20px; margin-bottom: 12px; border: none;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                        <span style="font-weight:700; font-size:16px; color:var(--text-main);">${app.type}</span>
                        <span style="font-weight:700; font-size:16px; color:var(--text-main);">${app.amount}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--text-muted); font-weight:600;">
                        <span>${app.date}</span>
                        <span style="color:var(--color-primary); background: rgba(231,118,46,0.1); padding: 4px 10px; border-radius: 10px;">${app.status}</span>
                    </div>
                </div>`).join('');
    }
};

window.closeFullScreenModal = function() { document.getElementById('fullScreenModal').classList.add('hidden'); };

// ==========================================
// 9. ACTIONS & ROUTING
// ==========================================
window.createNewApplication = () => {
    if (typeof loadPage === 'function') {
        loadPage('apply-loan');
    } else {
        window.location.href = '/user-portal/pages/apply-loan.html';
    }
};

window.downloadLoanStatement = async function(loanId) {
    try {
        const { supabase } = await import('/Services/supabaseClient.js');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Open the NCA pre-agreement quote as the statement
        // For active loans we fetch from loan_applications
        const { data: apps } = await supabase
            .from('loan_applications')
            .select('id')
            .eq('user_id', session.user.id)
            .in('status', ['DISBURSED','ACTIVE','IN_ARREARS','IN_DEFAULT','OFFER_ACCEPTED'])
            .order('created_at', { ascending: false })
            .limit(1);

        const appId = apps?.[0]?.id;
        if (appId) {
            window.open(`/api/contracts/${appId}/preview`, '_blank');
        } else {
            if (typeof window.showToast === 'function') {
                window.showToast('Statement', 'No loan agreement found. Contact support.', 'info');
            } else {
                alert('Statement not available — contact support.');
            }
        }
    } catch (e) {
        console.error('[statement]', e);
    }
};

window.makePayment = async () => {
    // Fetch active loan details for banking reference
    const { supabase } = await import('/Services/supabaseClient.js');
    const { data: { session } } = await supabase.auth.getSession();
    const companyName = window.__systemTheme?.company_name || 'Zwane Financial Services';
    const companyBank = window.__systemTheme?.company_bank_name || 'Standard Bank';
    const companyAcc  = window.__systemTheme?.company_bank_account || '';
    const companyBranch = window.__systemTheme?.company_branch_code || '';
    const companyRef  = session ? session.user.email : 'Your reference number';

    const html = `
        <div style="padding: 8px 0;">
          <div style="background: linear-gradient(135deg, var(--color-primary), #f08840); border-radius: 16px; padding: 20px; color: white; margin-bottom: 20px; text-align: center;">
            <div style="font-size: 13px; font-weight: 600; opacity: 0.85; margin-bottom: 4px; text-transform: uppercase; letter-spacing: .05em;">Make a Manual Payment</div>
            <div style="font-size: 28px; font-weight: 800; letter-spacing: -1px;">${companyName}</div>
          </div>

          <div style="background: #f8f8f8; border-radius: 14px; padding: 16px; margin-bottom: 16px;">
            <div style="font-size: 11px; font-weight: 700; color: #8E8E93; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 12px;">Banking Details</div>
            ${[
              ['Bank', companyBank],
              ['Account Number', companyAcc || 'Contact branch for details'],
              ['Branch Code', companyBranch || '—'],
              ['Account Type', 'Cheque / Current'],
              ['Reference', companyRef],
            ].map(([l,v]) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #eee;">
                <span style="font-size:13px;color:#8E8E93;font-weight:600;">${l}</span>
                <span style="font-size:13px;font-weight:700;color:#0F172A;">${v}</span>
              </div>`).join('')}
          </div>

          <div style="background: #fff8ed; border: 1px solid #f59e0b33; border-radius: 14px; padding: 14px; margin-bottom: 16px; font-size: 13px; color: #92400e; font-weight: 600;">
            <i class="fas fa-circle-info" style="margin-right: 8px;"></i>
            Use your <strong>email address or loan reference number</strong> as the payment reference so your payment is correctly allocated.
          </div>

          <div style="display:flex;gap:10px;">
            <button onclick="closeUniversalModal()" class="action-btn" style="flex:1;height:44px;">
              Close
            </button>
            <button onclick="window.open('tel:${window.__systemTheme?.company_phone || ''}')" class="action-btn primary" style="flex:1;height:44px;">
              <i class="fas fa-phone" style="margin-right:6px;"></i> Call Us
            </button>
          </div>
        </div>`;

    if (typeof openUniversalModal === 'function') {
        openUniversalModal('Make a Payment', html, false);
    } else {
        alert(`Please EFT to ${companyName}. Use your email as reference.`);
    }
};

window.editApplication = async function(applicationId) {
    try {
        const { supabase } = await import('/Services/supabaseClient.js');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { alert('Please sign in to edit applications'); return; }
        
        const { data: app, error: fetchError } = await supabase.from('loan_applications').select('*').eq('id', applicationId).eq('user_id', session.user.id).single();
            
        if (fetchError || !app) { alert('Application not found'); return; }
        if (app.status === 'AFFORD_OK') { alert('This application cannot be edited. Affordability check has been completed.'); return; }
        if (app.status === 'READY_TO_DISBURSE') { alert('This application cannot be edited. Application is approved and awaiting disbursement.'); return; }
        
        const hoursSinceCreation = (new Date() - new Date(app.created_at)) / (1000 * 60 * 60);
        if (hoursSinceCreation >= 2) { alert('This application can no longer be edited. Edit window expired after 2 hours.'); return; }
        
        const moduleContainer = document.getElementById('edit-module-container');
        const moduleContent = document.getElementById('edit-module-content');
        const response = await fetch('/user-portal/modules/edit-application.html');
        moduleContent.innerHTML = await response.text();
        moduleContainer.classList.remove('hidden');
        window.currentEditApplicationId = app.id;
        
        setTimeout(() => {
            document.getElementById('editAmount').value = app.amount || '';
            document.getElementById('editPurpose').value = app.purpose || '';
            document.getElementById('editPeriod').value = app.term_months || '';
            document.getElementById('editNotes').value = app.notes || '';
        }, 100);
    } catch (error) {
        console.error('Error editing application:', error);
        alert('Failed to load edit form');
    }
};

window.closeEditModal = function() {
    document.getElementById('edit-module-container').classList.add('hidden');
    window.currentEditApplicationId = null;
};

window.saveApplicationEdit = async function() {
    const saveBtn = document.getElementById('saveEditBtn');
    const statusMsg = document.getElementById('editStatusMessage');
    try {
        saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        const amount = parseFloat(document.getElementById('editAmount').value);
        const purpose = document.getElementById('editPurpose').value;
        const period = parseInt(document.getElementById('editPeriod').value);
        const notes = document.getElementById('editNotes').value;
        
        if (!amount || amount < 100 || amount > 10000) throw new Error('Please enter a valid amount between R100 and R10,000');
        if (!purpose) throw new Error('Please select a loan purpose');
        if (!period || period < 1 || period > 24) throw new Error('Please enter a valid period between 1 and 24 months');
        
        const { supabase } = await import('/Services/supabaseClient.js');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Session expired. Please sign in again');
        
        const { error: updateError } = await supabase.from('loan_applications').update({ amount, purpose, term_months: period, notes, updated_at: new Date().toISOString() }).eq('id', window.currentEditApplicationId).eq('user_id', session.user.id);
        if (updateError) throw updateError;
        
        statusMsg.textContent = 'Application updated successfully!'; statusMsg.className = 'status-message success show';
        setTimeout(() => { closeEditModal(); loadDashboardData(); }, 1500);
    } catch (error) {
        statusMsg.textContent = error.message || 'Failed to update application'; statusMsg.className = 'status-message error show';
        saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
    }
};

window.deleteApplication = async function(applicationId) {
    try {
        const { supabase } = await import('/Services/supabaseClient.js');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { alert('Please sign in to delete applications'); return; }
        
        const { data: app, error: fetchError } = await supabase.from('loan_applications').select('created_at, status').eq('id', applicationId).eq('user_id', session.user.id).single();
        if (fetchError || !app) { alert('Application not found'); return; }
        if (app.status === 'READY_TO_DISBURSE') { alert('This application cannot be deleted. Application is approved and awaiting disbursement.'); return; }
        
        const hoursSinceCreation = (new Date() - new Date(app.created_at)) / (1000 * 60 * 60);
        if (hoursSinceCreation >= 2) { alert('This application can no longer be deleted. Delete window expired after 2 hours.'); return; }
        if (!confirm(`Are you sure you want to delete application #${applicationId}? This action cannot be undone.`)) return;
        
        const { error: deleteError } = await supabase.from('loan_applications').delete().eq('id', applicationId).eq('user_id', session.user.id);
        if (deleteError) { alert('Failed to delete application'); return; }
        
        alert('Application deleted successfully');
        loadDashboardData();
    } catch (error) {
        alert('Failed to delete application');
    }
};

// ==========================================
// 10. INITIALIZATION ON LOAD
// ==========================================
const dateOpts = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
const todayDateString = new Date().toLocaleDateString('en-US', dateOpts);
if(document.getElementById('currentDate')) document.getElementById('currentDate').textContent = todayDateString;
if(document.getElementById('currentDateMobile')) document.getElementById('currentDateMobile').textContent = todayDateString;

// Time-based greeting
(function initGreeting() {
    const hour = new Date().getHours();
    let salutation;
    if (hour >= 5  && hour < 12) salutation = 'Good morning';
    else if (hour >= 12 && hour < 17) salutation = 'Good afternoon';
    else if (hour >= 17 && hour < 21) salutation = 'Good evening';
    else                               salutation = 'Good evening';

    const profile = window.globalUserProfile;
    const firstName = profile?.full_name
        ? profile.full_name.trim().split(/\s+/)[0]
        : '';

    const text = firstName ? `${salutation}, ${firstName} 👋` : `${salutation} 👋`;

    const elDesktop = document.getElementById('greetingDesktop');
    const elMobile  = document.getElementById('greetingMobile');
    if (elDesktop) elDesktop.textContent = text;
    if (elMobile)  elMobile.textContent  = text;
})();

populateActiveLoans();
populateTransactions();
populateApplications();
loadDashboardData();
loadEligibilityWidget();

// ── Eligibility Widget ─────────────────────────────────────────
async function loadEligibilityWidget() {
    try {
        const { supabase } = await import('/Services/supabaseClient.js');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const res = await fetch('/api/my-eligibility', {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (!res.ok) return;
        const data = await res.json();

        const card = document.getElementById('eligibilityCard');
        if (!card) return;

        if (!data.eligible) return; // hide card if no credit check yet

        card.style.display = '';

        const bandLabel  = document.getElementById('eligibilityBandLabel');
        const bandDot    = document.getElementById('eligibilityBandDot');
        const badgeIcon  = document.getElementById('eligibilityBadgeIcon');
        const details    = document.getElementById('eligibilityDetails');
        const firstLoan  = document.getElementById('eligibilityFirstLoan');

        if (bandLabel) bandLabel.textContent = data.band?.label || '—';
        if (bandDot && data.band?.color) bandDot.style.background = data.band.color;
        if (badgeIcon && data.band?.color) {
            badgeIcon.style.setProperty('--badge-color', data.band.color);
            badgeIcon.style.setProperty('--badge-bg', data.band.color + '1a');
        }

        if (details) {
            details.innerHTML = [
                { label: 'Max Loan',  value: `R ${Number(data.band?.max_loan_amount || 0).toLocaleString()}` },
                { label: 'Rate p.a.', value: `${data.band?.interest_rate_pa || 0}%` },
                { label: 'Max Term',  value: `${data.band?.max_term_months || 0} mo` },
                { label: 'Score',     value: data.credit_score || '—' }
            ].map(i => `
                <div style="background:#f8f8f8;border-radius:8px;padding:8px 10px;">
                    <div style="font-size:10px;color:#8E8E93;text-transform:uppercase;letter-spacing:.05em;">${i.label}</div>
                    <div style="font-size:14px;font-weight:700;color:#0F172A;">${i.value}</div>
                </div>`).join('');
        }

        if (firstLoan && data.first_loan_restriction) {
            firstLoan.style.display = '';
            firstLoan.innerHTML = `<i class="fas fa-star"></i> ${data.first_loan_restriction}`;
        }
    } catch (e) {
        console.warn('[eligibility-widget]', e.message);
    }
}