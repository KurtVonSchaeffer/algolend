// Transcripts page JS - Minimalist Score Card & Modals (Reason Only)
import '/user-portal/Services/sessionGuard.js'; 

let supabaseClient = null;
let activeUserId = null;
let isTranscriptsLoading = false;
let currentUploadDocType = null;

// Global State Caches for Modals
let cachedCreditChecks = [];
let cachedDocMap = {};

// Risk → hex colours (no CSS vars — SVG stroke needs real hex)
const SCORE_RISK_COLORS = {
    'very low risk': '#10B981',
    'low risk':      '#22C55E',
    'medium risk':   '#E7762E',
    'high risk':     '#F97316',
    'very high risk':'#EF4444'
};

// Glow rgba versions for CSS filter drop-shadow
const SCORE_RISK_GLOWS = {
    'very low risk': 'rgba(16, 185, 129, 0.55)',
    'low risk':      'rgba(34, 197, 94,  0.55)',
    'medium risk':   'rgba(231, 118, 46, 0.55)',
    'high risk':     'rgba(249, 115, 22, 0.55)',
    'very high risk':'rgba(239, 68,  68, 0.55)'
};

const METRICS_CONFIG = [
    { key: 'total_accounts', label: 'Total Accounts' },
    { key: 'open_accounts', label: 'Open Accounts' },
    { key: 'closed_accounts', label: 'Closed Accounts' },
    { key: 'accounts_with_arrears', label: 'Accounts In Arrears' },
    { key: 'total_balance', label: 'Total Balance', formatter: formatCurrency },
    { key: 'total_monthly_payment', label: 'Monthly Instalments', formatter: formatCurrency },
    { key: 'total_arrears_amount', label: 'Total Arrears', formatter: formatCurrency },
    { key: 'total_enquiries', label: 'Enquiries (All Time)' },
    { key: 'total_judgments', label: 'Judgements' },
    { key: 'total_judgment_amount', label: 'Judgement Value', formatter: formatCurrency }
];

async function initTranscriptsPage(isManualRefresh = false) {
    if (isTranscriptsLoading) return;

    isTranscriptsLoading = true;
    toggleRefreshButton(true);
    setTranscriptsAlert('info', isManualRefresh ? 'Refreshing credit data...' : 'Loading your credit data...', true);

    try {
        if (!supabaseClient) {
            ({ supabase: supabaseClient } = await import('/Services/supabaseClient.js'));
        }

        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error) throw error;

        activeUserId = session?.user?.id || null;
        if (!activeUserId) {
            setTranscriptsAlert('error', 'Please sign in to view your credit transcripts.', true);
            return;
        }

        cachedCreditChecks = await fetchCreditChecks();
        renderCreditSummary(cachedCreditChecks);
        await loadDocumentDownloads();

        setTranscriptsAlert('success', isManualRefresh ? 'Credit data refreshed just now.' : 'Credit data loaded.', false);
    } catch (err) {
        console.error('Failed to load transcripts:', err);
        setTranscriptsAlert('error', err.message || 'Unable to load transcripts.', true);
    } finally {
        isTranscriptsLoading = false;
        toggleRefreshButton(false);
    }
}

function toggleRefreshButton(isDisabled) {
    const btn = document.getElementById('refreshTranscriptsBtn');
    const icon = btn?.querySelector('i');
    if (btn && icon) {
        btn.disabled = isDisabled;
        if (isDisabled) {
            icon.classList.remove('fa-rotate');
            icon.classList.add('fa-circle-notch', 'fa-spin');
        } else {
            icon.classList.add('fa-rotate');
            icon.classList.remove('fa-circle-notch', 'fa-spin');
        }
    }
}

function setTranscriptsAlert(type, message, show = true) {
    const alertEl = document.getElementById('transcriptsAlert');
    const msgSpan = document.getElementById('alertMessage');
    const icon = alertEl?.querySelector('i');
    
    if (!alertEl || !msgSpan || !icon) return;
    
    alertEl.style.display = show ? 'flex' : 'none';
    alertEl.className = `transcripts-alert ${type}`;
    msgSpan.textContent = message;

    icon.className = 'fas'; 
    if (type === 'success') icon.classList.add('fa-check-circle');
    else if (type === 'error') icon.classList.add('fa-exclamation-triangle');
    else icon.classList.add('fa-circle-notch', 'fa-spin');
    
    if (type === 'success' && show) {
        setTimeout(() => { alertEl.style.display = 'none'; }, 3000);
    }
}

