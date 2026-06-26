// contract-sign.js — in-app loan agreement signing

let contractData = null;
let applicationId = null;
let signatureCanvas = null;
let sigCtx = null;
let isDrawing = false;
let hasSigned = false;
let hasScrolled = false;

function getAppId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('appId') || sessionStorage.getItem('contractSignAppId');
}

function show(id)  { const el = document.getElementById(id); if (el) el.style.display = ''; }
function hide(id)  { const el = document.getElementById(id); if (el) el.style.display = 'none'; }

// ── Contract HTML generation ──────────────────────────────────────────────────
function buildContractHtml(d) {
  return `
<div style="font-family:'Inter',sans-serif;font-size:13px;color:#334155;line-height:1.8;">

  <h2 style="font-size:15px;font-weight:900;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:10px;margin:0 0 16px;">
    PRE-AGREEMENT STATEMENT AND QUOTATION<br>
    <span style="font-size:11px;font-weight:600;color:#64748b;">(Section 92 of the National Credit Act 34 of 2005)</span>
  </h2>

  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;">
    <tr><td style="padding:4px 8px;font-weight:700;color:#64748b;width:45%;">Lender (Credit Provider)</td><td style="padding:4px 8px;font-weight:700;color:#0f172a;">${d.company}</td></tr>
    <tr style="background:#f8fafc;"><td style="padding:4px 8px;font-weight:700;color:#64748b;">NCR Registration</td><td style="padding:4px 8px;color:#0f172a;">${d.ncrNo}</td></tr>
    <tr><td style="padding:4px 8px;font-weight:700;color:#64748b;">FSP Number</td><td style="padding:4px 8px;color:#0f172a;">${d.fspNo}</td></tr>
    <tr style="background:#f8fafc;"><td style="padding:4px 8px;font-weight:700;color:#64748b;">Borrower</td><td style="padding:4px 8px;font-weight:700;color:#0f172a;">${d.name}</td></tr>
    <tr><td style="padding:4px 8px;font-weight:700;color:#64748b;">ID Number</td><td style="padding:4px 8px;color:#0f172a;">${d.idNum}</td></tr>
    <tr style="background:#f8fafc;"><td style="padding:4px 8px;font-weight:700;color:#64748b;">Contact Number</td><td style="padding:4px 8px;color:#0f172a;">${d.phone}</td></tr>
    <tr><td style="padding:4px 8px;font-weight:700;color:#64748b;">Email</td><td style="padding:4px 8px;color:#0f172a;">${d.email}</td></tr>
    <tr style="background:#f8fafc;"><td style="padding:4px 8px;font-weight:700;color:#64748b;">Agreement Date</td><td style="padding:4px 8px;color:#0f172a;">${d.today}</td></tr>
    <tr><td style="padding:4px 8px;font-weight:700;color:#64748b;">Reference</td><td style="padding:4px 8px;color:#0f172a;">${d.loanNumber}</td></tr>
  </table>

  <h3 style="font-size:12px;font-weight:800;color:#7c3aed;text-transform:uppercase;letter-spacing:.06em;margin:16px 0 8px;">Loan Details</h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;">
    <tr><td style="padding:4px 8px;font-weight:700;color:#64748b;width:55%;">Principal Loan Amount</td><td style="padding:4px 8px;font-weight:800;color:#0f172a;">${d.principal}</td></tr>
    <tr style="background:#f8fafc;"><td style="padding:4px 8px;font-weight:700;color:#64748b;">Loan Term</td><td style="padding:4px 8px;color:#0f172a;">${d.term} months</td></tr>
    <tr><td style="padding:4px 8px;font-weight:700;color:#64748b;">Annual Interest Rate</td><td style="padding:4px 8px;color:#0f172a;">${d.annualRate}</td></tr>
    <tr style="background:#f8fafc;"><td style="padding:4px 8px;font-weight:700;color:#64748b;">First Payment Date</td><td style="padding:4px 8px;color:#0f172a;">${d.firstPayment}</td></tr>
    <tr><td style="padding:4px 8px;font-weight:700;color:#64748b;">Initiation Fee</td><td style="padding:4px 8px;color:#0f172a;">${d.initiationFee}</td></tr>
    <tr style="background:#f8fafc;"><td style="padding:4px 8px;font-weight:700;color:#64748b;">Total Admin Fees</td><td style="padding:4px 8px;color:#0f172a;">${d.adminFee}</td></tr>
    <tr><td style="padding:4px 8px;font-weight:700;color:#64748b;">Total Interest Charged</td><td style="padding:4px 8px;color:#0f172a;">${d.totalInterest}</td></tr>
    ${d.hasCreditLife ? `<tr style="background:#f3e8ff;"><td style="padding:4px 8px;font-weight:700;color:#64748b;">Sanlam Credit Life Insurance (total)</td><td style="padding:4px 8px;color:#7c3aed;font-weight:700;">${d.totalCreditLife}</td></tr>` : ''}
    <tr style="border-top:2px solid #7c3aed;"><td style="padding:6px 8px;font-weight:800;color:#0f172a;">Total Repayable Amount</td><td style="padding:6px 8px;font-weight:900;color:#7c3aed;font-size:14px;">${d.totalRepayment}</td></tr>
  </table>

  <h3 style="font-size:12px;font-weight:800;color:#7c3aed;text-transform:uppercase;letter-spacing:.06em;margin:16px 0 8px;">Monthly Instalment Breakdown</h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;">
    <tr><td style="padding:4px 8px;font-weight:700;color:#64748b;width:55%;">Principal Repayment</td><td style="padding:4px 8px;color:#0f172a;">Reducing balance</td></tr>
    <tr style="background:#f8fafc;"><td style="padding:4px 8px;font-weight:700;color:#64748b;">Interest &amp; Fees</td><td style="padding:4px 8px;color:#0f172a;">Included in instalment</td></tr>
    ${d.hasCreditLife ? `<tr><td style="padding:4px 8px;font-weight:700;color:#64748b;">Monthly Credit Life Premium (Sanlam)</td><td style="padding:4px 8px;color:#7c3aed;font-weight:700;">${d.creditLifeMonthly}/mo (avg)</td></tr>` : ''}
    <tr style="border-top:2px solid #7c3aed;background:#faf5ff;"><td style="padding:6px 8px;font-weight:800;color:#0f172a;">Total Monthly Instalment</td><td style="padding:6px 8px;font-weight:900;color:#7c3aed;font-size:13px;">${d.monthlyPayment}</td></tr>
  </table>

  <h3 style="font-size:12px;font-weight:800;color:#7c3aed;text-transform:uppercase;letter-spacing:.06em;margin:16px 0 8px;">Terms &amp; Conditions</h3>

  <p><strong>1. Disbursement.</strong> The loan will be disbursed to the banking account provided by the borrower after this agreement is signed and internal verification is complete.</p>
  <p><strong>2. Repayment.</strong> Monthly instalments are due on the date specified above and will be collected via DebiCheck debit order. It is the borrower's responsibility to ensure sufficient funds are available.</p>
  <p><strong>3. Early Settlement.</strong> The borrower may settle this loan early at any time. An early settlement amount will be calculated on request. No early settlement penalty applies.</p>
  <p><strong>4. Default &amp; Arrears.</strong> Failure to pay any instalment on the due date constitutes a default. ${d.company} reserves the right to report the default to credit bureaux as required by the NCA and to institute legal proceedings to recover the outstanding balance, including legal costs.</p>
  <p><strong>5. Right to Cancel.</strong> The borrower has 5 (five) business days from the date of this agreement to cancel without penalty, provided no funds have been disbursed.</p>
  <p><strong>6. Credit Bureau Reporting.</strong> ${d.company} is obliged to report your payment conduct to registered credit bureaux. Good payment conduct will improve your credit profile.</p>
  <p><strong>7. Affordability.</strong> By signing this agreement the borrower confirms that all information provided in the loan application is true and correct, and that the monthly instalment is affordable.</p>
  <p><strong>8. Governing Law.</strong> This agreement is governed by the National Credit Act 34 of 2005 and the laws of the Republic of South Africa.</p>

  <div style="margin-top:16px;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;font-size:11px;color:#991b1b;line-height:1.6;">
    <strong>IMPORTANT NOTICE (NCA s.81):</strong> Do not sign this agreement unless you have read and understood it. You are entitled to a copy of this agreement at no charge. ${d.company} (${d.ncrNo}) is a registered credit provider.
  </div>

</div>`;
}

