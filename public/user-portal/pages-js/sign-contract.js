import { supabase } from '/Services/supabaseClient.js';

let _applicationId = null;
let _canvas = null;
let _ctx = null;
let _drawing = false;
let _hasSigned = false;
let _hasScrolled = false;

async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = '/user-portal/?page=dashboard'; return; }

  // Find the application that needs signing
  const { data: apps } = await supabase
    .from('loan_applications')
    .select('id, status')
    .eq('user_id', session.user.id)
    .in('status', ['OFFERED', 'CONTRACT_SIGN'])
    .order('created_at', { ascending: false })
    .limit(1);

  const app = apps?.[0];
  if (!app) {
    // Nothing to sign — redirect to dashboard
    if (typeof loadPage === 'function') loadPage('dashboard');
    else window.location.href = '/user-portal/?page=dashboard';
    return;
  }

  _applicationId = app.id;
  loadContractFrame(app.id);
}

function loadContractFrame(appId) {
  const wrapper = document.getElementById('contract-frame-wrapper');
  const loading = document.getElementById('contract-loading');
  const notice  = document.getElementById('contract-scroll-notice');
  const iframe  = document.getElementById('contract-iframe');

  iframe.src = `/api/contracts/${appId}/preview`;
  iframe.onload = () => {
    loading.style.display = 'none';
    wrapper.style.display = 'block';
    notice.style.display  = 'flex';

    // Listen for scroll inside iframe — unlock button after scrolled 80%
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      const scrollEl  = iframeDoc?.scrollingElement || iframeDoc?.body;
      if (scrollEl) {
        iframe.contentWindow.addEventListener('scroll', () => {
          const pct = scrollEl.scrollTop / (scrollEl.scrollHeight - scrollEl.clientHeight);
          if (pct > 0.75 && !_hasScrolled) {
            _hasScrolled = true;
            unlockProceedButton();
          }
        });
      }
    } catch (_) { /* cross-origin fallback */ }

    // Fallback: unlock after 8 seconds regardless
    setTimeout(() => { if (!_hasScrolled) { _hasScrolled = true; unlockProceedButton(); } }, 8000);
  };
}

function unlockProceedButton() {
  const btn = document.getElementById('proceed-to-sign-btn');
  const notice = document.getElementById('contract-scroll-notice');
  if (!btn) return;
  btn.disabled = false;
  btn.style.background = 'var(--color-primary)';
  btn.style.color = '#fff';
  btn.style.cursor = 'pointer';
  if (notice) notice.style.display = 'none';
}

window.proceedToSign = function () {
  document.getElementById('contract-step-1').style.display = 'none';
  document.getElementById('contract-step-2').style.display = 'block';
  document.getElementById('step-2-indicator').style.background = 'var(--color-primary)';
  initCanvas();
};

window.backToContract = function () {
  document.getElementById('contract-step-2').style.display = 'none';
  document.getElementById('contract-step-1').style.display = 'block';
  document.getElementById('step-2-indicator').style.background = '#e5e7eb';
};

function initCanvas() {
  _canvas = document.getElementById('signature-canvas');
  if (!_canvas) return;

  // Match canvas pixel size to CSS size
  _canvas.width  = _canvas.offsetWidth;
  _ctx = _canvas.getContext('2d');
  _ctx.strokeStyle = '#1a1a2e';
  _ctx.lineWidth   = 2.5;
  _ctx.lineCap     = 'round';
  _ctx.lineJoin    = 'round';

  const pos = (e) => {
    const r = _canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - r.left) * (_canvas.width / r.width), y: (src.clientY - r.top) * (_canvas.height / r.height) };
  };

  const start = (e) => { e.preventDefault(); _drawing = true; const p = pos(e); _ctx.beginPath(); _ctx.moveTo(p.x, p.y); };
  const move  = (e) => { e.preventDefault(); if (!_drawing) return; const p = pos(e); _ctx.lineTo(p.x, p.y); _ctx.stroke(); hidePlaceholder(); _hasSigned = true; };
  const end   = () => { _drawing = false; };

  _canvas.addEventListener('mousedown',  start);
  _canvas.addEventListener('mousemove',  move);
  _canvas.addEventListener('mouseup',    end);
  _canvas.addEventListener('mouseleave', end);
  _canvas.addEventListener('touchstart', start, { passive: false });
  _canvas.addEventListener('touchmove',  move,  { passive: false });
  _canvas.addEventListener('touchend',   end);
}

function hidePlaceholder() {
  const el = document.getElementById('sig-placeholder');
  if (el) el.style.display = 'none';
}

window.clearSignature = function () {
  if (!_ctx || !_canvas) return;
  _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
  _hasSigned = false;
  const el = document.getElementById('sig-placeholder');
  if (el) el.style.display = 'flex';
};

window.submitSignature = async function () {
  if (!_hasSigned) {
    alert('Please draw your signature before submitting.');
    return;
  }

  const btn = document.getElementById('submit-signature-btn');
  btn.disabled  = true;
  btn.textContent = 'Submitting...';

  try {
    const signatureDataUrl = _canvas.toDataURL('image/png');
    const res = await fetch('/api/contracts/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId: _applicationId, signatureDataUrl })
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload?.error) throw new Error(payload?.error || 'Submission failed');

    // Show success
    document.getElementById('contract-step-2').style.display  = 'none';
    document.getElementById('contract-success').style.display = 'block';

  } catch (err) {
    console.error('Sign error:', err);
    alert('Something went wrong: ' + err.message + '. Please try again.');
    btn.disabled    = false;
    btn.textContent = 'Sign & Submit Agreement';
  }
};

init();
