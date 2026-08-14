import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { usePageCSS } from '../hooks/usePageCSS';
import profileCssUrl from '../legacy-css/15-profile.css?url';

type TabName = 'profile' | 'financial' | 'security' | 'declarations';

const TABS: { id: TabName; icon: string; label: string }[] = [
  { id: 'profile',      icon: 'fa-user-edit',       label: 'My Profile' },
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

function isRlsError(err: { code?: string; status?: number } | null) {
  if (!err) return false;
  return err.code === '42501' || (err as { status?: number }).status === 403;
}

async function fetchProfileData() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const uid = session.user.id;

  const [{ data: rawProfile, error: profileError }, { data: financial }, { data: declarations }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
    supabase.from('financial_profiles').select('*').eq('user_id', uid).maybeSingle(),
    supabase.from('declarations').select('*').eq('user_id', uid).maybeSingle(),
  ]);

  // RLS/permission denial → treat as no row, not a fatal error
  if (profileError && !isRlsError(profileError)) throw profileError;

  let profile: Profile | null = rawProfile;

  if (!profile) {
    const email    = session.user.email ?? '';
    const fullName = (session.user.user_metadata?.full_name as string | undefined)
      ?? email.split('@')[0]
      ?? '';
    const { data: created, error: insertErr } = await supabase
      .from('profiles')
      .insert({ id: uid, email, full_name: fullName, role: 'borrower', updated_at: new Date().toISOString() })
      .select()
      .single();

    if (insertErr) {
      if (!isRlsError(insertErr)) throw insertErr;
      // RLS blocked insert too — build a synthetic profile from auth metadata
      const now = new Date().toISOString();
      profile = {
        id: uid, email, full_name: fullName,
        first_name: null, last_name: null, contact_number: null,
        identity_number: null, gender: null, date_of_birth: null,
        address: null, postal_code: null, suburb_area: null,
        cell_tel_no: null, avatar_url: null, role: 'borrower',
        created_at: now,
      };
    } else {
      profile = created;
    }
  }

  return {
    profile: profile as Profile,
    financial: (financial ?? null) as FinancialProfile | null,
    declarations: (declarations ?? null) as Declarations | null,
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  const cleaned = name.trim();
  if (!cleaned) return 'U';
  return cleaned.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || 'U';
}

function Notification({ notice }: { notice: { ok: boolean; text: string } | null }) {
  if (!notice) return null;
  return (
    <div className={`info-message ${notice.ok ? 'success' : 'error'}`} style={{ marginBottom: 16 }}>
      <i className={`fa-solid ${notice.ok ? 'fa-circle-check' : 'fa-exclamation-triangle'}`} />
      <span>{notice.text}</span>
    </div>
  );
}

