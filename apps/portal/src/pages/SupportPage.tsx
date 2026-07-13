import { useState, type ReactNode } from 'react';
import { apiFetch } from '../api/apiClient';
import { usePageCSS } from '../hooks/usePageCSS';
import supportCssUrl from '../legacy-css/12-support.css?url';

// ── data (verbatim from legacy support.js) ────────────────────────────────────

const BRANCHES = [
  { name: 'Emdeni South',      phone: '067 174 9249', address: '5722 Botani Street, Emdeni, Soweto, 1861.' },
  { name: 'Naledi',            phone: '068 483 9246', address: '1 Dumelang Street, Naledi (opposite the train station).' },
  { name: 'Emdeni North',      phone: '069 559 8230', address: 'Thuthukani Shopping Centre, 02166 Phidwa Street, Emdeni North, Soweto, 1861.' },
  { name: 'Tshepisong',        phone: '065 823 5820', address: '14909 corner Sophie Masite and Hector Peterson Street, Phase 7, Tshepisong.' },
  { name: 'Slovoville',        phone: '062 656 3948', address: '11130 Boulevard Street, Slovoville.' },
  { name: 'Braamfischerville', phone: '067 036 6783', address: '16207 corner Apex Drive and Future Street, Phase 4, Braamfischerville.' },
  { name: 'Mthwalume (KZN)',   phone: '069 201 8028', address: 'Opposite SASSA Office Umzumbe Magistrate Court Road, Mtwalume, KwaZulu-Natal, 4186.' },
];

const FAQS = [
  {
    q: 'When will I be eligible for an increase in my loan amount?',
    a: 'Loan eligibility and terms are determined by the credit policy of your lender. Please contact the support team for details specific to your account.',
  },
  {
    q: 'Does your financing require upfront payments?',
    a: 'We will never ask for an upfront fee. That is illegal. Please contact us should you be required to pay an upfront fee by any of our consultants.',
  },
  { q: 'Can I use my SRD SASSA grant to apply for financing?', a: 'No.' },
  { q: 'How do I lodge a complaint?', a: 'Email info@algolend.co.za or use the in-platform messaging system.' },
  {
    q: 'Which bank accounts do you accept?',
    a: 'All major bank accounts, except Discovery. Tymebank applications are processed in branch.',
  },
];

const WHY_US = [
  { icon: 'fa-chart-pie',  title: 'Credit Scoring',   text: 'We use a unique financial vetting process that considers everyone’s specific financial circumstances, ensuring a fair and tailored approach to credit approval.' },
  { icon: 'fa-lightbulb',  title: 'Solution Driven',  text: 'We offer tailored financial products that cater to the unique needs of our clients.' },
  { icon: 'fa-door-open',  title: 'Financial Access', text: 'Granting access to formal financial services for all, regardless of income, location, or background.' },
  { icon: 'fa-heart',      title: 'Customer Care',    text: 'We take pride in providing high-quality customer service to ensure customer satisfaction and promptly address any concerns or issues.' },
];

const TICKET_CATEGORIES = [
  { value: 'general',   label: 'General Enquiry' },
  { value: 'payment',   label: 'Payment Issue' },
  { value: 'loan',      label: 'Loan Query' },
  { value: 'account',   label: 'Account Problem' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'other',     label: 'Other' },
];

// ── universal modal (legacy modern-modal markup) ──────────────────────────────

function UniversalModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modern-modal-overlay" onClick={onClose}>
      <div className="modern-modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modern-modal-header">
          <h2 className="modern-modal-title">{title}</h2>
          <button className="modern-modal-close" onClick={onClose}><i className="fas fa-times" /></button>
        </div>
        <div className="modern-modal-body">{children}</div>
      </div>
    </div>
  );
}

// ── ticket modal (legacy support-ticket-modal markup, inline-styled like legacy) ──

