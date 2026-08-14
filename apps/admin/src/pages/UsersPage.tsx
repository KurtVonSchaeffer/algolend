import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUsers, updateUserRole } from '../services/adminData';
import { supabase } from '../api/supabaseClient';

// ── Demo fallback ─────────────────────────────────────────────────────────────

const DEMO_USERS: AdminUser[] = [
  { id: 'uid-a1b2c3d4e5f6g7h8', full_name: 'Sipho Dlamini',      role: 'borrower',    email: 'sipho.dlamini@gmail.com',     identity_number: '8506015800083', branch_id: 1, branches: { id: 1, name: 'Johannesburg' }, created_at: '2024-03-15T08:30:00Z', last_active_at: '2025-07-20T14:22:00Z', employer_verified: true,  credit_limit_override: null },
  { id: 'uid-b2c3d4e5f6g7h8i9', full_name: 'Thandi Nkosi',       role: 'borrower',    email: 'thandi.nkosi@webmail.co.za',  identity_number: '9201144800080', branch_id: 2, branches: { id: 2, name: 'Cape Town' },    created_at: '2024-05-20T10:15:00Z', last_active_at: '2025-07-10T09:00:00Z', employer_verified: false, credit_limit_override: 20000 },
  { id: 'uid-c3d4e5f6g7h8i9j0', full_name: 'Pieter van der Berg', role: 'borrower',    email: 'pieter.vdberg@outlook.com',   identity_number: '7804125800082', branch_id: null, branches: null, created_at: '2024-01-10T07:00:00Z', last_active_at: null, employer_verified: false, credit_limit_override: null },
  { id: 'uid-d4e5f6g7h8i9j0k1', full_name: 'Nomsa Zulu',          role: 'borrower',    email: 'nomsa.zulu@mweb.co.za',       identity_number: '0001014800085', branch_id: 1, branches: { id: 1, name: 'Johannesburg' }, created_at: '2025-01-05T11:00:00Z', last_active_at: '2025-07-25T08:30:00Z', employer_verified: true,  credit_limit_override: null },
  { id: 'uid-e5f6g7h8i9j0k1l2', full_name: 'James Mokoena',       role: 'borrower',    email: 'james.mok@telkomsa.net',      identity_number: '8812185800081', branch_id: 3, branches: { id: 3, name: 'Durban' },       created_at: '2024-08-18T09:45:00Z', last_active_at: '2025-06-30T16:00:00Z', employer_verified: false, credit_limit_override: 15000 },
  { id: 'uid-f6g7h8i9j0k1l2m3', full_name: 'Ayanda Sithole',      role: 'borrower',    email: 'ayanda.s@vodamail.co.za',     identity_number: '9503055800087', branch_id: 2, branches: { id: 2, name: 'Cape Town' },    created_at: '2025-02-14T09:00:00Z', last_active_at: null, employer_verified: false, credit_limit_override: null },
  { id: 'uid-g7h8i9j0k1l2m3n4', full_name: 'Kurt Administrator',  role: 'super_admin', email: 'kurt@algolend.co.za',         identity_number: null,            branch_id: null, branches: null, created_at: '2023-12-01T08:00:00Z', last_active_at: '2026-07-28T09:00:00Z', employer_verified: false, credit_limit_override: null },
  { id: 'uid-h8i9j0k1l2m3n4o5', full_name: 'Zanele Mthembu',      role: 'admin',       email: 'zanele@algolend.co.za',       identity_number: null,            branch_id: 1, branches: { id: 1, name: 'Johannesburg' }, created_at: '2024-02-14T08:00:00Z', last_active_at: '2025-07-27T15:30:00Z', employer_verified: false, credit_limit_override: null },
  { id: 'uid-i9j0k1l2m3n4o5p6', full_name: 'Ruan Botha',          role: 'base_admin',  email: 'ruan.botha@algolend.co.za',   identity_number: null,            branch_id: 2, branches: { id: 2, name: 'Cape Town' },    created_at: '2024-06-10T08:00:00Z', last_active_at: '2025-07-26T10:00:00Z', employer_verified: false, credit_limit_override: null },
  { id: 'uid-j0k1l2m3n4o5p6q7', full_name: 'Lerato Dube',         role: 'base_admin',  email: 'lerato.dube@algolend.co.za',  identity_number: null,            branch_id: 3, branches: { id: 3, name: 'Durban' },       created_at: '2024-09-01T08:00:00Z', last_active_at: '2025-07-25T11:00:00Z', employer_verified: false, credit_limit_override: null },
];

