// Support page JS - Neumorphic Update & Branches Data

// Exact Branch Data provided
const branchesData = [
  { name: 'Emdeni South', phone: '067 174 9249', address: '5722 Botani Street, Emdeni, Soweto, 1861.' },
  { name: 'Naledi', phone: '068 483 9246', address: '1 Dumelang Street, Naledi (opposite the train station).' },
  { name: 'Emdeni North', phone: '069 559 8230', address: 'Thuthukani Shopping Centre, 02166 Phidwa Street, Emdeni North, Soweto, 1861.' },
  { name: 'Tshepisong', phone: '065 823 5820', address: '14909 corner Sophie Masite and Hector Peterson Street, Phase 7, Tshepisong.' },
  { name: 'Slovoville', phone: '062 656 3948', address: '11130 Boulevard Street, Slovoville.' },
  { name: 'Braamfischerville', phone: '067 036 6783', address: '16207 corner Apex Drive and Future Street, Phase 4, Braamfischerville.' },
  { name: 'Mthwalume (KZN)', phone: '069 201 8028', address: 'Opposite SASSA Office Umzumbe Magistrate Court Road, Mtwalume, KwaZulu-Natal, 4186.' }
];

function toggleFAQ(element) {
  const faqItem = element.parentElement;
  const wasActive = faqItem.classList.contains('active');
  
  // Close all FAQ items with a smooth height transition
  document.querySelectorAll('.faq-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // Toggle current item
  if (!wasActive) {
    faqItem.classList.add('active');
  }
}

function openResource(type) {
  const resourceNames = {
    'user-guide': 'User Guide',
    'terms': 'Terms & Conditions',
    'privacy': 'Privacy Policy'
  };
  
  const name = resourceNames[type] || type;
  
  if (typeof showToast === 'function') {
    showToast('Coming Soon', `${name} document will be available soon.`, 'info', 3000);
  } else {
    alert(`${name} document will be available soon.`);
  }
  
  return false;
}

// ==========================================
// UNIVERSAL MODALS (For Branches)
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

window.openBranchesModal = function() {
    const html = branchesData.map(branch => `
        <div class="branch-list-item">
            <div class="branch-header">
                <span class="branch-name"><i class="fas fa-map-marker-alt"></i> ${branch.name}</span>
                <button class="action-btn primary" onclick="window.location.href='tel:${branch.phone.replace(/\s+/g, '')}'" style="height: 36px; padding: 0 16px; font-size: 12px;">
                    <i class="fas fa-phone-alt"></i> Call
                </button>
            </div>
            <div class="branch-address">
                ${branch.address}<br>
                <strong style="color: var(--text-main); margin-top: 4px; display: block;">Direct Line: ${branch.phone}</strong>
            </div>
        </div>
    `).join('');

    openUniversalModal('Our Branch Locations', html, false);
};

// ── Support Ticket Submission ──────────────────────────────────
window.openSupportTicketModal = function() {
  let modal = document.getElementById('support-ticket-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'support-ticket-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;align-items:center;justify-content:center;padding:16px';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:24px;width:100%;max-width:440px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.2)">
        <div style="background:var(--color-primary,#E7762E);padding:20px 24px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <p style="color:rgba(255,255,255,.8);font-size:11px;font-weight:700;text-transform:uppercase;margin:0">Support</p>
            <h3 style="color:#fff;font-size:18px;font-weight:800;margin:4px 0 0">Send a Message</h3>
          </div>
          <button onclick="document.getElementById('support-ticket-modal').style.display='none'"
            style="background:rgba(255,255,255,.2);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:16px">✕</button>
        </div>
        <div style="padding:24px">
          <div style="margin-bottom:14px">
            <label style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:6px">Category</label>
            <select id="ticket-category" style="width:100%;border:2px solid #e5e7eb;border-radius:12px;padding:10px 14px;font-size:14px;background:#fff;outline:none">
              <option value="general">General Enquiry</option>
              <option value="payment">Payment Issue</option>
              <option value="loan">Loan Query</option>
              <option value="account">Account Problem</option>
              <option value="complaint">Complaint</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div style="margin-bottom:14px">
            <label style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:6px">Subject</label>
            <input id="ticket-subject" type="text" placeholder="Brief description of your issue"
              style="width:100%;border:2px solid #e5e7eb;border-radius:12px;padding:10px 14px;font-size:14px;outline:none;box-sizing:border-box">
          </div>
          <div style="margin-bottom:20px">
            <label style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:6px">Message *</label>
            <textarea id="ticket-message" rows="4" placeholder="Describe your issue in detail..."
              style="width:100%;border:2px solid #e5e7eb;border-radius:12px;padding:10px 14px;font-size:14px;outline:none;resize:none;box-sizing:border-box"></textarea>
          </div>
          <button id="ticket-submit-btn" onclick="window.submitSupportTicket()"
            style="width:100%;padding:14px;background:var(--color-primary,#E7762E);color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer">
            Send Message
          </button>
          <div id="ticket-result" style="display:none;margin-top:12px;text-align:center"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
  }
  modal.style.display = 'flex';
};

window.submitSupportTicket = async function() {
  const btn     = document.getElementById('ticket-submit-btn');
  const result  = document.getElementById('ticket-result');
  const message = document.getElementById('ticket-message')?.value?.trim();
  const subject = document.getElementById('ticket-subject')?.value?.trim();
  const category= document.getElementById('ticket-category')?.value;

  if (!message) { alert('Please enter a message.'); return; }

  btn.textContent = 'Sending…'; btn.disabled = true;
  result.style.display = 'none';

  try {
    const { supabase } = await import('/Services/supabaseClient.js');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Please log in again.');

    const res  = await fetch('/api/support/ticket', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body:    JSON.stringify({ subject, category, message })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Submission failed');

    result.style.display = 'block';
    result.innerHTML = `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px">
      <p style="color:#15803d;font-weight:700;margin:0 0 4px">✅ Message sent!</p>
      <p style="color:#166534;font-size:13px;margin:0">Reference: <strong>${data.ticketRef}</strong><br>We'll respond within 1 business day.</p>
    </div>`;
    document.getElementById('ticket-message').value = '';
    document.getElementById('ticket-subject').value = '';
    setTimeout(() => { document.getElementById('support-ticket-modal').style.display = 'none'; result.style.display = 'none'; }, 4000);
  } catch(e) {
    result.style.display = 'block';
    result.innerHTML = `<p style="color:#ef4444;font-size:13px">Error: ${e.message}</p>`;
  } finally {
    btn.textContent = 'Send Message'; btn.disabled = false;
  }
};

// Make functions globally accessible
window.toggleFAQ    = toggleFAQ;
window.openResource = openResource;

console.log('✅ Support page functions loaded');