// ── Profile tab (legacy renderProfileTab markup) ──────────────────────────────

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

  const roleClass = `role-${(profile.role || 'borrower').replace(/_/g, '-')}`;
  const initials = getInitials(form.full_name || 'User');

  return (
    <>
      <div className="section-header">
        <h3>My Profile</h3>
        <p>Manage your personal account details and information</p>
      </div>

      <Notification notice={notice} />

      <div className="inner-card">
        <form onSubmit={save}>
          <div className="avatar-section">
            <div className="avatar-container">
              {profile.avatar_url ? (
                <img id="avatar-preview" src={`${profile.avatar_url}?t=${Date.now()}`} alt="Profile" className="avatar-preview" />
              ) : (
                <div className="avatar-preview" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-primary)', color: '#fff', fontSize: 32, fontWeight: 700 }}>
                  {initials}
                </div>
              )}
              <label className="avatar-overlay" onClick={() => avatarInputRef.current?.click()}>
                <i className={`fa-solid ${uploadingAvatar ? 'fa-spinner fa-spin' : 'fa-camera'}`} />
              </label>
              <input
                ref={avatarInputRef} type="file" style={{ display: 'none' }}
                accept="image/png, image/jpeg, image/jpg, image/gif"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ''; }}
              />
              {uploadingAvatar && (
                <div className="avatar-spinner"><i className="fa-solid fa-spinner fa-spin" /></div>
              )}
            </div>
            <div className="avatar-info">
              <h4>{form.full_name || 'No Name Set'}</h4>
              <p>{profile.email || 'No Email'}</p>
              <span className={`role-badge ${roleClass}`}>{(profile.role || 'borrower').replace(/_/g, ' ')}</span>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="first_name">First Name</label>
              <input type="text" id="first_name" required value={form.first_name} onChange={set('first_name')} placeholder="Enter your first name" />
            </div>
            <div className="form-group">
              <label htmlFor="last_name">Surname</label>
              <input type="text" id="last_name" required value={form.last_name} onChange={set('last_name')} placeholder="Enter your surname" />
            </div>
            <div className="form-group">
              <label htmlFor="full_name">Full Name</label>
              <input type="text" id="full_name" required value={form.full_name} onChange={set('full_name')} placeholder="Enter your full name" />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input type="email" id="email" value={profile.email ?? ''} placeholder="your@email.com" disabled />
            </div>
            <div className="form-group">
              <label htmlFor="contact_number">Contact Number</label>
              <input type="text" id="contact_number" value={form.contact_number} onChange={set('contact_number')} placeholder="+27 XX XXX XXXX" />
            </div>
            <div className="form-group">
              <label htmlFor="identity_number">ID Number</label>
              <input type="text" id="identity_number" maxLength={20} autoComplete="off" value={form.identity_number} onChange={set('identity_number')} placeholder="Enter your SA ID number" />
            </div>
            <div className="form-group">
              <label htmlFor="gender">Gender</label>
              <select id="gender" value={form.gender} onChange={set('gender')}>
                <option value="">Select gender</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="date_of_birth">Date of Birth</label>
              <input type="date" id="date_of_birth" value={form.date_of_birth} onChange={set('date_of_birth')} />
            </div>
            <div className="form-group">
              <label htmlFor="address">Street Address</label>
              <input type="text" id="address" value={form.address} onChange={set('address')} placeholder="Street address" />
            </div>
            <div className="form-group">
              <label htmlFor="postal_code">Postal Code</label>
              <input type="text" id="postal_code" maxLength={4} value={form.postal_code} onChange={set('postal_code')} placeholder="e.g. 0123" />
            </div>
            <div className="form-group">
              <label htmlFor="suburb_area">Suburb / Area</label>
              <input type="text" id="suburb_area" value={form.suburb_area} onChange={set('suburb_area')} placeholder="Suburb or area" />
            </div>
            <div className="form-group">
              <label htmlFor="cell_tel_no">Cell Phone Number</label>
              <input type="text" id="cell_tel_no" maxLength={10} value={form.cell_tel_no} onChange={set('cell_tel_no')} placeholder="e.g. 0821234567" />
            </div>
            <div className="form-group">
              <label htmlFor="user_id">User ID</label>
              <input type="text" id="user_id" value={profile.id} disabled />
            </div>
          </div>

          <div className="info-message">
            <i className="fa-solid fa-info-circle" />
            <span>Your profile information is securely stored and can be updated at any time.</span>
          </div>

          <div className="btn-container">
            <button type="submit" disabled={saving} className="btn-primary">
              <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── Financial tab (legacy renderFinancialTab markup) ──────────────────────────