// ── Canvas drawing ────────────────────────────────────────────────────────────
function initCanvas() {
  signatureCanvas = document.getElementById('sig-canvas');
  if (!signatureCanvas) return;
  sigCtx = signatureCanvas.getContext('2d');

  const dpr = window.devicePixelRatio || 1;
  const rect = signatureCanvas.getBoundingClientRect();
  signatureCanvas.width  = rect.width  * dpr;
  signatureCanvas.height = rect.height * dpr;
  sigCtx.scale(dpr, dpr);
  sigCtx.strokeStyle = '#1e293b';
  sigCtx.lineWidth   = 2.5;
  sigCtx.lineCap     = 'round';
  sigCtx.lineJoin    = 'round';

  const pos = (e) => {
    const r = signatureCanvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  };

  const start = (e) => {
    e.preventDefault();
    isDrawing = true;
    const p = pos(e);
    sigCtx.beginPath();
    sigCtx.moveTo(p.x, p.y);
  };
  const move = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const p = pos(e);
    sigCtx.lineTo(p.x, p.y);
    sigCtx.stroke();
    const ph = document.getElementById('sig-placeholder');
    if (ph) ph.style.display = 'none';
    hasSigned = true;
    checkReadyToSubmit();
  };
  const stop = () => { isDrawing = false; };

  signatureCanvas.addEventListener('mousedown', start);
  signatureCanvas.addEventListener('mousemove', move);
  signatureCanvas.addEventListener('mouseup',   stop);
  signatureCanvas.addEventListener('mouseleave', stop);
  signatureCanvas.addEventListener('touchstart', start, { passive: false });
  signatureCanvas.addEventListener('touchmove',  move,  { passive: false });
  signatureCanvas.addEventListener('touchend',   stop);
}