const DEMO_BRANCHES: Branch[] = [
  { id: 1, name: 'Johannesburg' },
  { id: 2, name: 'Cape Town' },
  { id: 3, name: 'Durban' },
];

// Demo client financials (keyed by user id for detail view)
const DEMO_CLIENT_DETAIL = {
  financials: { monthly_income: 22000, monthly_expenses: 14500 },
  loans: [
    { id: 'app-001', created_at: '2024-06-01T08:00:00Z', amount: 15000, status: 'DISBURSED' },
    { id: 'app-002', created_at: '2025-01-15T09:00:00Z', amount: 8500,  status: 'STARTED'  },
  ],
  documents: [
    { file_name: 'payslip_june2025.pdf', file_type: 'PDF', file_path: '#' },
    { file_name: 'bank_statement.pdf',   file_type: 'PDF', file_path: '#' },
    { file_name: 'id_copy.jpg',          file_type: 'IMG', file_path: '#' },
  ],
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Branch      { id: number; name: string }
interface AdminUser   {
  id: string;
  full_name?:              string | null;
  role?:                   string | null;
  email?:                  string | null;
  identity_number?:        string | null;
  branch_id?:              number | null;
  branches?:               Branch | null;
  created_at?:             string | null;
  last_active_at?:         string | null;
  employer_verified?:      boolean;
  credit_limit_override?:  number | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STAFF_ROLES = ['admin', 'super_admin', 'base_admin'];
const isStaff     = (role?: string | null) => STAFF_ROLES.includes(role ?? '');

const getRoleLabel = (role?: string | null) => {
  const map: Record<string, string> = {
    super_admin: 'SUPER ADMIN',
    admin:       'BRANCH MANAGER',
    base_admin:  'LOAN OFFICER',
  };
  return map[role ?? ''] ?? 'CLIENT';
};

const ROLE_META: Record<string, { label: string; icon: string; colorClass: string; desc: string }> = {
  super_admin: { label: 'Super Admin',    icon: 'shield',           colorClass: 'bg-purple-100 text-purple-700',  desc: 'Full platform access across all branches' },
  admin:       { label: 'Branch Manager', icon: 'manage_accounts',  colorClass: 'bg-blue-100 text-blue-700',      desc: 'Manages staff and operations for their branch' },
  base_admin:  { label: 'Loan Officer',   icon: 'assignment_ind',   colorClass: 'bg-green-100 text-green-700',    desc: 'Processes and approves loan applications' },
  client:      { label: 'Client',         icon: 'person',           colorClass: 'bg-gray-100 text-gray-600',      desc: 'Loan applicant' },
};

const PERMS: Record<string, string[]> = {
  super_admin: ['View all branches', 'Manage users & roles', 'Approve / decline loans', 'Transfer branches', 'Access SACRRA tools', 'View all financials', 'Manage system settings'],
  admin:       ['View branch clients', 'Manage loan officers', 'Approve / decline loans', 'Transfer branch clients', 'View branch financials'],
  base_admin:  ['View assigned clients', 'Process loan applications', 'Upload documents', 'View own branch data'],
};

const STATUS_DISPLAY_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  DISBURSED:  { label: 'Disbursed',   bg: '#d1fae5', color: '#10b981' },
  DECLINED:   { label: 'Declined',    bg: '#fee2e2', color: '#ef4444' },
  STARTED:    { label: 'In Progress', bg: '#dbeafe', color: '#3b82f6' },
  SUBMITTED:  { label: 'Submitted',   bg: '#dbeafe', color: '#3b82f6' },
  APPROVED:   { label: 'Approved',    bg: '#d1fae5', color: '#10b981' },
  IN_ARREARS: { label: 'In Arrears',  bg: '#fee2e2', color: '#ef4444' },
  IN_DEFAULT: { label: 'In Default',  bg: '#fee2e2', color: '#dc2626' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(p => (p[0] ?? '').toUpperCase()).join('') || '?';
}

function validateSAID(id?: string | null): boolean | null {
  if (!id) return null;
  if (id.length !== 13 || !/^\d{13}$/.test(id)) return false;
  let odd = 0, even = 0;
  for (let i = 0; i < 12; i++) {
    const d = parseInt(id[i]);
    if (i % 2 === 0) odd += d;
    else { const x = d * 2; even += x > 9 ? x - 9 : x; }
  }
  return ((10 - ((odd + even) % 10)) % 10) === parseInt(id[12]);
}

const fmtDate = (s?: string | null) =>
  s ? new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(s)) : '—';

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

// ── Small sub-components ──────────────────────────────────────────────────────

function UserAvatar({ name, size = 40 }: { name?: string | null; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 10, flexShrink: 0,
      background: 'rgba(109,40,217,0.08)', color: '#6D28D9',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: size * 0.32,
    }}>
      {getInitials(name)}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_DISPLAY_BADGE[status] ?? {
    label: status.replace(/_/g, ' '),
    bg: '#f3f4f6', color: '#6b7280',
  };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// ── Invite Staff Modal ────────────────────────────────────────────────────────

function InviteModal({ branches, onClose }: { branches: Branch[]; onClose: () => void }) {
  const [form, setForm] = useState({ full_name: '', email: '', role: 'base_admin', branch_id: '' });
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess(''); setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/invite-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ ...form, branch_id: form.branch_id ? parseInt(form.branch_id) : null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to send invite');
      setSuccess(`Invite sent to ${form.email}. They will receive an email to set their password.`);
      setTimeout(onClose, 2500);
    } catch (err: any) {
      setError(err.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 20, boxShadow: '0 25px 60px rgba(0,0,0,0.25)', width: '100%', maxWidth: 440, padding: 24 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#111827', margin: 0 }}>Invite Staff Member</h3>
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Creates a login account and profile immediately.</p>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#6b7280' }}>close</span>
          </button>
        </div>

        {error   && <div style={{ marginBottom: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, fontSize: 13, color: '#dc2626', fontWeight: 600 }}>{error}</div>}
        {success && <div style={{ marginBottom: 12, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, fontSize: 13, color: '#16a34a', fontWeight: 600 }}>{success}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Full Name *</label>
            <input required type="text" value={form.full_name} placeholder="Jane Smith"
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 12, padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Email Address *</label>
            <input required type="email" value={form.email} placeholder="jane@company.co.za"
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 12, padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Role *</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 12, padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', background: '#fff', outline: 'none' }}>
                <option value="base_admin">Loan Officer</option>
                <option value="admin">Branch Manager</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Branch</label>
              <select value={form.branch_id} onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}
                style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 12, padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', background: '#fff', outline: 'none' }}>
                <option value="">No branch</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, padding: 12, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#3b82f6', flexShrink: 0 }}>mail</span>
            <p style={{ fontSize: 12, color: '#1d4ed8', margin: 0, lineHeight: 1.4 }}>An email invite will be sent. The staff member clicks the link to set their own password.</p>
          </div>

          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, border: '1px solid #e5e7eb', background: 'transparent', color: '#374151', fontWeight: 600, fontSize: 13, padding: '10px 0', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button type="submit" disabled={busy}
              style={{ flex: 1, background: '#6D28D9', color: '#fff', fontWeight: 700, fontSize: 13, padding: '10px 0', borderRadius: 12, border: 'none', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1, fontFamily: 'inherit' }}>
              {busy ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Branch Transfer Modal ─────────────────────────────────────────────────────

function BranchModal({
  user, branches, onClose, onTransferred,
}: {
  user: AdminUser;
  branches: Branch[];
  onClose: () => void;
  onTransferred: () => void;
}) {
  const [selected, setSelected] = useState(user.branch_id ? String(user.branch_id) : 'online');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setBusy(true); setError('');
    try {
      const newBranchId = (selected === 'online' || !selected) ? null : parseInt(selected);
      const { error: e1 } = await supabase.from('profiles').update({ branch_id: newBranchId }).eq('id', user.id);
      if (e1) throw e1;
      await supabase.from('loan_applications').update({ branch_id: newBranchId }).eq('user_id', user.id);
      onTransferred();
    } catch (err: any) {
      setError(err.message ?? 'Transfer failed');
      setBusy(false);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 20px 50px rgba(0,0,0,0.2)', width: '100%', maxWidth: 400, padding: 24 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>Transfer User Branch</h3>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 16px' }}>
          Select the new branch for <strong style={{ color: '#111827' }}>{user.full_name}</strong>.
        </p>
        {error && <p style={{ fontSize: 12, color: '#dc2626', marginBottom: 10 }}>{error}</p>}
        <select value={selected} onChange={e => setSelected(e.target.value)}
          style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 10, padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', marginBottom: 20, background: '#fff', outline: 'none' }}>
          <option value="online">Online / Unassigned</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose}
            style={{ padding: '9px 18px', border: '1px solid #e5e7eb', background: 'transparent', color: '#374151', fontWeight: 600, fontSize: 13, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={busy}
            style={{ padding: '9px 18px', background: '#6D28D9', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1, fontFamily: 'inherit' }}>
            {busy ? 'Moving…' : 'Confirm Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Staff Detail ──────────────────────────────────────────────────────────────

function StaffDetail({ user, branches, onBranchTransfer }: { user: AdminUser; branches: Branch[]; onBranchTransfer: () => void }) {
  const role       = (user.role ?? 'client').toLowerCase();
  const meta       = ROLE_META[role] ?? ROLE_META.client;
  const initials   = getInitials(user.full_name);
  const email      = user.email ?? '—';
  const phone      = '—';
  const joined     = fmtDate(user.created_at);
  const branchName = user.branches?.name ?? null;
  const perms      = PERMS[role] ?? [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 20, paddingBottom: 40 }}>
      {/* Left: Identity card */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, gridColumn: 'span 4' }}>
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <div style={{ height: 80, background: 'linear-gradient(135deg,#6D28D9,#4c1d95)', position: 'relative' }}>
            <div style={{ position: 'absolute', bottom: -28, left: 24, width: 56, height: 56, borderRadius: 14, background: '#fff', border: '4px solid #fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, color: '#6D28D9' }}>
              {initials}
            </div>
          </div>
          <div style={{ paddingTop: 40, paddingBottom: 20, paddingLeft: 24, paddingRight: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: '#111827', margin: '0 0 6px' }}>{user.full_name ?? '—'}</h2>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${meta.colorClass}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{meta.icon}</span>
              {meta.label}
            </span>
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>{meta.desc}</p>
          </div>
        </div>

        {/* Contact */}
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', padding: '20px 24px' }}>
          <p style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', marginBottom: 12 }}>Contact</p>
          {[
            { icon: 'mail',           val: email },
            { icon: 'phone',          val: phone },
            { icon: 'calendar_today', val: `Joined ${joined}` },
          ].map(row => (
            <div key={row.icon} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#d1d5db' }}>{row.icon}</span>
              <span style={{ fontSize: 13, color: '#374151' }}>{row.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Role + Branch + Permissions */}
      <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Branch assignment */}
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', padding: 24 }}>
          <p style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', marginBottom: 16 }}>Branch Assignment</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(109,40,217,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ color: '#6D28D9' }}>location_city</span>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 16, fontWeight: 900, color: '#111827', margin: 0 }}>{branchName ?? 'Unassigned'}</p>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>{branchName ? 'Assigned branch' : 'No branch assigned — online / unassigned'}</p>
            </div>
            <button onClick={onBranchTransfer}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#6D28D9', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>swap_horiz</span>Transfer
            </button>
          </div>
        </div>

        {/* Access level */}
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', padding: 24 }}>
          <p style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', marginBottom: 16 }}>Access Level</p>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(109,40,217,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ color: '#6D28D9' }}>{meta.icon}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontWeight: 900, fontSize: 14, color: '#111827' }}>{meta.label}</span>
                <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 }} className={meta.colorClass}>
                  {role.toUpperCase()}
                </span>
              </div>
              {perms.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {perms.map(perm => (
                    <div key={perm} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151' }}>
                      <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: 14 }}>check_circle</span>
                      {perm}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* System details (collapsible) */}
        <details style={{ background: '#fff', borderRadius: 20, border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <summary style={{ padding: '16px 24px', cursor: 'pointer', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', userSelect: 'none' }}>
            System Details
          </summary>
          <div style={{ padding: '0 24px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
            <div>
              <p style={{ color: '#94a3b8', margin: '0 0 2px' }}>User UUID</p>
              <p style={{ fontFamily: 'monospace', color: '#374151', wordBreak: 'break-all', margin: 0 }}>{user.id}</p>
            </div>
            <div>
              <p style={{ color: '#94a3b8', margin: '0 0 2px' }}>ID Number</p>
              <p style={{ fontFamily: 'monospace', color: '#374151', margin: 0 }}>{user.identity_number ?? '—'}</p>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}

// ── Client Detail ─────────────────────────────────────────────────────────────

function ClientDetail({ user, onBranchTransfer }: { user: AdminUser; onBranchTransfer: () => void }) {
  const { data: detailData } = useQuery({
    queryKey: ['user-detail', user.id],
    queryFn: async () => {
      try {
        const [loansRes, docsRes, finsRes] = await Promise.all([
          supabase.from('loan_applications').select('id, created_at, amount, status').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('document_uploads').select('file_name, file_type, file_path').eq('user_id', user.id),
          supabase.from('financial_profiles').select('monthly_income, monthly_expenses').eq('user_id', user.id).maybeSingle(),
        ]);
        const hasData = loansRes.data?.length || docsRes.data?.length || finsRes.data;
        if (hasData) {
          return {
            financials: finsRes.data ?? { monthly_income: 0, monthly_expenses: 0 },
            loans: loansRes.data ?? [],
            documents: docsRes.data ?? [],
          };
        }
      } catch {/* fall through */}
      return DEMO_CLIENT_DETAIL;
    },
    staleTime: 60_000,
  });

  const detail    = detailData ?? DEMO_CLIENT_DETAIL;
  const fins      = detail.financials as { monthly_income: number; monthly_expenses: number };
  const loans     = detail.loans as { id: string; created_at: string; amount: number; status: string }[];
  const documents = detail.documents as { file_name: string; file_type: string; file_path: string }[];
  const initials  = getInitials(user.full_name);
  const idValid   = validateSAID(user.identity_number);
  const activeDebt = loans
    .filter(l => ['DISBURSED', 'ACTIVE', 'IN_ARREARS', 'IN_DEFAULT'].includes(l.status))
    .reduce((s, l) => s + Number(l.amount), 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, paddingBottom: 40 }}>
      {/* Left: Profile card */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <div style={{ height: 80, background: 'linear-gradient(135deg,#6D28D9,#4c1d95)', position: 'relative' }}>
            <div style={{ position: 'absolute', bottom: -28, left: 24, width: 56, height: 56, borderRadius: 14, background: '#fff', border: '4px solid #fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, color: '#6D28D9' }}>
              {initials}
            </div>
          </div>
          <div style={{ paddingTop: 40, paddingBottom: 20, paddingLeft: 24, paddingRight: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: '#111827', margin: '0 0 4px' }}>{user.full_name ?? '—'}</h2>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 12px', fontFamily: 'monospace' }}>{user.identity_number ?? 'No ID on file'}</p>
            {idValid !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: idValid ? '#059669' : '#dc2626' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: idValid ? '#10b981' : '#ef4444', display: 'inline-block' }} />
                SA ID {idValid ? 'Valid' : 'Invalid'}
              </div>
            )}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', padding: '20px 24px' }}>
          <p style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', marginBottom: 12 }}>Contact</p>
          {[
            { icon: 'mail',           val: user.email ?? '—' },
            { icon: 'location_city',  val: user.branches?.name ?? 'Online / Unassigned' },
            { icon: 'calendar_today', val: `Joined ${fmtDate(user.created_at)}` },
          ].map(row => (
            <div key={row.icon} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#d1d5db' }}>{row.icon}</span>
              <span style={{ fontSize: 13, color: '#374151' }}>{row.val}</span>
            </div>
          ))}
          <button onClick={onBranchTransfer}
            style={{ marginTop: 8, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 10, color: '#374151', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>swap_horiz</span>Transfer Branch
          </button>
        </div>
      </div>

      {/* Right: Financial + loans + docs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Financial snapshot */}
        <div className="glass-card" style={{ borderRadius: 20, padding: 24 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94a3b8', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>account_balance_wallet</span>
            Financial Snapshot
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Gross Income',  val: fins.monthly_income  },
              { label: 'Expenses',      val: fins.monthly_expenses },
            ].map(({ label, val }) => (
              <div key={label} style={{ background: 'rgba(241,245,249,0.7)', borderRadius: 12, padding: 12 }}>
                <p style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>{label}</p>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#111827', margin: 0 }}>{fmtCurrency(val)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'Total Loans',   val: loans.length, color: '#6D28D9' },
            { label: 'Active Debt',   val: fmtCurrency(activeDebt), color: '#6D28D9' },
            { label: 'Documents',     val: documents.length, color: '#3b82f6' },
          ].map(c => (
            <div key={c.label} className="glass-card" style={{ borderRadius: 16, padding: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94a3b8', margin: '0 0 4px' }}>{c.label}</p>
              <p style={{ fontSize: 22, fontWeight: 900, color: c.color, margin: 0 }}>{c.val}</p>
            </div>
          ))}
        </div>

        {/* Application history */}
        <div className="glass-card" style={{ borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#111827', margin: 0 }}>Application History</h3>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94a3b8' }}>Most recent first</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'rgba(248,250,252,0.8)' }}>
                <tr>
                  {['ID', 'Date', 'Amount', 'Status', 'Action'].map((h, i) => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94a3b8', textAlign: i === 4 ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loans.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '40px 16px', textAlign: 'center', fontSize: 12, color: '#d1d5db', fontWeight: 700 }}>No applications found.</td></tr>
                ) : loans.map(l => (
                  <tr key={l.id} style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: 10, fontWeight: 900, color: '#94a3b8' }}>#{l.id.substring(0, 8).toUpperCase()}</td>
                    <td style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#374151' }}>{fmtDate(l.created_at)}</td>
                    <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 900, color: '#111827' }}>{fmtCurrency(Number(l.amount))}</td>
                    <td style={{ padding: '14px 16px' }}><StatusBadge status={l.status} /></td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <a href={`/applications/${l.id}`} style={{ color: '#94a3b8', display: 'inline-flex' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Documents */}
        <div className="glass-card" style={{ borderRadius: 20, padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: '#111827', margin: '0 0 16px' }}>Uploaded Documents</h3>
          {documents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0', fontSize: 11, fontWeight: 800, color: '#d1d5db', border: '2px dashed #f1f5f9', borderRadius: 20 }}>No documents found</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              {documents.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'rgba(248,250,252,0.7)', borderRadius: 16, border: '1px solid #f1f5f9' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fff', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6D28D9', flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>description</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 10, fontWeight: 900, color: '#111827', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.file_name}</p>
                    <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', margin: 0 }}>{d.file_type}</p>
                  </div>
                  <a href={d.file_path} target="_blank" rel="noreferrer" style={{ color: '#d1d5db', flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function UsersPage({ embedded = false, title = 'Users' }: { embedded?: boolean; title?: string }) {
  const qc = useQueryClient();

  // View state
  const [view,         setView]         = useState<'list' | 'detail'>('list');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  // Filter state
  const [userTab,      setUserTab]      = useState<'clients' | 'staff'>('clients');
  const [branchFilter, setBranchFilter] = useState('all');
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);

  // Modal state
  const [showInvite,       setShowInvite]       = useState(false);
  const [showBranchModal,  setShowBranchModal]  = useState(false);

  const PER_PAGE = 20;

  // ── Query ──────────────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      try {
        const result = await fetchUsers();
        if (result.data && result.data.length > 0) return result;
      } catch {/* fall through */}
      return { data: DEMO_USERS, error: null };
    },
    staleTime: 60_000,
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => updateUserRole(userId, role),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const users: AdminUser[] = (data?.data ?? []) as AdminUser[];

  // Extract unique branches from users
  const branches: Branch[] = useMemo(() => {
    const seen = new Set<number>();
    const result: Branch[] = [];
    users.forEach(u => {
      if (u.branches && u.branch_id != null && !seen.has(u.branch_id)) {
        seen.add(u.branch_id);
        result.push(u.branches);
      }
    });
    return result.length > 0 ? result : DEMO_BRANCHES;
  }, [users]);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const staff    = users.filter(u => isStaff(u.role)).length;
    const clients  = users.filter(u => !isStaff(u.role)).length;
    const inactive = users.filter(u => {
      if (isStaff(u.role)) return false;
      return !u.last_active_at && (Date.now() - new Date(u.created_at ?? 0).getTime()) > 90 * 86_400_000;
    }).length;
    return { total: users.length, staff, clients, inactive };
  }, [users]);

  // ── Filter ─────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return users.filter(u => {
      const tabMatch    = userTab === 'clients' ? !isStaff(u.role) : isStaff(u.role);
      const searchMatch = !term ||
        (u.full_name ?? '').toLowerCase().includes(term) ||
        (u.email ?? '').toLowerCase().includes(term) ||
        (u.identity_number ?? '').includes(term) ||
        (u.id ?? '').toLowerCase().includes(term);
      const branchMatch = branchFilter === 'all' ||
        (branchFilter === 'online' ? !u.branch_id : String(u.branch_id) === branchFilter);
      return tabMatch && searchMatch && branchMatch;
    });
  }, [users, userTab, search, branchFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function switchTab(tab: 'clients' | 'staff') { setUserTab(tab); setPage(1); }
  function handleSearch(val: string) { setSearch(val); setPage(1); }
  function handleBranch(val: string) { setBranchFilter(val); setPage(1); }
  function openDetail(u: AdminUser) { setSelectedUser(u); setView('detail'); }
  function closeDetail() { setSelectedUser(null); setView('list'); }
  function handleTransferred() {
    setShowBranchModal(false);
    qc.invalidateQueries({ queryKey: ['admin-users'] });
    closeDetail();
  }

  // ── Detail view ────────────────────────────────────────────────────────────

  if (view === 'detail' && selectedUser) {
    return (
      <div style={{ animation: 'fadeIn 0.25s ease' }}>
        {/* Back + actions bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <button
            onClick={closeDetail}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}
          >
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fff', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
            </div>
            Back to Directory
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowBranchModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, color: '#374151', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>swap_horiz</span>Transfer Branch
            </button>
          </div>
        </div>

        {isStaff(selectedUser.role) ? (
          <StaffDetail  user={selectedUser} branches={branches} onBranchTransfer={() => setShowBranchModal(true)} />
        ) : (
          <ClientDetail user={selectedUser} onBranchTransfer={() => setShowBranchModal(true)} />
        )}

        {showBranchModal && (
          <BranchModal
            user={selectedUser}
            branches={branches}
            onClose={() => setShowBranchModal(false)}
            onTransferred={handleTransferred}
          />
        )}
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: 'fadeIn 0.3s ease' }}>

      {/* Header */}
      {!embedded && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>{title}</h1>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginTop: 4 }}>Clients · Staff · Admins</p>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: '#6D28D9', color: '#fff', borderRadius: 16, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(109,40,217,0.25)', transition: 'transform 0.15s' }}
            onMouseOver={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
            onMouseOut={e  => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span>
            Invite Staff
          </button>
        </div>
      )}

      {/* KPI stat cards */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Users',      value: isLoading ? '—' : stats.total,    icon: 'group',              color: '#6D28D9' },
          { label: 'Staff & Admins',   value: isLoading ? '—' : stats.staff,    icon: 'admin_panel_settings',color: '#3b82f6' },
          { label: 'Clients',          value: isLoading ? '—' : stats.clients,  icon: 'person',             color: '#10b981' },
          { label: 'Inactive (90d+)',  value: isLoading ? '—' : stats.inactive, icon: 'person_off',         color: '#f59e0b' },
        ].map((c, i) => (
          <div key={c.label} className={`dash-kpi-card animate-fade-in-up delay-${i * 100 + 100}`}>
            <div className="dash-kpi-corner" />
            <div>
              <span className="material-symbols-outlined" style={{ fontSize: 30, color: c.color }}>{c.icon}</span>
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 4 }}>{c.label}</p>
              <h3 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--color-text)', lineHeight: 1, letterSpacing: '-0.02em', margin: 0 }}>{c.value}</h3>
            </div>
          </div>
        ))}
      </section>

      {/* Tabs: Clients | Staff & Admins */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f1f5f9', borderRadius: 16, padding: 4, width: 'fit-content' }}>
        {([['clients', 'Clients'], ['staff', 'Staff & Admins']] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => switchTab(key)}
            style={{
              padding: '8px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              background: userTab === key ? '#fff' : 'transparent',
              color: userTab === key ? '#6D28D9' : 'var(--color-text-muted)',
              boxShadow: userTab === key ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <select
          value={branchFilter}
          onChange={e => handleBranch(e.target.value)}
          style={{ border: '1px solid #e5e7eb', background: '#fff', color: '#374151', padding: '8px 12px', borderRadius: 12, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', outline: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        >
          <option value="all">All Branches</option>
          <option value="online">Online / Unassigned</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 200 }}>
          <input
            type="text"
            placeholder="Search name, email, ID number…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: 36, paddingRight: 14, paddingTop: 8, paddingBottom: 8, border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 13, fontWeight: 500, fontFamily: 'inherit', outline: 'none', background: '#fff', boxSizing: 'border-box', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
          />
          <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#94a3b8', pointerEvents: 'none' }}>search</span>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ borderRadius: 20, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', flex: 1 }}>
          {isLoading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />Loading directory…
            </div>
          ) : (
            <table style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#fff', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 0 rgba(0,0,0,0.05)' }}>
                <tr>
                  {[
                    { label: 'Client Identity', align: 'left' },
                    { label: 'Match Key',        align: 'left' },
                    { label: 'Branch',           align: 'left' },
                    { label: 'Compliance',       align: 'left' },
                    { label: 'Action',           align: 'right' },
                  ].map(h => (
                    <th key={h.label} style={{ padding: '18px 24px', textAlign: h.align as 'left' | 'right', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ background: '#fff' }}>
                {paginated.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 64, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#d1d5db' }}>No results matching your query.</td></tr>
                ) : paginated.map(u => {
                  const branchName = u.branches?.name ?? 'Online';
                  const isClient   = !isStaff(u.role);
                  const idValid    = isClient ? validateSAID(u.identity_number) : null;

                  return (
                    <tr
                      key={u.id}
                      onClick={() => openDetail(u)}
                      style={{ borderBottom: '1px solid rgba(0,0,0,0.03)', cursor: 'pointer', transition: 'background 0.12s' }}
                      onMouseOver={e => (e.currentTarget.style.background = 'rgba(248,250,252,0.9)')}
                      onMouseOut={e  => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Client Identity */}
                      <td style={{ padding: '22px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <UserAvatar name={u.full_name} />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{u.full_name ?? 'Unknown'}</div>
                            <div style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginTop: 2 }}>{getRoleLabel(u.role)}</div>
                          </div>
                        </div>
                      </td>

                      {/* Match Key */}
                      <td style={{ padding: '22px 24px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 900, color: '#64748b', letterSpacing: '-0.02em' }}>
                          {u.id.substring(0, 13).toUpperCase()}
                        </span>
                      </td>

                      {/* Branch */}
                      <td style={{ padding: '22px 24px' }}>
                        <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em', background: '#f1f5f9', color: '#64748b' }}>
                          {branchName}
                        </span>
                      </td>

                      {/* Compliance */}
                      <td style={{ padding: '22px 24px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {idValid !== null && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: idValid ? '#10b981' : '#ef4444', display: 'inline-block', flexShrink: 0 }} />
                              <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em', color: idValid ? '#059669' : '#dc2626' }}>
                                ID {idValid ? 'Valid' : 'Invalid'}
                              </span>
                            </div>
                          )}
                          {u.employer_verified && (
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>verified</span>
                              Employer verified
                            </div>
                          )}
                          {u.credit_limit_override != null && (
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#d97706' }}>
                              Cap: {fmtCurrency(u.credit_limit_override)}
                            </div>
                          )}
                          {u.last_active_at && (
                            <div style={{ fontSize: 9, color: '#94a3b8' }}>
                              Active: {new Date(u.last_active_at).toLocaleDateString('en-ZA')}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '22px 24px', textAlign: 'right' }}>
                        <button style={{ width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_right</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Footer: count + pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, padding: '0 4px', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94a3b8' }}>
          Registry <span style={{ color: '#475569' }}>{filtered.length}</span>
        </div>
        {!isLoading && totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Page {safePage} of {totalPages}
            </span>
            <button
              disabled={safePage <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: safePage <= 1 ? 'not-allowed' : 'pointer', opacity: safePage <= 1 ? 0.3 : 1, fontFamily: 'inherit', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              Prev
            </button>
            <button
              disabled={safePage >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: safePage >= totalPages ? 'not-allowed' : 'pointer', opacity: safePage >= totalPages ? 0.3 : 1, fontFamily: 'inherit', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              Next
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {showInvite && <InviteModal branches={branches} onClose={() => setShowInvite(false)} />}
    </div>
  );
}