function TicketModal({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState('general');
  const [subject, setSubject]   = useState('');
  const [message, setMessage]   = useState('');
  const [sending, setSending]   = useState(false);
  const [result, setResult]     = useState<{ ok: boolean; html: string } | null>(null);

  async function submit() {
    if (!message.trim()) { alert('Please enter a message.'); return; }
    setSending(true);
    setResult(null);
    try {
      const res = await apiFetch('/api/support/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), category, message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setResult({ ok: true, html: data.ticketRef });
      setSubject('');
      setMessage('');
      setTimeout(onClose, 4000);
    } catch (e) {
      setResult({ ok: false, html: e instanceof Error ? e.message : 'Submission failed' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 440, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: 'var(--color-primary,#7C3AED)', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,.8)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>Support</p>
            <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, margin: '4px 0 0' }}>Send a Message</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 16 }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: 6 }}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: '100%', border: '2px solid #e5e7eb', borderRadius: 12, padding: '10px 14px', fontSize: 14, background: '#fff', outline: 'none' }}>
              {TICKET_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: 6 }}>Subject</label>
            <input
              type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief description of your issue"
              style={{ width: '100%', border: '2px solid #e5e7eb', borderRadius: 12, padding: '10px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: 6 }}>Message *</label>
            <textarea
              rows={4} value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe your issue in detail..."
              style={{ width: '100%', border: '2px solid #e5e7eb', borderRadius: 12, padding: '10px 14px', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <button
            onClick={submit}
            disabled={sending}
            style={{ width: '100%', padding: 14, background: 'var(--color-primary,#7C3AED)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
          >
            {sending ? 'Sending…' : 'Send Message'}
          </button>
          {result && (
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              {result.ok ? (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 14 }}>
                  <p style={{ color: '#15803d', fontWeight: 700, margin: '0 0 4px' }}>✅ Message sent!</p>
                  <p style={{ color: '#166534', fontSize: 13, margin: 0 }}>
                    Reference: <strong>{result.html}</strong><br />We'll respond within 1 business day.
                  </p>
                </div>
              ) : (
                <p style={{ color: '#ef4444', fontSize: 13 }}>Error: {result.html}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── main page (legacy support.html markup) ────────────────────────────────────

export function SupportPage() {
  usePageCSS(supportCssUrl);
  const [openFaq, setOpenFaq]           = useState<number | null>(null);
  const [showBranches, setShowBranches] = useState(false);
  const [showTicket, setShowTicket]     = useState(false);
  const [resourceNote, setResourceNote] = useState('');

  function openResource(name: string) {
    setResourceNote(`${name} document will be available soon.`);
    setTimeout(() => setResourceNote(''), 3000);
  }

  const contacts = [
    { label: 'Email Support', value: 'info@algolend.co.za',            icon: 'fa-envelope',       btnIcon: 'fa-paper-plane', btnText: 'Send Email',     action: () => { window.location.href = 'mailto:info@algolend.co.za'; } },
    { label: 'Call Centre',   value: '010 500 0978',                    icon: 'fa-phone-alt',      btnIcon: 'fa-phone',       btnText: 'Call Now',       action: () => { window.location.href = 'tel:0105000978'; } },
    { label: 'Customer Care', value: '069 119 5046',                    icon: 'fa-headset',        btnIcon: 'fa-headset',     btnText: 'Contact Us',     action: () => setShowTicket(true) },
    { label: 'Visit Us',      value: `${BRANCHES.length} Branches`,     icon: 'fa-map-marker-alt', btnIcon: 'fa-building',    btnText: 'View Locations', action: () => setShowBranches(true) },
  ];

  return (
    <div className="page-container">
      <div className="content-wrapper">

        <header className="minimal-header">
          <div className="header-text">
            <h1>Support &amp; About Us</h1>
            <p className="page-subtitle">Learn more about AlgoLend and find a branch near you.</p>
          </div>
        </header>

        <section className="carousel-section">
          <div className="metrics-carousel">
            {contacts.map(c => (
              <div className="metric-card contact-carousel-card" key={c.label}>
                <div className="card-top-row">
                  <div className="metric-content">
                    <span className="metric-label">{c.label}</span>
                    <span className="metric-value contact-val">{c.value}</span>
                  </div>
                  <div className="metric-icon"><i className={`fas ${c.icon}`} /></div>
                </div>
                <button className="action-btn primary outline-btn" onClick={c.action}>
                  <i className={`fas ${c.btnIcon}`} /> {c.btnText}
                </button>
              </div>
            ))}
          </div>
        </section>

        <div className="section-card">
          <div className="section-header">
            <h3><i className="fas fa-info-circle text-primary" style={{ marginRight: 8, color: 'var(--color-primary)' }} /> About AlgoLend</h3>
          </div>

          <div className="about-grid">
            <div className="about-text-block">
              <h4>What we stand for</h4>
              <p>
                AlgoLend is a bespoke, end-to-end digital credit and risk management platform built for corporate lending.
                We partner with registered credit providers and FSPs to deliver fully branded, customised lending solutions —
                covering the complete client journey from digital application through to portfolio management and compliance reporting.
              </p>
              <div className="code-of-conduct">
                <h5>Our Strict Code of Conduct:</h5>
                <ul>
                  <li><strong>Pre-Agreement Statement and Quotation:</strong> We provide all clients with a clear pre-agreement statement and a comprehensive quotation prior to entering into any agreement.</li>
                  <li><strong>Credit Agreement Transparency:</strong> We ensure that all clients receive a copy of their credit agreement, detailing the terms and conditions in an easily understandable format.</li>
                  <li><strong>Full Disclosure of Costs:</strong> We inform clients of all costs associated with the agreement, ensuring they are fully aware of their financial commitments.</li>
                  <li><strong>Credit Reporting:</strong> We adhere to the NCR, FSCA and FIC as required, maintaining the highest standards of compliance.</li>
                  <li><strong>Client Support in Default Situations:</strong> We assist clients who find themselves in default, ensuring they have the support needed to navigate difficult financial situations.</li>
                </ul>
              </div>
            </div>

            <div className="about-text-block">
              <h4>Our story</h4>
              <p>
                AlgoLend was built to solve the gap between enterprise-grade credit infrastructure and the lenders who need it most.
                Established lenders, emerging credit providers, and specialist finance businesses deserve the same sophisticated tools
                as the largest banks — without the cost or complexity of building from scratch.
                <br /><br />
                Our platform is not off-the-shelf. Each implementation is custom-configured to your credit model, aligned to your
                compliance framework, and branded to your business identity — delivered as a fully managed, end-to-end digital lending system.
              </p>
            </div>
          </div>

          <h4 className="why-us-title">Why Us</h4>
          <div className="why-us-grid">
            {WHY_US.map(w => (
              <div className="why-card" key={w.title}>
                <i className={`fas ${w.icon}`} />
                <h5>{w.title}</h5>
                <p>{w.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="support-bottom-grid">

          <div className="section-card" style={{ marginBottom: 0 }}>
            <div className="section-header">
              <h3><i className="fas fa-question-circle text-primary" style={{ marginRight: 8, color: 'var(--color-primary)' }} /> Frequently Asked Questions</h3>
            </div>
            <div className="faq-container">
              {FAQS.map((faq, i) => (
                <div className={`faq-item${openFaq === i ? ' active' : ''}`} key={i}>
                  <div className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                    <i className="fas fa-chevron-right" />
                    <span>{faq.q}</span>
                  </div>
                  <div className="faq-answer">{faq.a}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="section-card" style={{ marginBottom: 0 }}>
            <div className="section-header">
              <h3><i className="fas fa-book text-primary" style={{ marginRight: 8, color: 'var(--color-primary)' }} /> Legal &amp; Resources</h3>
            </div>
            {resourceNote && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#1e40af', marginBottom: 12 }}>
                <i className="fas fa-info-circle" style={{ marginRight: 6 }} />{resourceNote}
              </div>
            )}
            <div className="help-resources">
              {[
                { icon: 'fa-file-alt',      title: 'User Guide',         desc: 'Complete guide to using the platform' },
                { icon: 'fa-file-contract', title: 'Terms & Conditions', desc: 'Loan terms and agreements' },
                { icon: 'fa-shield-alt',    title: 'Privacy Policy',     desc: 'How we protect your data' },
              ].map(r => (
                <a
                  href="#" className="modern-list-item resource-link" key={r.title}
                  onClick={e => { e.preventDefault(); openResource(r.title); }}
                >
                  <div className="resource-icon"><i className={`fas ${r.icon}`} /></div>
                  <div className="resource-text">
                    <span className="resource-title">{r.title}</span>
                    <span className="resource-desc">{r.desc}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Branches modal (legacy openBranchesModal markup) */}
      {showBranches && (
        <UniversalModal title="Our Branch Locations" onClose={() => setShowBranches(false)}>
          {BRANCHES.map(branch => (
            <div className="branch-list-item" key={branch.name}>
              <div className="branch-header">
                <span className="branch-name"><i className="fas fa-map-marker-alt" /> {branch.name}</span>
                <button
                  className="action-btn primary"
                  onClick={() => { window.location.href = `tel:${branch.phone.replace(/\s+/g, '')}`; }}
                  style={{ height: 36, padding: '0 16px', fontSize: 12 }}
                >
                  <i className="fas fa-phone-alt" /> Call
                </button>
              </div>
              <div className="branch-address">
                {branch.address}<br />
                <strong style={{ color: 'var(--text-main, #1C1C1E)', marginTop: 4, display: 'block' }}>Direct Line: {branch.phone}</strong>
              </div>
            </div>
          ))}
        </UniversalModal>
      )}

      {/* Ticket modal */}
      {showTicket && <TicketModal onClose={() => setShowTicket(false)} />}
    </div>
  );
}