window.clearSignature = function() {
  if (!sigCtx || !signatureCanvas) return;
  sigCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
  hasSigned = false;
  const ph = document.getElementById('sig-placeholder');
  if (ph) ph.style.display = '';
  checkReadyToSubmit();
};

// ── Validation ────────────────────────────────────────────────────────────────
function checkReadyToSubmit() {
  const name    = (document.getElementById('sig-name')?.value || '').trim();
  const consent = document.getElementById('sig-consent')?.checked;
  const btn     = document.getElementById('sign-submit-btn');
  const ready   = hasSigned && name.length > 2 && consent;
  if (btn) {
    btn.disabled  = !ready;
    btn.style.opacity = ready ? '1' : '.5';
    btn.innerHTML = ready
      ? '<i class="fas fa-check-circle" style="margin-right:8px;"></i>Sign &amp; Submit Agreement'
      : '<i class="fas fa-lock" style="margin-right:8px;"></i>Sign &amp; Submit Agreement';
  }
}

// ── Scroll tracking ───────────────────────────────────────────────────────────
function initScrollTracking() {
  const box = document.getElementById('agreement-scroll');
  if (!box) return;
  box.addEventListener('scroll', () => {
    const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 20;
    if (atBottom && !hasScrolled) {
      hasScrolled = true;
      const sig = document.getElementById('signature-section');
      const notice = document.getElementById('scroll-notice');
      if (sig) { sig.style.opacity = '1'; sig.style.pointerEvents = 'auto'; }
      if (notice) notice.style.display = 'none';
    }
  });
}