async function fetchCreditChecks() {
    const { data, error } = await supabaseClient
        .from('credit_checks')
        .select('*')
        .eq('user_id', activeUserId)
        .order('checked_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

// ── Gauge animation helpers ───────────────────────────────────────

/** Draw SVG tick-mark lines around the gauge arc (135° → 405°, 30 intervals) */
function drawGaugeTicks() {
    const ticksEl = document.getElementById('gaugeTicks');
    if (!ticksEl) return;

    const cx = 100, cy = 100;
    const COUNT = 30; // 30 gaps = 31 ticks over 270°

    let markup = '';
    for (let i = 0; i <= COUNT; i++) {
        const angleDeg  = 135 + i * (270 / COUNT);
        const angleRad  = angleDeg * Math.PI / 180;
        const isMajor   = i % 5 === 0;
        const rOuter    = isMajor ? 95 : 93;
        const rInner    = isMajor ? 88 : 90;
        const opacity   = isMajor ? 0.18 : 0.09;
        const sw        = isMajor ? 1.8 : 1;

        const x1 = (cx + rOuter * Math.cos(angleRad)).toFixed(2);
        const y1 = (cy + rOuter * Math.sin(angleRad)).toFixed(2);
        const x2 = (cx + rInner * Math.cos(angleRad)).toFixed(2);
        const y2 = (cy + rInner * Math.sin(angleRad)).toFixed(2);

        markup += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" `
                + `stroke="rgba(15,23,42,${opacity})" stroke-width="${sw}" stroke-linecap="round"/>`;
    }
    ticksEl.innerHTML = markup;
}

/**
 * Animate the SVG arc fill and glow to the target percentage of the gauge.
 * @param {number} score   Numeric credit score (300–999)
 * @param {string} color   Hex colour for the fill
 * @param {string} glow    rgba() string for the drop-shadow glow
 */
function animateGauge(score, color, glow) {
    const MIN = 300, MAX = 999;
    const MAX_ARC = 377;        // circumference fraction for 270°
    const CIRC    = 502.65;     // 2π × 80

    const fraction   = Math.max(0, Math.min(1, (score - MIN) / (MAX - MIN)));
    const fillAmount = fraction * MAX_ARC;

    const arcEl  = document.getElementById('gaugeArc');
    const glowEl = document.getElementById('gaugeGlow');

    if (arcEl) {
        arcEl.style.stroke = color;
        arcEl.style.setProperty('--gauge-glow-color', glow);
        arcEl.classList.remove('pulse-complete', 'has-value');

        // Kick off in next tick so CSS transition picks up the change
        requestAnimationFrame(() => {
            arcEl.style.strokeDasharray = `${fillAmount} ${CIRC}`;
            arcEl.classList.add('has-value');

            // Completion pulse once arc finishes drawing (~1.9 s transition)
            setTimeout(() => {
                arcEl.classList.add('pulse-complete');
                setTimeout(() => arcEl.classList.remove('pulse-complete'), 800);
            }, 1950);
        });
    }

    if (glowEl) {
        glowEl.style.stroke = color;
        requestAnimationFrame(() => {
            glowEl.style.strokeDasharray = `${fillAmount} ${CIRC}`;
        });
    }
}

/**
 * Animate the score number counting up from 0 → target.
 * @param {number} target Numeric score value
 */
function animateCountUp(target) {
    const el = document.getElementById('creditScoreValue');
    if (!el || typeof target !== 'number') return;

    const DURATION = 1700;   // ms, slightly shorter than arc fill
    const start    = performance.now();

    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

    function tick(now) {
        const progress = Math.min((now - start) / DURATION, 1);
        el.textContent  = Math.round(easeOutCubic(progress) * target);
        if (progress < 1) requestAnimationFrame(tick);
        else el.textContent = target;
    }

    el.textContent = '0';
    requestAnimationFrame(tick);
}

// ── Main renderer ─────────────────────────────────────────────────

function renderCreditSummary(rows) {
    const latest   = rows?.[0] || null;
    const score    = latest?.credit_score;
    const riskText = latest?.risk_category || latest?.score_band || 'Pending';
    const riskKey  = riskText.toLowerCase();
    const color    = SCORE_RISK_COLORS[riskKey] || '#E7762E';
    const glow     = SCORE_RISK_GLOWS[riskKey]  || 'rgba(231,118,46,0.55)';

    // ── Risk badge ───────────────────────────────────────────────
    const riskEl = document.getElementById('creditRiskValue');
    if (riskEl) {
        riskEl.textContent        = riskText;
        riskEl.style.background   = color;
        riskEl.style.boxShadow    = `0 4px 16px ${glow}`;
        riskEl.style.color        = '#fff';
    }

    // ── Score number + gauge animation ──────────────────────────
    if (typeof score === 'number') {
        // Small delay so the card entrance animation runs first
        setTimeout(() => {
            animateCountUp(score);
            animateGauge(score, color, glow);
        }, 120);
    } else {
        setTextContent('creditScoreValue', '—');
    }

    // ── Footer reason ────────────────────────────────────────────
    const reason = latest?.recommendation_reason || 'Upload a credit report to see detailed insights.';
    setTextContent('creditReasonValue', reason);
    setTextContent('creditCheckedAt', latest?.checked_at
        ? `Updated: ${formatDate(latest.checked_at)}` : 'No record');

    renderMetricsGrid(latest);
    renderScoreBandRuler(score);
    renderEligibility(score, latest);
    renderImprovementTips(score, latest);
    renderScoreHistory(rows);
}

// ── Score band ruler — shows where the client sits ───────────────
function renderScoreBandRuler(score) {
    const container = document.getElementById('scoreBandRuler');
    if (!container) return;

    const bands = [
        { label: 'Very High Risk', min: 300, max: 499, color: '#EF4444' },
        { label: 'High Risk',      min: 500, max: 599, color: '#F97316' },
        { label: 'Medium Risk',    min: 600, max: 679, color: '#E7762E' },
        { label: 'Low Risk',       min: 680, max: 749, color: '#22C55E' },
        { label: 'Very Low Risk',  min: 750, max: 999, color: '#10B981' }
    ];

    const validScore = typeof score === 'number';
    const pct = validScore ? Math.max(0, Math.min(100, ((score - 300) / 699) * 100)) : 0;

    container.innerHTML = `
        <div style="background:rgba(255,255,255,0.6);backdrop-filter:blur(10px);border:1px solid rgba(15,23,42,0.06);border-radius:24px;padding:24px;margin-top:16px">
          <h4 style="font-size:13px;font-weight:800;color:#0F172A;margin:0 0 4px;letter-spacing:-0.01em">Where you stand</h4>
          <p style="font-size:11px;color:#64748B;margin:0 0 18px">Your score range on the credit scale</p>

          <div style="position:relative;height:14px;border-radius:99px;display:flex;overflow:hidden;background:#f3f4f6">
            ${bands.map(b => {
                const widthPct = ((b.max - b.min + 1) / 699) * 100;
                return `<div style="width:${widthPct}%;background:${b.color};height:100%"></div>`;
            }).join('')}
            ${validScore ? `
              <div style="position:absolute;top:-6px;left:${pct}%;transform:translateX(-50%);background:#0F172A;color:#fff;font-size:11px;font-weight:800;padding:3px 8px;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.2);white-space:nowrap">
                ${score} ▼
              </div>` : ''}
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:10px;font-weight:700;color:#94A3B8">
            <span>300</span><span>500</span><span>600</span><span>680</span><span>750</span><span>999</span>
          </div>
        </div>`;
}

// ── Loan eligibility based on score ──────────────────────────────
function renderEligibility(score, latest) {
    const container = document.getElementById('loanEligibility');
    if (!container) return;

    let max, rate, term, msg, icon, bg;
    if (typeof score !== 'number') {
        return container.innerHTML = '';
    } else if (score < 500) {
        max = 0;    rate = '—';  term = '—';  icon = 'block';
        msg = 'Loans currently unavailable. Focus on settling existing debt to rebuild your score.';
        bg = 'linear-gradient(135deg,#FEE2E2,#FECACA)';
    } else if (score < 600) {
        max = 2000; rate = '32%'; term = '1-3 months';  icon = 'warning';
        msg = 'Small short-term loans available. Demonstrate good repayment history to unlock larger amounts.';
        bg = 'linear-gradient(135deg,#FFEDD5,#FED7AA)';
    } else if (score < 680) {
        max = 8000; rate = '28%'; term = '1-6 months';  icon = 'thumb_up';
        msg = 'You qualify for our standard loan range. Good payment history will increase your limits.';
        bg = 'linear-gradient(135deg,#FFF7ED,#FFEDD5)';
    } else if (score < 750) {
        max = 15000;rate = '24%'; term = '1-12 months'; icon = 'verified';
        msg = 'Excellent standing! You qualify for our premium loans with competitive rates.';
        bg = 'linear-gradient(135deg,#D1FAE5,#A7F3D0)';
    } else {
        max = 25000;rate = '20%'; term = '1-24 months'; icon = 'star';
        msg = 'Top tier credit. You qualify for our highest loan amounts with our best rates.';
        bg = 'linear-gradient(135deg,#A7F3D0,#6EE7B7)';
    }

    container.innerHTML = `
      <div style="background:${bg};border-radius:24px;padding:24px;margin-top:16px;position:relative;overflow:hidden">
        <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:18px">
          <div style="background:rgba(255,255,255,0.7);width:42px;height:42px;border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <span class="material-symbols-outlined" style="font-size:24px;color:#0F172A">${icon}</span>
          </div>
          <div>
            <h4 style="font-size:14px;font-weight:800;color:#0F172A;margin:0;letter-spacing:-0.01em">Your loan eligibility</h4>
            <p style="font-size:12px;color:#334155;margin:4px 0 0;line-height:1.5">${msg}</p>
          </div>
        </div>

        ${max > 0 ? `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
          <div style="background:rgba(255,255,255,0.65);border-radius:14px;padding:12px;text-align:center">
            <div style="font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.05em">Max Loan</div>
            <div style="font-size:18px;font-weight:900;color:#0F172A;margin-top:4px;letter-spacing:-0.02em">R${(max/1000).toFixed(0)}k</div>
          </div>
          <div style="background:rgba(255,255,255,0.65);border-radius:14px;padding:12px;text-align:center">
            <div style="font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.05em">Rate p.a.</div>
            <div style="font-size:18px;font-weight:900;color:#0F172A;margin-top:4px;letter-spacing:-0.02em">${rate}</div>
          </div>
          <div style="background:rgba(255,255,255,0.65);border-radius:14px;padding:12px;text-align:center">
            <div style="font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.05em">Term</div>
            <div style="font-size:14px;font-weight:800;color:#0F172A;margin-top:6px;letter-spacing:-0.01em">${term}</div>
          </div>
        </div>
        <button onclick="window.lumaNavigate?.('apply-loan') || (location.href='/user-portal/?page=apply-loan')"
          style="width:100%;margin-top:14px;padding:12px;background:#0F172A;color:#fff;border:none;border-radius:14px;font-size:13px;font-weight:800;cursor:pointer;letter-spacing:-0.01em">
          Apply Now →
        </button>` : ''}
      </div>`;
}

// ── Tips to improve credit score ─────────────────────────────────
function renderImprovementTips(score, latest) {
    const container = document.getElementById('improvementTips');
    if (!container) return;

    const arrears = Number(latest?.accounts_with_arrears || 0);
    const judgments = Number(latest?.total_judgments || 0);
    const enquiries = Number(latest?.total_enquiries || 0);

    const tips = [];

    if (arrears > 0) {
        tips.push({ icon:'priority_high', title:'Settle accounts in arrears', desc:`You have ${arrears} account${arrears>1?'s':''} in arrears. Bringing these up to date is the single biggest boost to your score.`, urgent:true });
    }
    if (judgments > 0) {
        tips.push({ icon:'gavel', title:'Resolve judgements', desc:`${judgments} judgement${judgments>1?'s':''} on your record. Contact a debt counsellor to negotiate settlement and have these removed.`, urgent:true });
    }
    if (enquiries > 6) {
        tips.push({ icon:'visibility_off', title:'Limit credit applications', desc:`You have ${enquiries} bureau enquiries. Too many credit applications in a short period hurt your score. Avoid applying for new credit for 3-6 months.`, urgent:false });
    }
    if (typeof score === 'number' && score < 680) {
        tips.push({ icon:'event', title:'Pay every account on time', desc:'Set up debit orders to ensure no payments are missed. Even one late payment can drop your score by 50-100 points.', urgent:false });
        tips.push({ icon:'trending_down', title:'Keep balances low', desc:'Use less than 30% of any available credit limit. High utilisation signals risk to lenders.', urgent:false });
    }
    if (tips.length === 0 && typeof score === 'number') {
        tips.push({ icon:'check_circle', title:"You're doing great!", desc:'Continue paying all accounts on time and your score will keep growing. Avoid unnecessary credit applications.', urgent:false });
    }

    if (tips.length === 0) return container.innerHTML = '';

    container.innerHTML = `
      <div style="background:#fff;border:1px solid rgba(15,23,42,0.06);border-radius:24px;padding:24px;margin-top:16px">
        <h4 style="font-size:13px;font-weight:800;color:#0F172A;margin:0 0 4px;letter-spacing:-0.01em">How to improve your score</h4>
        <p style="font-size:11px;color:#64748B;margin:0 0 18px">Personalised actions based on your credit profile</p>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${tips.slice(0,4).map(t => `
            <div style="display:flex;gap:12px;padding:12px;background:${t.urgent ? '#FEF2F2' : '#F8FAFC'};border-radius:14px;border-left:3px solid ${t.urgent ? '#EF4444' : '#E7762E'}">
              <div style="background:#fff;width:36px;height:36px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <span class="material-symbols-outlined" style="font-size:20px;color:${t.urgent ? '#EF4444' : '#E7762E'}">${t.icon}</span>
              </div>
              <div style="flex:1;min-width:0">
                <h5 style="font-size:12px;font-weight:800;color:#0F172A;margin:0 0 2px;letter-spacing:-0.01em">${t.title}</h5>
                <p style="font-size:11px;color:#64748B;margin:0;line-height:1.5">${t.desc}</p>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
}

// ── Score history chart ──────────────────────────────────────────
function renderScoreHistory(rows) {
    const container = document.getElementById('scoreHistory');
    if (!container) return;

    const history = (rows || []).filter(r => typeof r.credit_score === 'number').slice(0, 6).reverse();
    if (history.length < 2) return container.innerHTML = '';

    const min = Math.min(...history.map(h => h.credit_score)) - 20;
    const max = Math.max(...history.map(h => h.credit_score)) + 20;
    const range = Math.max(1, max - min);

    const width = 100, height = 60, pad = 2;
    const pts = history.map((h, i) => {
        const x = pad + ((width - pad*2) / (history.length - 1)) * i;
        const y = pad + ((height - pad*2) * (1 - ((h.credit_score - min) / range)));
        return { x, y, score: h.credit_score, date: h.checked_at };
    });

    const pathD = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ');
    const areaD = pathD + ` L${pts[pts.length-1].x},${height} L${pts[0].x},${height} Z`;

    const first = history[0].credit_score;
    const last  = history[history.length - 1].credit_score;
    const delta = last - first;
    const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';
    const trendColor = trend === 'up' ? '#10B981' : trend === 'down' ? '#EF4444' : '#64748B';

    container.innerHTML = `
      <div style="background:#fff;border:1px solid rgba(15,23,42,0.06);border-radius:24px;padding:24px;margin-top:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
          <div>
            <h4 style="font-size:13px;font-weight:800;color:#0F172A;margin:0 0 4px;letter-spacing:-0.01em">Score trend</h4>
            <p style="font-size:11px;color:#64748B;margin:0">Your last ${history.length} credit checks</p>
          </div>
          <div style="text-align:right">
            <div style="font-size:20px;font-weight:900;color:${trendColor};letter-spacing:-0.02em">
              ${trend === 'up' ? '+' : ''}${delta}
            </div>
            <div style="font-size:10px;font-weight:700;color:#94A3B8;text-transform:uppercase">${trend === 'up' ? 'Improving' : trend === 'down' ? 'Declining' : 'Stable'}</div>
          </div>
        </div>

        <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:120px">
          <defs>
            <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${trendColor}" stop-opacity="0.3"/>
              <stop offset="100%" stop-color="${trendColor}" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <path d="${areaD}" fill="url(#scoreGrad)"/>
          <path d="${pathD}" fill="none" stroke="${trendColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          ${pts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="1.5" fill="#fff" stroke="${trendColor}" stroke-width="1.2"/>`).join('')}
        </svg>

        <div style="display:flex;justify-content:space-between;margin-top:8px">
          ${history.map(h => `<div style="font-size:9px;color:#94A3B8;font-weight:600">${formatDate(h.checked_at).split(' ').slice(0,2).join(' ')}</div>`).join('')}
        </div>
      </div>`;
}

function renderMetricsGrid(latest) {
    const grid = document.getElementById('creditMetricsGrid');
    if (!grid) return;

    if (!latest) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:20px; color:var(--text-muted);">No detailed metrics available yet.</div>';
        return;
    }

    grid.innerHTML = METRICS_CONFIG.map(({ key, label, formatter }) => {
        const rawValue = latest[key];
        const value = rawValue == null ? '—' : formatter ? formatter(rawValue) : formatNumber(rawValue);
        return `
            <div class="metric-tile">
                <h4>${label}</h4>
                <p>${value}</p>
            </div>
        `;
    }).join('');
}

async function loadDocumentDownloads() {
    const docTypes = ['till_slip', 'bank_statement'];
    const { data, error } = await supabaseClient
        .from('document_uploads')
        .select('id, file_name, file_type, file_path, uploaded_at')
        .eq('user_id', activeUserId)
        .in('file_type', docTypes)
        .order('uploaded_at', { ascending: false });

    if (!error) {
        cachedDocMap = {}; 
        (data || []).forEach((doc) => {
            if (!cachedDocMap[doc.file_type]) {
                cachedDocMap[doc.file_type] = doc;
            }
        });
    }
}

// ==========================================
// MODAL & UPLOAD LOGIC
// ==========================================
window.openUniversalModal = function(title, bodyHTML, isFullScreen = false) {
    const modal = document.getElementById('modern-universal-modal');
    const titleEl = document.getElementById('modern-modal-title');
    const bodyEl = document.getElementById('modern-modal-body');
    if (!modal) return;
    
    titleEl.innerText = title;
    bodyEl.innerHTML = bodyHTML;
    
    if (isFullScreen) modal.classList.add('is-full-screen');
    else modal.classList.remove('is-full-screen');
    
    modal.classList.remove('hidden');
};

window.closeUniversalModal = function() {
    document.getElementById('modern-universal-modal').classList.add('hidden');
};

window.openHistoryModal = function() {
    if (!cachedCreditChecks || cachedCreditChecks.length === 0) {
        openUniversalModal('Previous Checks', '<div class="empty-state">No previous bureau checks have been recorded.</div>', true);
        return;
    }

    // Modal updated to show Risk and Reason (taking up the full width below the score)
    const html = `<div class="full-screen-content-wrapper">` + cachedCreditChecks.map((row) => `
        <div class="modern-list-item">
            <div class="modern-item-header">
                <span class="modern-item-id">${row.bureau_name || 'Bureau Check'}</span>
                <span class="status-badge" style="background:rgba(231,118,46,0.1); color:var(--color-primary);">${formatDate(row.checked_at)}</span>
            </div>
            <div class="modern-item-grid">
                <div class="modern-grid-col"><div class="label">Score</div><div class="val">${row.credit_score ?? '—'}</div></div>
                <div class="modern-grid-col"><div class="label">Risk Level</div><div class="val">${row.risk_category || row.score_band || '—'}</div></div>
                <div class="modern-grid-col" style="grid-column: 1 / -1;">
                    <div class="label">Reason</div>
                    <div class="val" style="font-weight: 500; line-height: 1.5;">${row.recommendation_reason || 'No specific reason provided.'}</div>
                </div>
            </div>
        </div>
    `).join('') + `</div>`;

    openUniversalModal('Previous Checks', html, true);
};

window.openDocModal = function(type) {
    let html = '<div class="full-screen-content-wrapper" id="modalDocContainer">';
    let title = '';
    let dbType = '';

    if (type === 'payslip') {
        title = 'Payslip Document';
        dbType = 'till_slip';
    } else if (type === 'bank_statement') {
        title = 'Bank Statement';
        dbType = 'bank_statement';
    }

    // Render Upload Button FIRST
    html += `
        <button id="modalUploadBtn" class="action-btn" onclick="triggerFileUpload('${dbType}')" style="width: 100%; margin-bottom: 8px; border: 2px dashed #E5E5EA; background: var(--color-white); color: var(--text-main); height: 64px;">
            <i class="fas fa-cloud-upload-alt text-primary"></i> Upload New ${title}
        </button>
    `;

    // Then render the Document Card or Empty State below it
    const doc = cachedDocMap[dbType];
    if (!doc) {
        html += `<div class="empty-state"><i class="fas fa-file-upload" style="font-size:48px; color:#E5E5EA; margin-bottom:16px; display:block;"></i>No ${title.toLowerCase()} uploaded yet.</div>`;
    } else {
        html += buildDocCardHTML(doc.file_name, doc.uploaded_at, doc.file_path);
    }

    html += '</div>';
    openUniversalModal(title, html, true);
};

function buildDocCardHTML(name, date, url) {
    return `
        <div class="modern-list-item" style="margin-top: 8px;">
            <div class="modern-item-header" style="border-bottom:none; padding-bottom:0;">
                <div>
                    <div class="modern-item-id">${name}</div>
                    <div style="font-size:12px; color:var(--text-muted); margin-top:4px; font-weight:500;">Uploaded: ${formatDate(date)}</div>
                </div>
                <button class="action-btn primary" onclick="window.open('${url}', '_blank', 'noopener')" style="height: 40px; padding: 0 20px; font-size: 13px;">
                    <i class="fas fa-download"></i> Download
                </button>
            </div>
        </div>
    `;
}

// --- SECURE FILE UPLOAD LOGIC ---
window.triggerFileUpload = function(dbType) {
    currentUploadDocType = dbType;
    document.getElementById('hiddenDocUpload').click();
};

document.getElementById('hiddenDocUpload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const btn = document.getElementById('modalUploadBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin text-primary"></i> Uploading...';
    }

    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${activeUserId}/${currentUploadDocType}_${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('documents')
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabaseClient.storage
            .from('documents')
            .getPublicUrl(fileName);

        const { error: dbError } = await supabaseClient
            .from('document_uploads')
            .insert([{
                user_id: activeUserId,
                file_name: file.name,
                file_type: currentUploadDocType,
                file_path: publicUrl
            }]);

        if (dbError) throw dbError;

        await loadDocumentDownloads();
        
        const originalUiType = currentUploadDocType === 'till_slip' ? 'payslip' : 'bank_statement';
        openDocModal(originalUiType);
        
        setTranscriptsAlert('success', 'Document uploaded successfully!', true);

    } catch (error) {
        console.error('Upload failed:', error);
        alert('Failed to upload document. Please try again.');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-cloud-upload-alt text-primary"></i> Try Again';
        }
    } finally {
        e.target.value = ''; 
    }
});


// ==========================================
// UTILS
// ==========================================

function formatCurrency(value) {
    if (typeof value !== 'number') return '—';
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value) {
    if (value == null) return '—';
    return new Intl.NumberFormat('en-ZA').format(value);
}

function formatDate(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value));
}

function setTextContent(elementId, value) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = value;
}

function bootTranscriptsPage() {
    drawGaugeTicks(); // render tick marks into SVG before data loads

    const refreshBtn = document.getElementById('refreshTranscriptsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => initTranscriptsPage(true));
    }
    initTranscriptsPage();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootTranscriptsPage, { once: true });
} else {
    bootTranscriptsPage();
}

window.addEventListener('pageLoaded', (event) => {
    if (event?.detail?.pageName === 'transcripts') {
        bootTranscriptsPage();
    }
});