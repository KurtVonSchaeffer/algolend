import { useState, type ReactNode } from 'react';
import { apiFetch } from '../api/apiClient';

const SHADOW_SOFT = '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)';
const RADIUS = 24;

// ── data (verbatim from legacy support.js) ────────────────────────────────────

const BRANCHES = [
  { name: 'Emdeni South',        phone: '067 174 9249', address: '5722 Botani Street, Emdeni, Soweto, 1861.' },
  { name: 'Naledi',              phone: '068 483 9246', address: '1 Dumelang Street, Naledi (opposite the train station).' },
  { name: 'Emdeni North',        phone: '069 559 8230', address: 'Thuthukani Shopping Centre, 02166 Phidwa Street, Emdeni North, Soweto, 1861.' },
  { name: 'Tshepisong',          phone: '065 823 5820', address: '14909 corner Sophie Masite and Hector Peterson Street, Phase 7, Tshepisong.' },
  { name: 'Slovoville',          phone: '062 656 3948', address: '11130 Boulevard Street, Slovoville.' },
  { name: 'Braamfischerville',   phone: '067 036 6783', address: '16207 corner Apex Drive and Future Street, Phase 4, Braamfischerville.' },
  { name: 'Mthwalume (KZN)',     phone: '069 201 8028', address: 'Opposite SASSA Office Umzumbe Magistrate Court Road, Mtwalume, KwaZulu-Natal, 4186.' },
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
  {
    q: 'Can I use my SRD SASSA grant to apply for financing?',
    a: 'No.',
  },
  {
    q: 'How do I lodge a complaint?',
    a: 'Email info@algolend.co.za or use the in-platform messaging system.',
  },
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

const CODE_OF_CONDUCT = [
  { title: 'Pre-Agreement Statement and Quotation', text: 'We provide all clients with a clear pre-agreement statement and a comprehensive quotation prior to entering into any agreement.' },
  { title: 'Credit Agreement Transparency', text: 'We ensure that all clients receive a copy of their credit agreement, detailing the terms and conditions in an easily understandable format.' },
  { title: 'Full Disclosure of Costs', text: 'We inform clients of all costs associated with the agreement, ensuring they are fully aware of their financial commitments.' },
  { title: 'Credit Reporting', text: 'We adhere to the NCR, FSCA and FIC as required, maintaining the highest standards of compliance.' },
  { title: 'Client Support in Default Situations', text: 'We assist clients who find themselves in default, ensuring they have the support needed to navigate difficult financial situations.' },
];

const TICKET_CATEGORIES = [
  { value: 'general',   label: 'General Enquiry' },
  { value: 'payment',   label: 'Payment Issue' },
  { value: 'loan',      label: 'Loan Query' },
  { value: 'account',   label: 'Account Problem' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'other',     label: 'Other' },
];

// ── shared bits ───────────────────────────────────────────────────────────────

function SectionCard({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: RADIUS, padding: 28, boxShadow: SHADOW_SOFT }}>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: '0 0 20px', letterSpacing: '-0.3px' }}>
        <i className={`fas ${icon}`} style={{ color: 'var(--color-primary)', marginRight: 10 }} />
        {title}
      </h3>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(244,240,234,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 32, width: '100%', maxWidth: 600, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 60px rgba(0,0,0,0.10)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '28px 32px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1C1C1E', margin: 0, letterSpacing: '-0.5px' }}>{title}</h2>
          <button
            onClick={onClose}
            style={{ background: '#FAFAFA', border: 'none', width: 40, height: 40, borderRadius: '50%', color: '#1C1C1E', cursor: 'pointer', fontSize: 15 }}
          >
            <i className="fas fa-times" />
          </button>
        </div>
        <div style={{ padding: '0 32px 32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── ticket form modal ─────────────────────────────────────────────────────────

function TicketModal({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState('general');
  const [subject, setSubject]   = useState('');
  const [message, setMessage]   = useState('');
  const [sending, setSending]   = useState(false);
  const [result, setResult]     = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    if (!message.trim()) { setResult({ ok: false, text: 'Please enter a message.' }); return; }
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
      setResult({ ok: true, text: `Message sent! Reference: ${data.ticketRef}. We'll respond within 1 business day.` });
      setSubject('');
      setMessage('');
      setTimeout(onClose, 4000);
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : 'Submission failed' });
    } finally {
      setSending(false);
    }
  }

  const fieldStyle = { width: '100%', border: '2px solid #e5e7eb', borderRadius: 12, padding: '10px 14px', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const };
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, color: '#6b7280', marginBottom: 6 };

  return (
    <Modal title="Send a Message" onClose={onClose}>
      <div>
        <label style={labelStyle}>Category</label>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...fieldStyle, background: '#fff' }}>
          {TICKET_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Subject</label>
        <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief description of your issue" style={fieldStyle} />
      </div>
      <div>
        <label style={labelStyle}>Message *</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="Describe your issue in detail..." style={{ ...fieldStyle, resize: 'none' }} />
      </div>
      <button
        onClick={submit}
        disabled={sending}
        style={{ width: '100%', padding: 14, background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.7 : 1, fontFamily: 'inherit' }}
      >
        {sending ? 'Sending…' : 'Send Message'}
      </button>
      {result && (
        <div style={{
          background: result.ok ? '#f0fdf4' : '#fff1f2',
          border: `1px solid ${result.ok ? '#bbf7d0' : '#fecdd3'}`,
          borderRadius: 12, padding: 14, fontSize: 13,
          color: result.ok ? '#166534' : '#ef4444', fontWeight: 600,
        }}>
          {result.ok ? '✅ ' : ''}{result.text}
        </div>
      )}
    </Modal>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export function SupportPage() {
  const [openFaq, setOpenFaq]           = useState<number | null>(null);
  const [showBranches, setShowBranches] = useState(false);
  const [showTicket, setShowTicket]     = useState(false);
  const [resourceNote, setResourceNote] = useState('');

  const contacts = [
    { label: 'Email Support', value: 'info@algolend.co.za', icon: 'fa-envelope',      btnIcon: 'fa-paper-plane', btnText: 'Send Email',  action: () => { window.location.href = 'mailto:info@algolend.co.za'; } },
    { label: 'Call Centre',   value: '010 500 0978',        icon: 'fa-phone-alt',     btnIcon: 'fa-phone',       btnText: 'Call Now',    action: () => { window.location.href = 'tel:0105000978'; } },
    { label: 'Customer Care', value: '069 119 5046',        icon: 'fa-headset',       btnIcon: 'fa-comment',     btnText: 'Send Message', action: () => setShowTicket(true) },
    { label: 'Visit Us',      value: `${BRANCHES.length} Branches`, icon: 'fa-map-marker-alt', btnIcon: 'fa-building', btnText: 'View Locations', action: () => setShowBranches(true) },
  ];

  function openResource(name: string) {
    setResourceNote(`${name} document will be available soon.`);
    setTimeout(() => setResourceNote(''), 3000);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-1px', color: '#1C1C1E', margin: 0 }}>Support &amp; About Us</h1>
        <p style={{ fontSize: 14, color: '#8E8E93', margin: '4px 0 0', fontWeight: 500 }}>
          Learn more about AlgoLend and find a branch near you.
        </p>
      </div>

      {/* Contact cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {contacts.map(c => (
          <div key={c.label} style={{ background: '#fff', borderRadius: RADIUS, padding: 22, boxShadow: SHADOW_SOFT, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8E8E93', margin: '0 0 4px' }}>{c.label}</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0, wordBreak: 'break-word' }}>{c.value}</p>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(91,33,182,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fas ${c.icon}`} style={{ color: 'var(--color-primary)', fontSize: 16 }} />
              </div>
            </div>
            <button
              onClick={c.action}
              style={{ border: '1.5px solid var(--color-primary)', background: 'transparent', color: 'var(--color-primary)', borderRadius: 12, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <i className={`fas ${c.btnIcon}`} style={{ marginRight: 6 }} /> {c.btnText}
            </button>
          </div>
        ))}
      </div>

      {/* About */}
      <SectionCard icon="fa-info-circle" title="About AlgoLend">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          <div>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', margin: '0 0 8px' }}>What we stand for</h4>
            <p style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.7, margin: '0 0 16px' }}>
              AlgoLend is a bespoke, end-to-end digital credit and risk management platform built for corporate lending.
              We partner with registered credit providers and FSPs to deliver fully branded, customised lending solutions —
              covering the complete client journey from digital application through to portfolio management and compliance reporting.
            </p>
            <h5 style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E', margin: '0 0 10px' }}>Our Strict Code of Conduct:</h5>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {CODE_OF_CONDUCT.map(item => (
                <li key={item.title} style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>
                  <strong style={{ color: '#1C1C1E' }}>{item.title}:</strong> {item.text}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', margin: '0 0 8px' }}>Our story</h4>
            <p style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.7, margin: 0 }}>
              AlgoLend was built to solve the gap between enterprise-grade credit infrastructure and the lenders who need it most.
              Established lenders, emerging credit providers, and specialist finance businesses deserve the same sophisticated tools
              as the largest banks — without the cost or complexity of building from scratch.
              <br /><br />
              Our platform is not off-the-shelf. Each implementation is custom-configured to your credit model, aligned to your
              compliance framework, and branded to your business identity — delivered as a fully managed, end-to-end digital lending system.
            </p>
          </div>
        </div>

        <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', margin: '28px 0 16px' }}>Why Us</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {WHY_US.map(w => (
            <div key={w.title} style={{ background: '#FAFAFA', borderRadius: 16, padding: 20 }}>
              <i className={`fas ${w.icon}`} style={{ fontSize: 22, color: 'var(--color-primary)', marginBottom: 10, display: 'block' }} />
              <h5 style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E', margin: '0 0 6px' }}>{w.title}</h5>
              <p style={{ fontSize: 12.5, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>{w.text}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* FAQ + Legal */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>

        <SectionCard icon="fa-question-circle" title="Frequently Asked Questions">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {FAQS.map((faq, i) => {
              const open = openFaq === i;
              return (
                <div key={i} style={{ background: '#FAFAFA', borderRadius: 14, overflow: 'hidden' }}>
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                  >
                    <i className="fas fa-chevron-right" style={{ fontSize: 11, color: 'var(--color-primary)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1C1C1E' }}>{faq.q}</span>
                  </button>
                  {open && (
                    <div style={{ padding: '0 16px 14px 37px', fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard icon="fa-book" title="Legal & Resources">
          {resourceNote && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#1e40af', marginBottom: 12 }}>
              <i className="fas fa-info-circle" style={{ marginRight: 6 }} />{resourceNote}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: 'fa-file-alt',      title: 'User Guide',          desc: 'Complete guide to using the platform' },
              { icon: 'fa-file-contract', title: 'Terms & Conditions',  desc: 'Loan terms and agreements' },
              { icon: 'fa-shield-alt',    title: 'Privacy Policy',      desc: 'How we protect your data' },
            ].map(r => (
              <button
                key={r.title}
                onClick={() => openResource(r.title)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 14, border: 'none', background: '#FAFAFA', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'background 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F0F0F0'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#FAFAFA'; }}
              >
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={`fas ${r.icon}`} style={{ color: 'var(--color-primary)', fontSize: 14 }} />
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>{r.title}</span>
                  <span style={{ display: 'block', fontSize: 12, color: '#8E8E93' }}>{r.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Branches modal */}
      {showBranches && (
        <Modal title="Our Branch Locations" onClose={() => setShowBranches(false)}>
          {BRANCHES.map(b => (
            <div key={b.name} style={{ background: '#FAFAFA', borderRadius: 16, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E' }}>
                  <i className="fas fa-map-marker-alt" style={{ color: 'var(--color-primary)', marginRight: 8 }} />
                  {b.name}
                </span>
                <a
                  href={`tel:${b.phone.replace(/\s+/g, '')}`}
                  style={{ background: 'var(--color-primary)', color: '#fff', borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}
                >
                  <i className="fas fa-phone-alt" style={{ marginRight: 5 }} /> Call
                </a>
              </div>
              <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6, margin: 0 }}>
                {b.address}
                <strong style={{ color: '#1C1C1E', marginTop: 4, display: 'block' }}>Direct Line: {b.phone}</strong>
              </p>
            </div>
          ))}
        </Modal>
      )}

      {/* Ticket modal */}
      {showTicket && <TicketModal onClose={() => setShowTicket(false)} />}
    </div>
  );
}