// ── Submit ────────────────────────────────────────────────────────────────────
window.submitSignature = async function() {
  const btn = document.getElementById('sign-submit-btn');
  const name = (document.getElementById('sig-name')?.value || '').trim();
  if (!hasSigned || !name || !document.getElementById('sig-consent')?.checked) return;
  if (!applicationId) return;

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin" style="margin-right:8px;"></i>Submitting…';

  try {
    const signatureDataUrl = signatureCanvas.toDataURL('image/png');
    const contractHtml = document.getElementById('agreement-scroll')?.innerHTML || '';

    const res = await fetch(`/api/applications/${applicationId}/sign-contract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signatureDataUrl,
        clientName:       name,
        agreedAt:         new Date().toISOString(),
        contractSnapshot: contractHtml,
      }),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Signing failed');

    // Step indicator
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    if (step2) { step2.classList.remove('contract-step-active'); step2.classList.add('contract-step-done'); }
    if (step3) { step3.classList.add('contract-step-active'); }

    hide('contract-body');
    const successEl = document.getElementById('contract-success');
    if (successEl) { successEl.style.display = ''; }
    const signedMsg = document.getElementById('success-signed-at');
    if (signedMsg) {
      const d = new Date(result.signed_at || Date.now());
      signedMsg.textContent = `Signed on ${d.toLocaleDateString('en-ZA', { day:'numeric', month:'long', year:'numeric' })} at ${d.toLocaleTimeString('en-ZA', { hour:'2-digit', minute:'2-digit' })}`;
    }
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-exclamation-triangle" style="margin-right:8px;"></i>' + (err.message || 'Error — try again');
    btn.style.background = '#ef4444';
    setTimeout(() => {
      btn.style.background = '#7c3aed';
      btn.innerHTML = '<i class="fas fa-check-circle" style="margin-right:8px;"></i>Sign &amp; Submit Agreement';
      btn.disabled = false;
    }, 3000);
  }
};

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  applicationId = getAppId();

  if (!applicationId) {
    hide('contract-loading');
    show('contract-body');
    const box = document.getElementById('agreement-scroll');
    if (box) box.innerHTML = '<p style="color:#ef4444;text-align:center;padding:40px 0;">No application ID found. Please return to your dashboard.</p>';
    return;
  }

  try {
    const res = await fetch(`/api/applications/${applicationId}/contract`);
    if (!res.ok) throw new Error('Failed to load contract');
    contractData = await res.json();

    hide('contract-loading');

    if (contractData.alreadySigned) {
      const msg = document.getElementById('already-signed-msg');
      if (msg) {
        const d = new Date(contractData.signedAt);
        msg.textContent = `This agreement was signed by ${contractData.signatureName || 'you'} on ${d.toLocaleDateString('en-ZA', { day:'numeric', month:'long', year:'numeric' })}.`;
      }
      show('contract-already-signed');
      return;
    }

    // Populate banner
    document.getElementById('contract-subtitle').textContent  = `Ref: ${contractData.loanNumber} · ${contractData.today}`;
    document.getElementById('banner-principal').textContent   = contractData.principal;
    document.getElementById('banner-monthly').textContent     = contractData.monthlyPayment;
    document.getElementById('banner-term').textContent        = `${contractData.term} months`;
    document.getElementById('banner-first').textContent       = contractData.firstPayment;

    // Populate contract text
    const box = document.getElementById('agreement-scroll');
    if (box) box.innerHTML = buildContractHtml(contractData);

    show('contract-body');
    initScrollTracking();
    initCanvas();

    // Wire up live validation
    document.getElementById('sig-name')?.addEventListener('input', (e) => {
      const cn = document.getElementById('consent-name');
      if (cn) cn.textContent = e.target.value.trim() || 'the undersigned';
      checkReadyToSubmit();
    });
    document.getElementById('sig-consent')?.addEventListener('change', checkReadyToSubmit);

  } catch (err) {
    hide('contract-loading');
    show('contract-body');
    const box = document.getElementById('agreement-scroll');
    if (box) box.innerHTML = `<p style="color:#ef4444;text-align:center;padding:40px 0;">${err.message}</p>`;
  }
}

// Trigger on pageLoaded or direct load
if (document.getElementById('contract-loading')) {
  init();
} else {
  window.addEventListener('pageLoaded', (e) => {
    if (e?.detail?.pageName === 'contract-sign') init();
  }, { once: true });
}

document.addEventListener('pageLoaded', (e) => {
  if (e?.detail?.pageName === 'contract-sign') init();
}, { once: true });
