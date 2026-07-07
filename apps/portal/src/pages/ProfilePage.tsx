import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';

const SHADOW_SOFT = '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)';
const RADIUS = 24;

type TabName = 'profile' | 'financial' | 'security' | 'declarations';

const TABS: { id: TabName; icon: string; label: string }[] = [
  { id: 'profile',      icon: 'fa-user-pen',        label: 'My Profile' },
  { id: 'financial',    icon: 'fa-money-bill-wave', label: 'Financial Info' },
  { id: 'security',     icon: 'fa-lock',            label: 'Security' },
  { id: 'declarations', icon: 'fa-clipboard-list',  label: 'Declarations' },
];

// ── types ─────────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  contact_number: string | null;
  identity_number: string | null;
  gender: string | null;
  date_of_birth: string | null;
  address: string | null;
  postal_code: string | null;
  suburb_area: string | null;
  cell_tel_no: string | null;
  avatar_url: string | null;
  role: string | null;
  created_at: string;
}

interface FinancialProfile {
  monthly_income: number;
  monthly_expenses: number;
  created_at: string;
  updated_at: string;
  parsed_data: {
    income: { salary: number; other_monthly_earnings: number };
    expenses: { housing_rent: number; school: number; maintenance: number; petrol: number; groceries: number; other: number };
  } | null;
}

interface Declarations {
  historically_disadvantaged: boolean | null;
  accepted_std_conditions: boolean | null;
  home_ownership: string | null;
  marital_status: string | null;
  highest_qualification: string | null;
  referral_provided: boolean | null;
  referral_name: string | null;
  referral_phone: string | null;
}

// ── data ──────────────────────────────────────────────────────────────────────

async function fetchProfileData() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const uid = session.user.id;

  const [{ data: profile, error }, { data: financial }, { data: declarations }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', uid).single(),
    supabase.from('financial_profiles').select('*').eq('user_id', uid).maybeSingle(),
    supabase.from('declarations').select('*').eq('user_id', uid).maybeSingle(),
  ]);
  if (error) throw error;

  return {
    profile: profile as Profile,
    financial: (financial ?? null) as FinancialProfile | null,
    declarations: (declarations ?? null) as Declarations | null,
  };
}

// ── shared bits ───────────────────────────────────────────────────────────────

const fieldStyle = { width: '100%', border: '2px solid #e5e7eb', borderRadius: 12, padding: '10px 14px', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, background: '#fff', color: '#1C1C1E' };
const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, color: '#6b7280', marginBottom: 6 };

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', borderRadius: RADIUS, padding: 28, boxShadow: SHADOW_SOFT, ...style }}>
      {children}
    </div>
  );
}

function SaveButton({ saving, children }: { saving: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={saving}
      style={{ padding: '13px 28px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(91,33,182,0.35)' }}
    >
      {saving ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }} />Saving…</> : children}
    </button>
  );
}

function Notice({ notice }: { notice: { ok: boolean; text: string } | null }) {
  if (!notice) return null;
  return (
    <div style={{
      background: notice.ok ? '#f0fdf4' : '#fff1f2',
      border: `1px solid ${notice.ok ? '#bbf7d0' : '#fecdd3'}`,
      borderRadius: 12, padding: '12px 16px', fontSize: 13, fontWeight: 600,
      color: notice.ok ? '#166534' : '#be123c', marginBottom: 16,
    }}>
      {notice.text}
    </div>
  );
}

function getInitials(name: string) {
  const cleaned = name.trim();
  if (!cleaned) return 'U';
  return cleaned.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || 'U';
}

// ── Profile tab ───────────────────────────────────────────────────────────────