const EXPENSE_FIELDS: { key: string; label: string; icon: string; hint: string; required?: boolean }[] = [
  { key: 'housing_rent', label: 'Housing',     icon: 'fa-house',               hint: 'Rent or bond payment', required: true },
  { key: 'school',       label: 'Education',   icon: 'fa-graduation-cap',      hint: 'School fees, uniforms, books' },
  { key: 'maintenance',  label: 'Maintenance', icon: 'fa-hand-holding-dollar', hint: 'Child or spousal support' },
  { key: 'petrol',       label: 'Transport',   icon: 'fa-gas-pump',            hint: 'Fuel, taxi, car payments' },
  { key: 'groceries',    label: 'Groceries',   icon: 'fa-cart-shopping',       hint: 'Food and household supplies' },
  { key: 'other',        label: 'Other',       icon: 'fa-ellipsis',            hint: 'Insurance, medical, loans, etc.' },
];

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
      let dti: string | null = null;
      const { data: loans } = await supabase.from('loans').select('monthly_payment').eq('user_id', userId).eq('status', 'active');
      if (loans && loans.length > 0) {
        const debt = loans.reduce((s, l) => s + (parseFloat(l.monthly_payment) || 0), 0);
        dti = totalIncome > 0 ? ((debt / totalIncome) * 100).toFixed(2) : null;
      }

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
    <>
      <div className="section-header">
        <h3><i className="fa-solid fa-chart-line" style={{ color: 'var(--color-primary)' }} /> Financial Overview</h3>
        <p>Complete your financial profile to help us assess your loan eligibility</p>
      </div>

      <Notification notice={notice} />

      <div id="affordability-status-container" />

      <div className="inner-card financial-card">
        <form onSubmit={save}>

          <div className="financial-section-header income-header">
            <div className="section-icon"><i className="fa-solid fa-money-bill-trend-up" /></div>
            <div>
              <h4>Monthly Income</h4>
              <p>All sources of regular income you receive each month</p>
            </div>
          </div>

          <div className="financial-input-grid">
            <div className="financial-input-group">
              <label htmlFor="income_salary">
                <i className="fa-solid fa-briefcase" /> <span>Salary Income</span> <span className="required-badge">Required</span>
              </label>
              <div className="currency-input-wrapper">
                <span className="currency-symbol">R</span>
                <input type="number" id="income_salary" value={income.salary} onChange={e => setIncome(i => ({ ...i, salary: e.target.value }))} placeholder="0.00" step="0.01" min="0" className="currency-input" required />
              </div>
              <small className="input-hint"><i className="fa-solid fa-circle-info" /> Your monthly salary before deductions</small>
            </div>

            <div className="financial-input-group">
              <label htmlFor="income_other"><i className="fa-solid fa-coins" /> <span>Other Earnings</span></label>
              <div className="currency-input-wrapper">
                <span className="currency-symbol">R</span>
                <input type="number" id="income_other" value={income.other} onChange={e => setIncome(i => ({ ...i, other: e.target.value }))} placeholder="0.00" step="0.01" min="0" className="currency-input" />
              </div>
              <small className="input-hint"><i className="fa-solid fa-circle-info" /> Freelance, bonuses, rental income, investments</small>
            </div>
          </div>

          <div className="financial-summary-card income-summary">
            <div className="summary-icon"><i className="fa-solid fa-wallet" /></div>
            <div className="summary-content">
              <span className="summary-label">Total Monthly Income</span>
              <span className="summary-amount">{fmtR(totalIncome)}</span>
            </div>
            <div className="summary-badge income-badge"><i className="fa-solid fa-arrow-trend-up" /></div>
          </div>

          <div className="financial-section-header expense-header">
            <div className="section-icon"><i className="fa-solid fa-receipt" /></div>
            <div>
              <h4>Monthly Expenses</h4>
              <p>Your regular monthly costs and financial obligations</p>
            </div>
          </div>

          <div className="financial-input-grid expense-grid">
            {EXPENSE_FIELDS.map(f => (
              <div className="financial-input-group" key={f.key}>
                <label htmlFor={f.key}>
                  <i className={`fa-solid ${f.icon}`} /> <span>{f.label}</span> {f.required && <span className="required-badge">Required</span>}
                </label>
                <div className="currency-input-wrapper">
                  <span className="currency-symbol">R</span>
                  <input
                    type="number" id={f.key} value={expenses[f.key]}
                    onChange={e => setExpenses(x => ({ ...x, [f.key]: e.target.value }))}
                    placeholder="0.00" step="0.01" min="0" className="currency-input" required={f.required}
                  />
                </div>
                <small className="input-hint"><i className="fa-solid fa-circle-info" /> {f.hint}</small>
              </div>
            ))}
          </div>

          <div className="financial-summary-card expense-summary">
            <div className="summary-icon"><i className="fa-solid fa-credit-card" /></div>
            <div className="summary-content">
              <span className="summary-label">Total Monthly Expenses</span>
              <span className="summary-amount">{fmtR(totalExpenses)}</span>
            </div>
            <div className="summary-badge expense-badge"><i className="fa-solid fa-arrow-trend-down" /></div>
          </div>

          <div className="financial-summary-card disposable-summary">
            <div className="summary-icon-large"><i className="fa-solid fa-piggy-bank" /></div>
            <div className="summary-content-large">
              <span className="summary-label-large">{displayLabel}</span>
              <span className="summary-amount-large" style={{ color: displayAmount >= 0 ? 'var(--color-primary)' : '#EF4444' }}>{fmtR(displayAmount)}</span>
              <small className="summary-hint">
                <i className="fa-solid fa-circle-info" />{' '}
                {disposable > affordabilityThreshold
                  ? 'Your disposable income exceeds the 20% affordability threshold'
                  : 'Maximum 20% of your income can be used for loan repayments'}
              </small>
            </div>
          </div>

          <div className="financial-info-card">
            <div className="info-icon"><i className="fa-solid fa-shield-halved" /></div>
            <div className="info-content">
              <strong>Why we need this information</strong>
              <ul>
                <li><i className="fa-solid fa-check" /> To assess your affordability and ensure responsible lending</li>
                <li><i className="fa-solid fa-check" /> To determine appropriate loan amounts and repayment terms</li>
                <li><i className="fa-solid fa-check" /> To comply with National Credit Regulator (NCR) requirements</li>
                <li><i className="fa-solid fa-check" /> To protect you from over-indebtedness</li>
              </ul>
            </div>
          </div>

          <div className="btn-container">
            <button type="submit" disabled={saving} className="btn-primary">
              <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} /> {saving ? 'Saving...' : 'Save Financial Information'}
            </button>
          </div>
        </form>
      </div>

      {financial && (
        <div className="inner-card" style={{ marginTop: 24 }}>
          <h4 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-clock-rotate-left" /> Update History
          </h4>
          <div style={{ color: '#9CA3AF', lineHeight: 1.6 }}>
            <p style={{ marginBottom: 8 }}>
              <strong style={{ color: 'var(--text-main, #1C1C1E)' }}>Last Updated:</strong>{' '}
              {new Date(financial.updated_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
            <p style={{ marginBottom: 0 }}>
              <strong style={{ color: 'var(--text-main, #1C1C1E)' }}>Created:</strong>{' '}
              {new Date(financial.created_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// ── Security tab (legacy renderSecurityTab markup) ────────────────────────────

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
  const strengthClass = strength <= 2 ? 'strength-weak' : strength <= 4 ? 'strength-medium' : 'strength-strong';

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
    <>
      <div className="section-header">
        <h3>Security Settings</h3>
        <p>Manage your account security and password preferences</p>
      </div>

      <Notification notice={notice} />

      <div className="inner-card">
        <h4 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <i className="fa-solid fa-shield-halved" /> Change Password
        </h4>
        <form onSubmit={save}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="new_password"><i className="fa-solid fa-key" /> New Password</label>
              <input type="password" id="new_password" required minLength={6} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Enter new password (min. 6 characters)" />
              <div className="password-strength">
                <div className={`password-strength-bar ${newPw ? strengthClass : ''}`} />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="confirm_password"><i className="fa-solid fa-check-double" /> Confirm Password</label>
              <input type="password" id="confirm_password" required minLength={6} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Re-enter your new password" />
            </div>
          </div>

          <div className="info-message">
            <i className="fa-solid fa-exclamation-triangle" />
            <div>
              <strong>Password Requirements:</strong>
              <ul style={{ margin: '0.5rem 0 0 1.25rem', color: '#9CA3AF' }}>
                <li>Minimum 6 characters</li>
                <li>Use a mix of letters, numbers, and symbols for stronger security</li>
                <li>Don't use common words or personal information</li>
              </ul>
            </div>
          </div>

          <div className="btn-container">
            <button type="button" className="btn-secondary" onClick={() => { setNewPw(''); setConfirmPw(''); }}>
              <i className="fa-solid fa-times" /> Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-lock'}`} /> {saving ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      <div className="inner-card" style={{ marginTop: 24 }}>
        <h4 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fa-solid fa-user-shield" /> Account Security
        </h4>
        <div className="security-metric-list">
          <div className="security-metric">
            <span className="security-metric-label">Account Created</span>
            <span className="security-metric-value">
              {new Date(profile.created_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <div className="security-metric">
            <span className="security-metric-label">Account Status</span>
            <span className="security-metric-value security-status"><i className="fa-solid fa-check-circle" /> Active</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Declarations tab (legacy renderDeclarationsTab markup) ────────────────────

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
    <>
      <div className="section-header">
        <h3>Declarations</h3>
        <p>Please complete the declarations below. These help us with compliance and assessment.</p>
      </div>

      <Notification notice={notice} />

      <form className="declarations-form" onSubmit={save}>

        <div className="declaration-card">
          <div className="declaration-card-header">
            <div className="declaration-icon"><i className="fa-solid fa-user-shield" /></div>
            <div>
              <h4>Historically Disadvantaged Status</h4>
              <p>Are you historically disadvantaged in South Africa?</p>
            </div>
          </div>
          <div className="radio-group">
            <div className="radio-option">
              <input type="radio" id="hd_yes" name="hd_status" value="yes" checked={hd === 'yes'} onChange={() => setHd('yes')} />
              <label htmlFor="hd_yes" className="radio-label"><i className="fa-solid fa-circle-check" /><span>Yes</span></label>
            </div>
            <div className="radio-option">
              <input type="radio" id="hd_no" name="hd_status" value="no" checked={hd === 'no'} onChange={() => setHd('no')} />
              <label htmlFor="hd_no" className="radio-label"><i className="fa-solid fa-circle-xmark" /><span>No</span></label>
            </div>
          </div>
        </div>

        <div className="declaration-card">
          <div className="declaration-card-header">
            <div className="declaration-icon"><i className="fa-solid fa-file-contract" /></div>
            <div>
              <h4>Standard Conditions</h4>
              <p>Credit agreement terms and conditions</p>
            </div>
          </div>
          <div className="checkbox-group">
            <div className="checkbox-option">
              <input type="checkbox" id="std_conditions" checked={acceptedStd} onChange={e => setStd(e.target.checked)} />
              <label htmlFor="std_conditions" className="checkbox-label">
                <div className="checkbox-icon"><i className="fa-solid fa-check" /></div>
                <div className="checkbox-text">
                  I confirm that I have read and accepted the <strong>Standard Conditions of Credit Agreement</strong>.
                  I understand all terms, fees, and obligations associated with this loan application.
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="declaration-card">
          <div className="declaration-card-header">
            <div className="declaration-icon"><i className="fa-solid fa-house" /></div>
            <div>
              <h4>Home Ownership</h4>
              <p>Do you own or rent your primary residence?</p>
            </div>
          </div>
          <div className="radio-group">
            <div className="radio-option">
              <input type="radio" id="home_own" name="home_ownership" value="own" checked={home === 'own'} onChange={() => setHome('own')} />
              <label htmlFor="home_own" className="radio-label"><i className="fa-solid fa-house-user" /><span>Own</span></label>
            </div>
            <div className="radio-option">
              <input type="radio" id="home_rent" name="home_ownership" value="rent" checked={home === 'rent'} onChange={() => setHome('rent')} />
              <label htmlFor="home_rent" className="radio-label"><i className="fa-solid fa-key" /><span>Rent</span></label>
            </div>
          </div>
        </div>

        <div className="declaration-card">
          <div className="declaration-card-header">
            <div className="declaration-icon"><i className="fa-solid fa-heart" /></div>
            <div>
              <h4>Marital Status</h4>
              <p>Your current marital status</p>
            </div>
          </div>
          <div className="radio-group" style={{ flexWrap: 'wrap' }}>
            {[
              { v: 'single',    icon: 'fa-user',                     label: 'Single' },
              { v: 'married',   icon: 'fa-heart',                    label: 'Married' },
              { v: 'divorced',  icon: 'fa-heart-crack',              label: 'Divorced' },
              { v: 'widowed',   icon: 'fa-ribbon',                   label: 'Widowed' },
              { v: 'separated', icon: 'fa-arrows-split-up-and-left', label: 'Separated' },
            ].map(o => (
              <div className="radio-option" style={{ flex: '0 0 calc(33.33% - 0.67rem)' }} key={o.v}>
                <input type="radio" id={`marital_${o.v}`} name="marital_status" value={o.v} checked={marital === o.v} onChange={() => setMarital(o.v)} />
                <label htmlFor={`marital_${o.v}`} className="radio-label"><i className={`fa-solid ${o.icon}`} /><span>{o.label}</span></label>
              </div>
            ))}
          </div>
        </div>

        <div className="declaration-card">
          <div className="declaration-card-header">
            <div className="declaration-icon"><i className="fa-solid fa-graduation-cap" /></div>
            <div>
              <h4>Highest Qualification</h4>
              <p>Your highest level of education</p>
            </div>
          </div>
          <div className="select-group">
            <div className="select-wrapper">
              <select value={qual} onChange={e => setQual(e.target.value)}>
                <option value="">Please select your highest qualification</option>
                <option value="N/A">N/A</option>
                <option value="Matric">Matric</option>
                <option value="Degree">Degree</option>
                <option value="Honours">Honours Degree</option>
                <option value="Masters">Masters</option>
                <option value="PhD">PhD / Doctorate</option>
              </select>
            </div>
          </div>
        </div>

        <div className="declaration-card">
          <div className="declaration-card-header">
            <div className="declaration-icon"><i className="fa-solid fa-user-plus" /></div>
            <div>
              <h4>Referral / Next of Kin</h4>
              <p>Would you like to provide a referral or next of kin contact?</p>
            </div>
          </div>
          <div className="radio-group">
            <div className="radio-option">
              <input type="radio" id="referral_yes" name="referral_provided" value="yes" checked={refProvided} onChange={() => setRefProvided(true)} />
              <label htmlFor="referral_yes" className="radio-label"><i className="fa-solid fa-circle-check" /><span>Yes, I'll provide details</span></label>
            </div>
            <div className="radio-option">
              <input type="radio" id="referral_no" name="referral_provided" value="no" checked={!refProvided} onChange={() => setRefProvided(false)} />
              <label htmlFor="referral_no" className="radio-label"><i className="fa-solid fa-circle-xmark" /><span>No, skip this</span></label>
            </div>
          </div>

          <div className="conditional-fields" style={{ display: refProvided ? 'block' : 'none' }}>
            <div className="conditional-fields-header">
              <i className="fa-solid fa-address-card" />
              <span>Contact Details</span>
            </div>
            <div className="conditional-field">
              <label htmlFor="referral_name">Full Name</label>
              <input type="text" id="referral_name" value={refName} onChange={e => setRefName(e.target.value)} placeholder="Enter full name" />
            </div>
            <div className="conditional-field">
              <label htmlFor="referral_phone">Cellphone Number</label>
              <input type="text" id="referral_phone" value={refPhone} onChange={e => setRefPhone(e.target.value)} placeholder="e.g., 0821234567" />
            </div>
          </div>
        </div>

        <div className="declarations-submit">
          <div className="declarations-info">
            <i className="fa-solid fa-shield-heart" />
            <h5>Your Privacy Matters</h5>
            <p>All declarations are securely stored and used solely for compliance and assessment purposes.
              Your information is protected under our privacy policy.</p>
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} /> {saving ? 'Saving...' : 'Save Declarations'}
          </button>
        </div>
      </form>
    </>
  );
}

// ── main page (legacy profile.html markup) ────────────────────────────────────

export function ProfilePage() {
  usePageCSS(profileCssUrl);
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
    if ((data?.financial?.monthly_income ?? 0) > 0) {
      setTimeout(() => navigate('/user-portal/dashboard'), 800);
    }
  }

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="content-wrapper" style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 28, color: 'var(--color-primary)' }} />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="page-container">
        <div className="content-wrapper">
          <p style={{ color: '#ef4444', padding: 24 }}>{error instanceof Error ? error.message : 'Failed to load profile.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="content-wrapper">
        <div className="profile-page-wrapper">
          <div className="profile-header">
            {!isComplete && (
              <div className="info-message" style={{ marginBottom: 16 }}>
                <i className="fa-solid fa-circle-exclamation" />
                <span>Complete both <strong>Financial Info</strong> and <strong>Declarations</strong> to unlock the full portal.</span>
              </div>
            )}
          </div>

          <div className="profile-card-container">
            <nav className="profile-tabs">
              {TABS.map(t => (
                <button
                  key={t.id}
                  className={`tab-button${tab === t.id ? ' active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  <i className={`fa-solid ${t.icon}`} />
                  <span>{t.label}</span>
                </button>
              ))}
            </nav>

            <div className="tab-content">
              {!data.profile ? (
                <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  <i className="fa-solid fa-user-slash" style={{ fontSize: 32, marginBottom: 12, display: 'block' }} />
                  <p>No profile found. Please contact support.</p>
                </div>
              ) : (
                <>
                  {tab === 'profile' && <ProfileTab profile={data.profile} onSaved={refresh} />}
                  {tab === 'financial' && <FinancialTab userId={data.profile.id} financial={data.financial} onSaved={refresh} />}
                  {tab === 'security' && <SecurityTab profile={data.profile} />}
                  {tab === 'declarations' && (
                    <DeclarationsTab userId={data.profile.id} declarations={data.declarations} onSaved={refresh} onComplete={handleComplete} />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