function ProfileTab({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const [form, setForm] = useState({
    first_name:      profile.first_name ?? '',
    last_name:       profile.last_name ?? '',
    full_name:       profile.full_name ?? '',
    contact_number:  profile.contact_number ?? '',
    identity_number: profile.identity_number ?? '',
    gender:          (profile.gender ?? '').toUpperCase(),
    date_of_birth:   profile.date_of_birth ? String(profile.date_of_birth).substring(0, 10) : '',
    address:         profile.address ?? '',
    postal_code:     profile.postal_code ?? '',
    suburb_area:     profile.suburb_area ?? '',
    cell_tel_no:     profile.cell_tel_no ?? profile.contact_number ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) { setNotice({ ok: false, text: 'Full name is required' }); return; }
    setSaving(true);
    setNotice(null);
    try {
      const { error } = await supabase.from('profiles').update({
        first_name:      form.first_name.trim() || null,
        last_name:       form.last_name.trim() || null,
        full_name:       form.full_name.trim(),
        contact_number:  form.contact_number.trim(),
        identity_number: form.identity_number.trim() || null,
        gender:          form.gender || null,
        date_of_birth:   form.date_of_birth || null,
        address:         form.address.trim() || null,
        postal_code:     form.postal_code.trim() || null,
        suburb_area:     form.suburb_area.trim() || null,
        cell_tel_no:     form.cell_tel_no.trim() || null,
        updated_at:      new Date().toISOString(),
      }).eq('id', profile.id);
      if (error) throw error;
      setNotice({ ok: true, text: '✅ Profile updated successfully!' });
      onSaved();
    } catch (err) {
      setNotice({ ok: false, text: `❌ ${err instanceof Error ? err.message : 'Update failed'}` });
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file: File) {
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${profile.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { cacheControl: '3600', upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', profile.id);
      if (dbErr) throw dbErr;
      await supabase.auth.updateUser({ data: { avatar_url: data.publicUrl } });
      setNotice({ ok: true, text: '✅ Avatar updated successfully!' });
      onSaved();
    } catch (err) {
      setNotice({ ok: false, text: `❌ ${err instanceof Error ? err.message : 'Avatar upload failed'}` });
    } finally {
      setUploadingAvatar(false);
    }
  }

  const initials = getInitials(form.full_name || 'User');

  return (
    <Card>
      <Notice notice={notice} />
      <form onSubmit={save}>
        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            style={{ position: 'relative', width: 88, height: 88, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer', overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))' }}
            title="Change avatar"
          >
            {profile.avatar_url ? (
              <img src={`${profile.avatar_url}?t=${Date.now()}`} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ color: '#fff', fontSize: 30, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>{initials}</span>
            )}
            <span style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: uploadingAvatar ? 1 : 0, transition: 'opacity 0.2s', fontSize: 18 }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
              onMouseLeave={e => { if (!uploadingAvatar) e.currentTarget.style.opacity = '0'; }}
            >
              <i className={`fas ${uploadingAvatar ? 'fa-spinner fa-spin' : 'fa-camera'}`} />
            </span>
          </button>
          <input
            ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/gif" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ''; }}
          />
          <div>
            <h4 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: '0 0 2px' }}>{form.full_name || 'No Name Set'}</h4>
            <p style={{ fontSize: 13, color: '#8E8E93', margin: '0 0 8px' }}>{profile.email || 'No Email'}</p>
            <span style={{ background: '#F3F4F6', color: '#1F2937', fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 20, textTransform: 'capitalize' }}>
              {(profile.role || 'borrower').replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* Fields */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <Field label="First Name"><input type="text" required value={form.first_name} onChange={set('first_name')} placeholder="Enter your first name" style={fieldStyle} /></Field>
          <Field label="Surname"><input type="text" required value={form.last_name} onChange={set('last_name')} placeholder="Enter your surname" style={fieldStyle} /></Field>
          <Field label="Full Name"><input type="text" required value={form.full_name} onChange={set('full_name')} placeholder="Enter your full name" style={fieldStyle} /></Field>
          <Field label="Email Address"><input type="email" disabled value={profile.email ?? ''} style={{ ...fieldStyle, background: '#f3f4f6', color: '#6b7280' }} /></Field>
          <Field label="Contact Number"><input type="text" value={form.contact_number} onChange={set('contact_number')} placeholder="+27 XX XXX XXXX" style={fieldStyle} /></Field>
          <Field label="ID Number"><input type="text" maxLength={20} autoComplete="off" value={form.identity_number} onChange={set('identity_number')} placeholder="Enter your SA ID number" style={fieldStyle} /></Field>
          <Field label="Gender">
            <select value={form.gender} onChange={set('gender')} style={fieldStyle}>
              <option value="">Select gender</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </Field>
          <Field label="Date of Birth"><input type="date" value={form.date_of_birth} onChange={set('date_of_birth')} style={fieldStyle} /></Field>
          <Field label="Street Address"><input type="text" value={form.address} onChange={set('address')} placeholder="Street address" style={fieldStyle} /></Field>
          <Field label="Postal Code"><input type="text" maxLength={4} value={form.postal_code} onChange={set('postal_code')} placeholder="e.g. 0123" style={fieldStyle} /></Field>
          <Field label="Suburb / Area"><input type="text" value={form.suburb_area} onChange={set('suburb_area')} placeholder="Suburb or area" style={fieldStyle} /></Field>
          <Field label="Cell Phone Number"><input type="text" maxLength={10} value={form.cell_tel_no} onChange={set('cell_tel_no')} placeholder="e.g. 0821234567" style={fieldStyle} /></Field>
        </div>

        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#1e40af', margin: '20px 0' }}>
          <i className="fas fa-info-circle" style={{ marginRight: 8 }} />
          Your profile information is securely stored and can be updated at any time.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <SaveButton saving={saving}><i className="fas fa-save" style={{ marginRight: 8 }} />Save Changes</SaveButton>
        </div>
      </form>
    </Card>
  );
}

// ── Financial tab ─────────────────────────────────────────────────────────────

const EXPENSE_FIELDS: { key: string; label: string; icon: string; hint: string; required?: boolean }[] = [
  { key: 'housing_rent', label: 'Housing',     icon: 'fa-house',               hint: 'Rent or bond payment', required: true },
  { key: 'school',       label: 'Education',   icon: 'fa-graduation-cap',      hint: 'School fees, uniforms, books' },
  { key: 'maintenance',  label: 'Maintenance', icon: 'fa-hand-holding-dollar', hint: 'Child or spousal support' },
  { key: 'petrol',       label: 'Transport',   icon: 'fa-gas-pump',            hint: 'Fuel, taxi, car payments' },
  { key: 'groceries',    label: 'Groceries',   icon: 'fa-cart-shopping',       hint: 'Food and household supplies' },
  { key: 'other',        label: 'Other',       icon: 'fa-ellipsis',            hint: 'Insurance, medical, loans, etc.' },
];

function CurrencyInput({ value, onChange, required, placeholder = '0.00' }: {
  value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', border: '2px solid #e5e7eb', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
      <span style={{ padding: '0 0 0 14px', fontSize: 14, fontWeight: 700, color: '#8E8E93' }}>R</span>
      <input
        type="number" step="0.01" min={0} required={required}
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ flex: 1, border: 'none', outline: 'none', padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', background: 'transparent' }}
      />
    </div>
  );
}

function FinancialTab({ userId, financial, onSaved }: { userId: string; financial: FinancialProfile | null; onSaved: () => void }) {
  const parsed = financial?.parsed_data;
  const [income, setIncome] = useState({
    salary: parsed?.income.salary ? String(parsed.income.salary) : '',
    other:  parsed?.income.other_monthly_earnings ? String(parsed.income.other_monthly_earnings) : '',
  });
  const [expenses, setExpenses] = useState<Record<string, string>>({
    housing_rent: parsed?.expenses.housing_rent ? String(parsed.expenses.housing_rent) : '',
    school:       parsed?.expenses.school ? String(parsed.expenses.school) : '',
    maintenance:  parsed?.expenses.maintenance ? String(parsed.expenses.maintenance) : '',
    petrol:       parsed?.expenses.petrol ? String(parsed.expenses.petrol) : '',
    groceries:    parsed?.expenses.groceries ? String(parsed.expenses.groceries) : '',
    other:        parsed?.expenses.other ? String(parsed.expenses.other) : '',
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const totalIncome = (parseFloat(income.salary) || 0) + (parseFloat(income.other) || 0);
  const totalExpenses = Object.values(expenses).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const disposable = totalIncome - totalExpenses;
  const affordabilityThreshold = totalIncome * 0.20;
  const displayAmount = Math.max(disposable, affordabilityThreshold);
  const displayLabel = disposable > affordabilityThreshold ? 'Disposable Income' : 'Affordability Threshold (20%)';

  const fmtR = (n: number) => `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (totalIncome <= 0) { setNotice({ ok: false, text: '❌ Please enter at least some income' }); return; }
    setSaving(true);
    setNotice(null);
    try {
      // DTI from active loans
      let dti: string | null = null;
      const { data: loans } = await supabase.from('loans').select('monthly_payment').eq('user_id', userId).eq('status', 'active');
      if (loans && loans.length > 0) {
        const debt = loans.reduce((s, l) => s + (parseFloat(l.monthly_payment) || 0), 0);
        dti = totalIncome > 0 ? ((debt / totalIncome) * 100).toFixed(2) : null;
      }

      // affordability: try backend, fall back to 20% amortised for 1 month at 20% APR
      let affordabilityRatio: string | null = null;
      let maxLoanAmount: string | null = null;
      try {
        const res = await fetch('/api/calculate-affordability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ monthly_income: totalIncome, affordability_percent: 20, annual_interest_rate: 20, loan_term_months: 1 }),
        });
        if (!res.ok) throw new Error('unavailable');
        const calc = await res.json();
        affordabilityRatio = calc.max_monthly_payment.toFixed(2);
        maxLoanAmount = calc.max_loan_amount.toFixed(2);
      } catch {
        affordabilityRatio = affordabilityThreshold.toFixed(2);
        const monthlyRate = 0.20 / 12;
        maxLoanAmount = (affordabilityThreshold * ((1 - Math.pow(1 + monthlyRate, -1)) / monthlyRate)).toFixed(2);
      }

      const record = {
        user_id: userId,
        monthly_income: totalIncome,
        monthly_expenses: totalExpenses,
        debt_to_income_ratio: dti,
        affordability_ratio: affordabilityRatio,
        max_loan_amount: maxLoanAmount,
        parsed_data: {
          income: { salary: parseFloat(income.salary) || 0, other_monthly_earnings: parseFloat(income.other) || 0 },
          expenses: {
            housing_rent: parseFloat(expenses.housing_rent) || 0,
            school:       parseFloat(expenses.school) || 0,
            maintenance:  parseFloat(expenses.maintenance) || 0,
            petrol:       parseFloat(expenses.petrol) || 0,
            groceries:    parseFloat(expenses.groceries) || 0,
            other:        parseFloat(expenses.other) || 0,
          },
        },
      };

      const { data: existing } = await supabase.from('financial_profiles').select('user_id').eq('user_id', userId).maybeSingle();
      const { error } = existing
        ? await supabase.from('financial_profiles').update(record).eq('user_id', userId)
        : await supabase.from('financial_profiles').insert([record]);
      if (error) throw error;

      setNotice({ ok: true, text: '✅ Financial information saved successfully!' });
      onSaved();
    } catch (err) {
      setNotice({ ok: false, text: `❌ ${err instanceof Error ? err.message : 'Save failed'}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <Notice notice={notice} />
      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Income */}
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-money-bill-trend-up" style={{ color: '#059669' }} />
            </div>
            <div>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Monthly Income</h4>
              <p style={{ fontSize: 12, color: '#8E8E93', margin: 0 }}>All sources of regular income you receive each month</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <div>
              <label style={labelStyle}><i className="fas fa-briefcase" style={{ marginRight: 6 }} />Salary Income *</label>
              <CurrencyInput required value={income.salary} onChange={v => setIncome(i => ({ ...i, salary: v }))} />
              <small style={{ fontSize: 11, color: '#8E8E93', marginTop: 4, display: 'block' }}>Your monthly salary before deductions</small>
            </div>
            <div>
              <label style={labelStyle}><i className="fas fa-coins" style={{ marginRight: 6 }} />Other Earnings</label>
              <CurrencyInput value={income.other} onChange={v => setIncome(i => ({ ...i, other: v }))} />
              <small style={{ fontSize: 11, color: '#8E8E93', marginTop: 4, display: 'block' }}>Freelance, bonuses, rental income, investments</small>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: '14px 18px', marginTop: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}><i className="fas fa-wallet" style={{ marginRight: 8 }} />Total Monthly Income</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>{fmtR(totalIncome)}</span>
          </div>
        </div>

        {/* Expenses */}
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-receipt" style={{ color: '#dc2626' }} />
            </div>
            <div>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Monthly Expenses</h4>
              <p style={{ fontSize: 12, color: '#8E8E93', margin: 0 }}>Your regular monthly costs and financial obligations</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {EXPENSE_FIELDS.map(f => (
              <div key={f.key}>
                <label style={labelStyle}><i className={`fas ${f.icon}`} style={{ marginRight: 6 }} />{f.label}{f.required ? ' *' : ''}</label>
                <CurrencyInput required={f.required} value={expenses[f.key]} onChange={v => setExpenses(x => ({ ...x, [f.key]: v }))} />
                <small style={{ fontSize: 11, color: '#8E8E93', marginTop: 4, display: 'block' }}>{f.hint}</small>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 14, padding: '14px 18px', marginTop: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#9f1239' }}><i className="fas fa-credit-card" style={{ marginRight: 8 }} />Total Monthly Expenses</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#dc2626' }}>{fmtR(totalExpenses)}</span>
          </div>
        </div>

        {/* Disposable */}
        <div style={{ background: 'linear-gradient(135deg, rgba(91,33,182,0.06), rgba(91,33,182,0.02))', border: '1px solid rgba(91,33,182,0.15)', borderRadius: 18, padding: 22, display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(91,33,182,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="fas fa-piggy-bank" style={{ color: 'var(--color-primary)', fontSize: 20 }} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8E8E93', margin: '0 0 2px' }}>{displayLabel}</p>
            <p style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', margin: 0, color: displayAmount >= 0 ? 'var(--color-primary)' : '#EF4444' }}>{fmtR(displayAmount)}</p>
            <small style={{ fontSize: 11, color: '#8E8E93' }}>
              {disposable > affordabilityThreshold
                ? 'Your disposable income exceeds the 20% affordability threshold'
                : 'Maximum 20% of your income can be used for loan repayments'}
            </small>
          </div>
        </div>

        {/* Why */}
        <div style={{ background: '#FAFAFA', borderRadius: 14, padding: 18 }}>
          <strong style={{ fontSize: 13, color: '#1C1C1E', display: 'block', marginBottom: 8 }}>
            <i className="fas fa-shield-halved" style={{ marginRight: 8, color: 'var(--color-primary)' }} />Why we need this information
          </strong>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: '#6b7280', lineHeight: 1.8 }}>
            <li>To assess your affordability and ensure responsible lending</li>
            <li>To determine appropriate loan amounts and repayment terms</li>
            <li>To comply with National Credit Regulator (NCR) requirements</li>
            <li>To protect you from over-indebtedness</li>
          </ul>
        </div>

        {financial && (
          <p style={{ fontSize: 12, color: '#8E8E93', margin: 0 }}>
            <i className="fas fa-clock-rotate-left" style={{ marginRight: 6 }} />
            Last updated {new Date(financial.updated_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {' · '}Created {new Date(financial.created_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <SaveButton saving={saving}><i className="fas fa-floppy-disk" style={{ marginRight: 8 }} />Save Financial Information</SaveButton>
        </div>
      </form>
    </Card>
  );
}

// ── Security tab ──────────────────────────────────────────────────────────────

function passwordStrength(pw: string): number {
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  return s;
}

function SecurityTab({ profile }: { profile: Profile }) {
  const [newPw, setNewPw]         = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [saving, setSaving]       = useState(false);
  const [notice, setNotice]       = useState<{ ok: boolean; text: string } | null>(null);

  const strength = passwordStrength(newPw);
  const strengthColor = strength <= 2 ? '#ef4444' : strength <= 4 ? '#f59e0b' : '#10b981';
  const strengthPct = newPw ? Math.min(100, (strength / 5) * 100) : 0;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) { setNotice({ ok: false, text: '❌ Passwords do not match!' }); return; }
    if (newPw.length < 6) { setNotice({ ok: false, text: '❌ Password must be at least 6 characters long!' }); return; }
    setSaving(true);
    setNotice(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setNotice({ ok: true, text: '✅ Password updated successfully!' });
      setNewPw('');
      setConfirmPw('');
    } catch (err) {
      setNotice({ ok: false, text: `❌ ${err instanceof Error ? err.message : 'Update failed'}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card>
        <h4 style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E', margin: '0 0 18px' }}>
          <i className="fas fa-shield-halved" style={{ color: 'var(--color-primary)', marginRight: 10 }} />Change Password
        </h4>
        <Notice notice={notice} />
        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <div>
              <label style={labelStyle}><i className="fas fa-key" style={{ marginRight: 6 }} />New Password</label>
              <input type="password" required minLength={6} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Enter new password (min. 6 characters)" style={fieldStyle} />
              <div style={{ height: 4, background: '#f1f5f9', borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${strengthPct}%`, background: strengthColor, borderRadius: 4, transition: 'width 0.3s, background 0.3s' }} />
              </div>
            </div>
            <div>
              <label style={labelStyle}><i className="fas fa-check-double" style={{ marginRight: 6 }} />Confirm Password</label>
              <input type="password" required minLength={6} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Re-enter your new password" style={fieldStyle} />
            </div>
          </div>
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 16px', fontSize: 12.5, color: '#92400e' }}>
            <strong><i className="fas fa-exclamation-triangle" style={{ marginRight: 6 }} />Password Requirements:</strong>
            <ul style={{ margin: '6px 0 0 18px', lineHeight: 1.7 }}>
              <li>Minimum 6 characters</li>
              <li>Use a mix of letters, numbers, and symbols for stronger security</li>
              <li>Don't use common words or personal information</li>
            </ul>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" onClick={() => { setNewPw(''); setConfirmPw(''); }} style={{ padding: '13px 24px', background: '#FAFAFA', border: '1px solid #E5E5EA', color: '#1C1C1E', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              <i className="fas fa-times" style={{ marginRight: 6 }} />Cancel
            </button>
            <SaveButton saving={saving}><i className="fas fa-lock" style={{ marginRight: 8 }} />Update Password</SaveButton>
          </div>
        </form>
      </Card>

      <Card>
        <h4 style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E', margin: '0 0 18px' }}>
          <i className="fas fa-user-shield" style={{ color: 'var(--color-primary)', marginRight: 10 }} />Account Security
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Account Created', value: new Date(profile.created_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' }) },
            { label: 'Account Status', value: 'Active', active: true },
          ].map(m => (
            <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA', borderRadius: 12, padding: '13px 16px' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#8E8E93' }}>{m.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: m.active ? '#10b981' : '#1C1C1E' }}>
                {m.active && <i className="fas fa-check-circle" style={{ marginRight: 6 }} />}{m.value}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Declarations tab ──────────────────────────────────────────────────────────

function RadioPill({ name, value, checked, onChange, icon, label }: {
  name: string; value: string; checked: boolean; onChange: (v: string) => void; icon: string; label: string;
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '11px 18px',
      borderRadius: 12, cursor: 'pointer', fontSize: 13.5, fontWeight: 600,
      border: `2px solid ${checked ? 'var(--color-primary)' : '#e5e7eb'}`,
      background: checked ? 'rgba(91,33,182,0.06)' : '#fff',
      color: checked ? 'var(--color-primary)' : '#6b7280',
      transition: 'all 0.15s',
    }}>
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} style={{ display: 'none' }} />
      <i className={`fas ${icon}`} />
      {label}
    </label>
  );
}

function DeclCard({ icon, title, sub, children }: { icon: string; title: string; sub: string; children: ReactNode }) {
  return (
    <div style={{ background: '#FAFAFA', borderRadius: 18, padding: 22 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(91,33,182,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className={`fas ${icon}`} style={{ color: 'var(--color-primary)' }} />
        </div>
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>{title}</h4>
          <p style={{ fontSize: 12, color: '#8E8E93', margin: '2px 0 0' }}>{sub}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function DeclarationsTab({ userId, declarations, onSaved, onComplete }: {
  userId: string; declarations: Declarations | null; onSaved: () => void; onComplete: () => void;
}) {
  const [hd, setHd]               = useState(declarations?.historically_disadvantaged === true ? 'yes' : declarations?.historically_disadvantaged === false ? 'no' : '');
  const [acceptedStd, setStd]     = useState(declarations?.accepted_std_conditions === true);
  const [home, setHome]           = useState(declarations?.home_ownership ?? '');
  const [marital, setMarital]     = useState(declarations?.marital_status ?? '');
  const [qual, setQual]           = useState(declarations?.highest_qualification ?? '');
  const [refProvided, setRefProvided] = useState(declarations?.referral_provided === true);
  const [refName, setRefName]     = useState(declarations?.referral_name ?? '');
  const [refPhone, setRefPhone]   = useState(declarations?.referral_phone ?? '');
  const [saving, setSaving]       = useState(false);
  const [notice, setNotice]       = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const meta = {
        historically_disadvantaged: hd,
        accepted_std_conditions: acceptedStd,
        home_ownership: home,
        marital_status: marital,
        highest_qualification: qual,
        referral_provided: refProvided,
        referral_name: refProvided ? refName.trim() || null : null,
        referral_phone: refProvided ? refPhone.trim() || null : null,
      };
      const { error } = await supabase.from('declarations').upsert([{
        user_id: userId,
        historically_disadvantaged: hd === 'yes',
        accepted_std_conditions: acceptedStd,
        home_ownership: home || null,
        marital_status: marital || null,
        highest_qualification: qual || null,
        referral_provided: refProvided,
        referral_name: refProvided ? refName.trim() || null : null,
        referral_phone: refProvided ? refPhone.trim() || null : null,
        metadata: meta,
        updated_at: new Date().toISOString(),
      }], { onConflict: 'user_id' });
      if (error) throw error;

      await supabase.auth.updateUser({ data: { declarations: JSON.stringify(meta) } });

      setNotice({ ok: true, text: '✅ Declarations saved successfully!' });
      onSaved();
      if (acceptedStd) onComplete();
    } catch (err) {
      setNotice({ ok: false, text: `❌ ${err instanceof Error ? err.message : 'Save failed'}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <Notice notice={notice} />
      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        <DeclCard icon="fa-user-shield" title="Historically Disadvantaged Status" sub="Are you historically disadvantaged in South Africa?">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <RadioPill name="hd" value="yes" checked={hd === 'yes'} onChange={setHd} icon="fa-circle-check" label="Yes" />
            <RadioPill name="hd" value="no"  checked={hd === 'no'}  onChange={setHd} icon="fa-circle-xmark" label="No" />
          </div>
        </DeclCard>

        <DeclCard icon="fa-file-contract" title="Standard Conditions" sub="Credit agreement terms and conditions">
          <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>
            <input type="checkbox" checked={acceptedStd} onChange={e => setStd(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--color-primary)', cursor: 'pointer', flexShrink: 0, marginTop: 2 }} />
            <span>
              I confirm that I have read and accepted the <strong>Standard Conditions of Credit Agreement</strong>.
              I understand all terms, fees, and obligations associated with this loan application.
            </span>
          </label>
        </DeclCard>

        <DeclCard icon="fa-house" title="Home Ownership" sub="Do you own or rent your primary residence?">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <RadioPill name="home" value="own"  checked={home === 'own'}  onChange={setHome} icon="fa-house-user" label="Own" />
            <RadioPill name="home" value="rent" checked={home === 'rent'} onChange={setHome} icon="fa-key" label="Rent" />
          </div>
        </DeclCard>

        <DeclCard icon="fa-heart" title="Marital Status" sub="Your current marital status">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { v: 'single',    icon: 'fa-user',                      label: 'Single' },
              { v: 'married',   icon: 'fa-heart',                     label: 'Married' },
              { v: 'divorced',  icon: 'fa-heart-crack',               label: 'Divorced' },
              { v: 'widowed',   icon: 'fa-ribbon',                    label: 'Widowed' },
              { v: 'separated', icon: 'fa-arrows-split-up-and-left',  label: 'Separated' },
            ].map(o => (
              <RadioPill key={o.v} name="marital" value={o.v} checked={marital === o.v} onChange={setMarital} icon={o.icon} label={o.label} />
            ))}
          </div>
        </DeclCard>

        <DeclCard icon="fa-graduation-cap" title="Highest Qualification" sub="Your highest level of education">
          <select value={qual} onChange={e => setQual(e.target.value)} style={fieldStyle}>
            <option value="">Please select your highest qualification</option>
            {['N/A', 'Matric', 'Degree', 'Honours', 'Masters', 'PhD'].map(q => (
              <option key={q} value={q}>{q === 'Honours' ? 'Honours Degree' : q === 'PhD' ? 'PhD / Doctorate' : q}</option>
            ))}
          </select>
        </DeclCard>

        <DeclCard icon="fa-user-plus" title="Referral / Next of Kin" sub="Would you like to provide a referral or next of kin contact?">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: refProvided ? 16 : 0 }}>
            <RadioPill name="ref" value="yes" checked={refProvided}  onChange={() => setRefProvided(true)}  icon="fa-circle-check" label="Yes, I'll provide details" />
            <RadioPill name="ref" value="no"  checked={!refProvided} onChange={() => setRefProvided(false)} icon="fa-circle-xmark" label="No, skip this" />
          </div>
          {refProvided && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, background: '#fff', borderRadius: 12, padding: 16 }}>
              <Field label="Full Name"><input type="text" value={refName} onChange={e => setRefName(e.target.value)} placeholder="Enter full name" style={fieldStyle} /></Field>
              <Field label="Cellphone Number"><input type="text" value={refPhone} onChange={e => setRefPhone(e.target.value)} placeholder="e.g., 0821234567" style={fieldStyle} /></Field>
            </div>
          )}
        </DeclCard>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 12, color: '#8E8E93', margin: 0, maxWidth: 480 }}>
            <i className="fas fa-shield-heart" style={{ marginRight: 6, color: 'var(--color-primary)' }} />
            All declarations are securely stored and used solely for compliance and assessment purposes.
          </p>
          <SaveButton saving={saving}><i className="fas fa-floppy-disk" style={{ marginRight: 8 }} />Save Declarations</SaveButton>
        </div>
      </form>
    </Card>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabName>('profile');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['profile-page'],
    queryFn: fetchProfileData,
    staleTime: 60_000,
    retry: 1,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['profile-page'] });

  const isComplete = useMemo(() => {
    const hasFinancial = (data?.financial?.monthly_income ?? 0) > 0;
    const hasDeclarations = data?.declarations?.accepted_std_conditions === true;
    return hasFinancial && hasDeclarations;
  }, [data]);

  function handleComplete() {
    // Both financial + declarations done → return to dashboard (legacy unlock flow)
    if ((data?.financial?.monthly_income ?? 0) > 0) {
      setTimeout(() => navigate('/user-portal/dashboard'), 800);
    }
  }

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}><i className="fas fa-circle-notch fa-spin" style={{ fontSize: 28, color: 'var(--color-primary)' }} /></div>;
  }

  if (isError || !data) {
    return (
      <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: RADIUS, padding: 24, color: '#be123c', fontSize: 14 }}>
        <i className="fas fa-exclamation-triangle" style={{ marginRight: 8 }} />
        {error instanceof Error ? error.message : 'Failed to load profile.'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>

      <div>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-1px', color: '#1C1C1E', margin: 0 }}>Profile &amp; Settings</h1>
        <p style={{ fontSize: 14, color: '#8E8E93', margin: '4px 0 0', fontWeight: 500 }}>
          Manage your personal details, financial info, and account security
        </p>
      </div>

      {!isComplete && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: '12px 16px', fontSize: 13, color: '#92400e', fontWeight: 600 }}>
          <i className="fas fa-circle-exclamation" style={{ marginRight: 8 }} />
          Complete both <strong>Financial Info</strong> and <strong>Declarations</strong> to unlock the full portal.
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px',
                borderRadius: 12, border: 'none', fontSize: 13.5, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                background: active ? 'var(--color-primary)' : '#fff',
                color: active ? '#fff' : '#6b7280',
                boxShadow: active ? '0 4px 16px rgba(91,33,182,0.30)' : SHADOW_SOFT,
              }}
            >
              <i className={`fas ${t.icon}`} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'profile' && <ProfileTab profile={data.profile} onSaved={refresh} />}
      {tab === 'financial' && <FinancialTab userId={data.profile.id} financial={data.financial} onSaved={refresh} />}
      {tab === 'security' && <SecurityTab profile={data.profile} />}
      {tab === 'declarations' && (
        <DeclarationsTab userId={data.profile.id} declarations={data.declarations} onSaved={refresh} onComplete={handleComplete} />
      )}
    </div>
  );
}
