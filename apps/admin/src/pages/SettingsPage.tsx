import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../api/supabaseClient';
import {
  fetchSystemSettings,
  updateSystemSettings,
  fetchUsers,
  updateUserRole,
} from '../services/adminData';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CarouselSlide {
  title: string;
  text: string;
}

interface ProfileData {
  id: string;
  full_name: string;
  email: string;
  contact_number: string;
  avatar_url: string;
  role: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DEFAULT_SLIDES: CarouselSlide[] = [
  { title: 'Fast Approvals', text: 'Get a decision on your loan application within 24 hours.' },
  { title: 'Flexible Terms', text: 'Choose repayment terms that work for your budget.' },
  { title: 'Secure & Trusted', text: 'Your data is protected with bank-grade security.' },
];

const DEFAULT_FORM: Record<string, any> = {
  // Identity
  company_name: 'AlgoLend',
  company_logo_url: '',
  // Legal
  legal_entity_name: '',
  ncr_number: '',
  fsp_number: '',
  company_reg_number: '',
  company_vat_number: '',
  provider_branch_code: '',
  company_phone: '',
  company_physical_address: '',
  company_postal_address: '',
  // NCR Reporting
  ncr_submission_frequency: 'annually',
  ncr_financial_year_end_month: 12,
  // Banking
  company_bank_name: '',
  company_bank_account_holder: '',
  company_bank_account_no: '',
  company_bank_branch_code: '',
  company_bank_account_type: 'current',
  company_bank_reference_prefix: 'REF',
  // Theme
  primary_color: '#6D28D9',
  secondary_color: '#1A1F36',
  tertiary_color: '#A78BFA',
  theme_mode: 'dark',
  // Login
  auth_background_url: '',
  auth_overlay_color: '#1E0B3B',
  auth_overlay_enabled: true,
  auth_background_flip: false,
  carousel_slides: DEFAULT_SLIDES,
};

const TABS = [
  'My Profile',
  'Security',
  'System Branding',
  'Billing',
  'User Management',
  'Roles & Permissions',
  'Audit Logs',
] as const;
type Tab = typeof TABS[number];

const PRIMARY = '#6D28D9';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRoleLabel(role: string): string {
  switch (role) {
    case 'super_admin': return 'Super Admin';
    case 'admin': return 'Branch Admin';
    case 'base_admin': return 'Loan Officer';
    case 'owner': return 'Owner';
    default: return 'Client';
  }
}

function getRoleBadge(role: string): { color: string; background: string } {
  switch (role) {
    case 'super_admin': return { color: '#6D28D9', background: 'rgba(109,40,217,0.1)' };
    case 'admin':       return { color: '#2563EB', background: 'rgba(37,99,235,0.1)' };
    case 'base_admin':  return { color: '#059669', background: 'rgba(5,150,105,0.1)' };
    case 'owner':       return { color: '#D97706', background: 'rgba(217,119,6,0.1)' };
    default:            return { color: '#64748B', background: 'rgba(100,116,139,0.1)' };
  }
}

// ── Shared style atoms ────────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  width: '100%',
  height: 40,
  padding: '0 12px',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  fontSize: 13,
  fontFamily: 'inherit',
  background: 'var(--color-surface-card, #fff)',
  color: 'var(--color-text)',
  boxSizing: 'border-box',
};

const labelBase: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--color-text-muted)',
  marginBottom: 6,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelBase}>{label}</label>
      {children}
    </div>
  );
}

function SectionCard({
  title, subtitle, icon, children, headerRight,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}) {
  return (
    <div className="glass-card" style={{ borderRadius: 16, padding: 32, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: 14, marginBottom: 24 }}>
        <div>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
            {icon && (
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: PRIMARY }}>{icon}</span>
            )}
            {title}
          </h4>
          {subtitle && (
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '4px 0 0' }}>{subtitle}</p>
          )}
        </div>
        {headerRight}
      </div>
      {children}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SettingsPage({ section = 'general' }: { section?: string }) {
  const qc = useQueryClient();

  const getInitialTab = (): Tab => {
    switch (section) {
      case 'user-management': return 'User Management';
      case 'roles':
      case 'permissions':     return 'Roles & Permissions';
      case 'audit-logs':      return 'Audit Logs';
      case 'branding':
      case 'system':          return 'System Branding';
      default:                return 'My Profile';
    }
  };

  const [tab, setTab] = useState<Tab>(getInitialTab());

  // ── System Settings ────────────────────────────────────────────────────────

  const [form, setForm] = useState<Record<string, any> | null>(null);
  const [saved, setSaved] = useState(false);

  const { isLoading: settingsLoading, data: settingsResult } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: fetchSystemSettings,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!settingsLoading && !form) {
      const raw = (settingsResult?.data as Record<string, any>) ?? {};
      const slides = Array.isArray(raw.carousel_slides) && raw.carousel_slides.length
        ? raw.carousel_slides
        : DEFAULT_SLIDES;
      setForm({ ...DEFAULT_FORM, ...raw, carousel_slides: slides });
    }
  }, [settingsLoading, settingsResult, form]);

  const mutation = useMutation({
    mutationFn: (data: Record<string, any>) => updateSystemSettings(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-settings'] });
      qc.invalidateQueries({ queryKey: ['system-settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const setf = (key: string, value: unknown) => setForm((prev: any) => ({ ...prev, [key]: value }));

  const f: Record<string, any> = form ?? DEFAULT_FORM;
  const slides: CarouselSlide[] = Array.isArray(f.carousel_slides) ? f.carousel_slides : DEFAULT_SLIDES;

  // ── My Profile ─────────────────────────────────────────────────────────────

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileForm, setProfileForm] = useState({ full_name: '', contact_number: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        const merged: ProfileData = {
          id: user.id,
          full_name: p?.full_name ?? user.user_metadata?.full_name ?? '',
          email: user.email ?? '',
          contact_number: p?.contact_number ?? '',
          avatar_url: p?.avatar_url ?? '',
          role: (user.app_metadata?.role ?? 'borrower') as string,
        };
        setProfile(merged);
        setProfileForm({ full_name: merged.full_name, contact_number: merged.contact_number });
      } catch { /* silently fail */ } finally {
        setProfileLoading(false);
      }
    })();
  }, []);

  async function saveProfile() {
    if (!profile) return;
    setSavingProfile(true);
    try {
      await supabase.from('profiles').update({
        full_name: profileForm.full_name,
        contact_number: profileForm.contact_number,
      }).eq('id', profile.id);
      setProfile(p => p ? { ...p, ...profileForm } : p);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch { /* ignore */ } finally {
      setSavingProfile(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setAvatarUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${profile.id}/avatar_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', profile.id);
      setProfile(p => p ? { ...p, avatar_url: data.publicUrl } : p);
    } catch { /* ignore */ } finally {
      setAvatarUploading(false);
    }
  }

  // ── Security ───────────────────────────────────────────────────────────────

  const [passForm, setPassForm] = useState({ newPass: '', confirmPass: '' });
  const [passError, setPassError] = useState('');
  const [passSaved, setPassSaved] = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  async function updatePassword() {
    const { newPass, confirmPass } = passForm;
    if (!newPass) { setPassError('Enter a new password.'); return; }
    if (newPass.length < 6) { setPassError('Password must be at least 6 characters.'); return; }
    if (newPass !== confirmPass) { setPassError('Passwords do not match.'); return; }
    setSavingPass(true);
    setPassError('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) throw error;
      setPassSaved(true);
      setPassForm({ newPass: '', confirmPass: '' });
      setTimeout(() => setPassSaved(false), 3000);
    } catch (err: any) {
      setPassError(err.message || 'Failed to update password.');
    } finally {
      setSavingPass(false);
    }
  }

  // ── Billing ────────────────────────────────────────────────────────────────

  const [cardForm, setCardForm] = useState({
    card_type: 'visa', last_four: '', expiry_month: '', expiry_year: '',
  });
  const [cards, setCards] = useState<any[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardSaving, setCardSaving] = useState(false);

  async function loadCards() {
    setCardsLoading(true);
    try {
      const { data } = await supabase
        .from('payment_methods')
        .select('*')
        .order('created_at', { ascending: false });
      setCards(data ?? []);
    } catch { setCards([]); } finally { setCardsLoading(false); }
  }

  useEffect(() => {
    if (tab === 'Billing') loadCards();
  }, [tab]);

  async function addCard(e: React.FormEvent) {
    e.preventDefault();
    if (!cardForm.last_four || cardForm.last_four.length !== 4) return;
    setCardSaving(true);
    try {
      await supabase.from('payment_methods').insert({
        card_type: cardForm.card_type,
        last_four: cardForm.last_four,
        expiry_month: cardForm.expiry_month,
        expiry_year: cardForm.expiry_year,
      });
      setCardForm({ card_type: 'visa', last_four: '', expiry_month: '', expiry_year: '' });
      loadCards();
    } catch { /* ignore */ } finally { setCardSaving(false); }
  }

  // ── User Management ────────────────────────────────────────────────────────

  const [userSearch, setUserSearch] = useState('');
  const [roleModal, setRoleModal] = useState<{
    userId: string; userName: string; currentRole: string;
  } | null>(null);
  const [newRole, setNewRole] = useState('borrower');
  const [changingRole, setChangingRole] = useState(false);

  const { data: usersResult, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: fetchUsers,
    enabled: tab === 'User Management',
    staleTime: 30_000,
  });
  const allUsers: any[] = (usersResult as any)?.data ?? [];
  const filteredUsers = allUsers.filter(u => {
    const term = userSearch.toLowerCase();
    if (!term) return true;
    return (
      (u.full_name ?? '').toLowerCase().includes(term) ||
      (u.email ?? '').toLowerCase().includes(term) ||
      (u.id ?? '').toLowerCase().includes(term)
    );
  });

  async function handleRoleChange() {
    if (!roleModal) return;
    setChangingRole(true);
    try {
      await updateUserRole(roleModal.userId, newRole);
      setRoleModal(null);
      refetchUsers();
    } catch { /* ignore */ } finally {
      setChangingRole(false);
    }
  }

  // ── Logo / Wallpaper upload state ──────────────────────────────────────────

  const [logoUploading, setLogoUploading] = useState(false);
  const [wallpaperUploading, setWallpaperUploading] = useState(false);
  const [logoUrlInput, setLogoUrlInput] = useState('');
  const [wallpaperUrlInput, setWallpaperUrlInput] = useState('');

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `system/logo_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setf('company_logo_url', data.publicUrl);
    } catch { /* ignore */ } finally { setLogoUploading(false); }
  }

  async function handleWallpaperUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setWallpaperUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `system/wallpaper_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setf('auth_background_url', data.publicUrl);
    } catch { /* ignore */ } finally { setWallpaperUploading(false); }
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (settingsLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <div className="spinner" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>Settings</h1>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginTop: 4 }}>
            Platform configuration, branding and account management.
          </p>
        </div>
        {tab === 'System Branding' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {saved && (
              <span style={{ color: '#10B981', fontWeight: 600, fontSize: 13 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>check_circle</span>
                Saved
              </span>
            )}
            <button
              className="btn btn-primary"
              disabled={mutation.isPending}
              onClick={() => form && mutation.mutate(form)}
            >
              {mutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="tab-bar" style={{ marginBottom: 24 }}>
        {TABS.map(t => (
          <button
            key={t}
            className={`tab-btn${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────
          TAB: My Profile
      ────────────────────────────────────────────────────────────────────── */}
      {tab === 'My Profile' && (
        <div style={{ maxWidth: 640 }}>
          <SectionCard title="My Profile" subtitle="Manage your personal account details." icon="badge">
            {profileLoading ? (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto' }} />
              </div>
            ) : (
              <>
                {/* Avatar row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
                  <div
                    style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}
                    onClick={() => avatarRef.current?.click()}
                  >
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.full_name}
                        style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-border)' }}
                      />
                    ) : (
                      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(109,40,217,0.08)', border: '2px solid rgba(109,40,217,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: PRIMARY }}>
                        {(profile?.full_name ?? 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                    {/* Hover overlay */}
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: avatarUploading ? 1 : 0, transition: 'opacity 0.2s' }}
                      onMouseOver={e => { if (!avatarUploading) (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                      onMouseOut={e => { if (!avatarUploading) (e.currentTarget as HTMLElement).style.opacity = '0'; }}>
                      {avatarUploading
                        ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                        : <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 20 }}>photo_camera</span>}
                    </div>
                    <input ref={avatarRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>
                      {profile?.full_name || 'User'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {profile?.email || ''}
                    </div>
                    {profile?.role && (
                      <span style={{ ...getRoleBadge(profile.role), display: 'inline-block', marginTop: 6, padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                        {getRoleLabel(profile.role)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Profile form */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  <Field label="Full Name">
                    <input
                      style={inputBase}
                      type="text"
                      value={profileForm.full_name}
                      onChange={e => setProfileForm(prev => ({ ...prev, full_name: e.target.value }))}
                    />
                  </Field>
                  <Field label="Contact Number">
                    <input
                      style={inputBase}
                      type="text"
                      value={profileForm.contact_number}
                      onChange={e => setProfileForm(prev => ({ ...prev, contact_number: e.target.value }))}
                    />
                  </Field>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
                  {profileSaved && (
                    <span style={{ color: '#10B981', fontSize: 12, fontWeight: 600 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 3 }}>check_circle</span>
                      Saved
                    </span>
                  )}
                  <button
                    onClick={saveProfile}
                    disabled={savingProfile}
                    style={{ padding: '9px 24px', borderRadius: 10, background: PRIMARY, color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: savingProfile ? 'not-allowed' : 'pointer', opacity: savingProfile ? 0.7 : 1, fontFamily: 'inherit' }}
                  >
                    {savingProfile ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </>
            )}
          </SectionCard>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          TAB: Security
      ────────────────────────────────────────────────────────────────────── */}
      {tab === 'Security' && (
        <div style={{ maxWidth: 640 }}>
          <SectionCard title="Security" subtitle="Update your password and security settings." icon="shield">
            <Field label="New Password">
              <input
                style={inputBase}
                type="password"
                placeholder="••••••••"
                value={passForm.newPass}
                onChange={e => setPassForm(prev => ({ ...prev, newPass: e.target.value }))}
              />
            </Field>
            <Field label="Confirm Password">
              <input
                style={inputBase}
                type="password"
                placeholder="••••••••"
                value={passForm.confirmPass}
                onChange={e => setPassForm(prev => ({ ...prev, confirmPass: e.target.value }))}
              />
            </Field>

            {passError && (
              <p style={{ color: '#ef4444', fontSize: 12, fontWeight: 600, marginBottom: 12 }}>{passError}</p>
            )}
            {passSaved && (
              <p style={{ color: '#10B981', fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 3 }}>check_circle</span>
                Password updated successfully.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={updatePassword}
                disabled={savingPass}
                style={{ padding: '9px 24px', borderRadius: 10, background: PRIMARY, color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: savingPass ? 'not-allowed' : 'pointer', opacity: savingPass ? 0.7 : 1, fontFamily: 'inherit' }}
              >
                {savingPass ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          TAB: System Branding
      ────────────────────────────────────────────────────────────────────── */}
      {tab === 'System Branding' && (
        <div style={{ maxWidth: 900 }}>

          {/* ── 1. Company Identity ── */}
          <SectionCard title="Company Identity" icon="apartment">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <Field label="Company Name">
                <input
                  style={inputBase}
                  type="text"
                  value={f.company_name ?? ''}
                  onChange={e => setf('company_name', e.target.value)}
                />
              </Field>

              <div>
                <label style={labelBase}>Company Logo</label>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ width: 68, height: 68, border: '1px solid var(--color-border)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, background: 'var(--color-surface-muted)' }}>
                    {f.company_logo_url ? (
                      <img src={f.company_logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--color-text-muted)' }}>image</span>
                    )}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <label style={{ cursor: 'pointer', padding: '6px 14px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>
                        {logoUploading ? 'Uploading…' : 'Upload File'}
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
                      </label>
                      {f.company_logo_url && (
                        <button
                          onClick={() => setf('company_logo_url', '')}
                          style={{ padding: '6px 12px', background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={logoUrlInput}
                        onChange={e => setLogoUrlInput(e.target.value)}
                        style={{ ...inputBase, height: 34, fontSize: 12 }}
                      />
                      <button
                        onClick={() => {
                          if (logoUrlInput.trim()) {
                            setf('company_logo_url', logoUrlInput.trim());
                            setLogoUrlInput('');
                          }
                        }}
                        style={{ padding: '6px 12px', background: 'var(--color-surface-muted)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', color: 'var(--color-text)' }}
                      >
                        Use Link
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ── 2. Legal Details ── */}
          <SectionCard
            title="Company Legal Details"
            subtitle="These details appear in loan contracts and NCA disclosures."
            icon="gavel"
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Legal Entity Name (Pty) Ltd">
                  <input
                    style={inputBase}
                    type="text"
                    value={f.legal_entity_name ?? ''}
                    onChange={e => setf('legal_entity_name', e.target.value)}
                    placeholder="e.g. AlgoLend Financial Services (Pty) Ltd"
                  />
                </Field>
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: -10, marginBottom: 16 }}>
                  Appears on login page and contracts: "Legal Entity t/a Trading Name".
                </p>
              </div>

              <Field label="NCR Registration Number">
                <input style={inputBase} type="text" value={f.ncr_number ?? ''} onChange={e => setf('ncr_number', e.target.value)} placeholder="NCRCP12345" />
              </Field>
              <Field label="FSP Number">
                <input style={inputBase} type="text" value={f.fsp_number ?? ''} onChange={e => setf('fsp_number', e.target.value)} placeholder="12345" />
              </Field>
              <Field label="Company Registration Number">
                <input style={inputBase} type="text" value={f.company_reg_number ?? ''} onChange={e => setf('company_reg_number', e.target.value)} placeholder="2023/123456/07" />
              </Field>
              <Field label="VAT Number">
                <input style={inputBase} type="text" value={f.company_vat_number ?? ''} onChange={e => setf('company_vat_number', e.target.value)} placeholder="4012345678" />
              </Field>
              <Field label="Branch Code (for contracts)">
                <input style={inputBase} type="text" value={f.provider_branch_code ?? ''} onChange={e => setf('provider_branch_code', e.target.value)} placeholder="ALG" />
              </Field>
              <Field label="Company Phone">
                <input style={inputBase} type="text" value={f.company_phone ?? ''} onChange={e => setf('company_phone', e.target.value)} placeholder="0691195046" />
              </Field>
              <Field label="Physical Address">
                <input style={inputBase} type="text" value={f.company_physical_address ?? ''} onChange={e => setf('company_physical_address', e.target.value)} placeholder="123 Main Street, Johannesburg, 2001" />
              </Field>

              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Postal Address">
                  <input style={inputBase} type="text" value={f.company_postal_address ?? ''} onChange={e => setf('company_postal_address', e.target.value)} placeholder="PO Box 1234, Johannesburg, 2001" />
                </Field>
              </div>
            </div>
          </SectionCard>

          {/* ── 3. NCR Statutory Reporting ── */}
          <SectionCard
            title="NCR Statutory Reporting"
            subtitle="Controls period generation on the NCR Reporting screen (Form 39 & Form 40)."
            icon="assignment"
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Form 39 Submission Frequency">
                <select
                  style={{ ...inputBase, cursor: 'pointer' }}
                  value={f.ncr_submission_frequency ?? 'annually'}
                  onChange={e => setf('ncr_submission_frequency', e.target.value)}
                >
                  <option value="annually">Annually (smaller provider — due 15 Feb)</option>
                  <option value="quarterly">Quarterly (larger provider — Q1–Q4)</option>
                </select>
              </Field>
              <div>
                <Field label="Financial Year-End Month (Form 40)">
                  <select
                    style={{ ...inputBase, cursor: 'pointer' }}
                    value={f.ncr_financial_year_end_month ?? 12}
                    onChange={e => setf('ncr_financial_year_end_month', Number(e.target.value))}
                  >
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </Field>
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: -10 }}>
                  Form 40 is due 6 months after this month.
                </p>
              </div>
            </div>
          </SectionCard>

          {/* ── 4. Company Banking Details ── */}
          <SectionCard
            title="Company Banking Details"
            subtitle="Displayed to clients when they make a manual EFT payment or settle a loan."
            icon="account_balance"
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Bank Name">
                <input style={inputBase} type="text" value={f.company_bank_name ?? ''} onChange={e => setf('company_bank_name', e.target.value)} placeholder="e.g. FNB, ABSA, Standard Bank" />
              </Field>
              <Field label="Account Holder Name">
                <input style={inputBase} type="text" value={f.company_bank_account_holder ?? ''} onChange={e => setf('company_bank_account_holder', e.target.value)} placeholder="e.g. AlgoLend Financial Services" />
              </Field>
              <Field label="Account Number">
                <input style={{ ...inputBase, fontFamily: 'monospace' }} type="text" value={f.company_bank_account_no ?? ''} onChange={e => setf('company_bank_account_no', e.target.value)} placeholder="e.g. 62812345678" />
              </Field>
              <Field label="Branch Code">
                <input style={{ ...inputBase, fontFamily: 'monospace' }} type="text" value={f.company_bank_branch_code ?? ''} onChange={e => setf('company_bank_branch_code', e.target.value)} placeholder="e.g. 250655" />
              </Field>
              <Field label="Account Type">
                <select style={{ ...inputBase, cursor: 'pointer' }} value={f.company_bank_account_type ?? 'current'} onChange={e => setf('company_bank_account_type', e.target.value)}>
                  <option value="current">Current / Cheque</option>
                  <option value="savings">Savings</option>
                  <option value="business">Business</option>
                </select>
              </Field>
              <div>
                <Field label="Payment Reference Prefix">
                  <input style={{ ...inputBase, fontFamily: 'monospace' }} type="text" value={f.company_bank_reference_prefix ?? 'REF'} onChange={e => setf('company_bank_reference_prefix', e.target.value)} placeholder="e.g. ALG" />
                </Field>
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: -10 }}>
                  Client reference = PREFIX-LOANID (e.g. ALG-1001)
                </p>
              </div>
            </div>

            {/* Live Preview */}
            <div style={{ marginTop: 20, background: 'var(--color-surface-muted)', borderRadius: 12, padding: 16, border: '1px solid var(--color-border)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
                Client will see:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 6, columnGap: 16, fontSize: 12 }}>
                {([
                  ['Bank', f.company_bank_name || '—'],
                  ['Account Holder', f.company_bank_account_holder || f.company_name || '—'],
                  ['Account Number', f.company_bank_account_no || '—'],
                  ['Branch Code', f.company_bank_branch_code || '—'],
                  ['Account Type', f.company_bank_account_type || 'current'],
                  ['Reference', `${f.company_bank_reference_prefix || 'REF'}-LOANID`],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} style={{ display: 'contents' }}>
                    <span style={{ color: 'var(--color-text-muted)', paddingBottom: 2 }}>{k}</span>
                    <span style={{ fontWeight: 700, fontFamily: ['Account Number', 'Branch Code', 'Reference'].includes(k) ? 'monospace' : 'inherit' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* ── 5. Theme Colours ── */}
          <SectionCard title="Theme Colours" icon="palette">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
              {[
                { key: 'primary_color',   label: 'Primary Colour',   desc: 'CTAs, highlights, focus states.' },
                { key: 'secondary_color', label: 'Secondary Colour', desc: 'Gradients, hover states, charts.' },
                { key: 'tertiary_color',  label: 'Tertiary Colour',  desc: 'Gradients and subtle accents.' },
              ].map(({ key, label, desc }) => (
                <div key={key}>
                  <label style={labelBase}>{label}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="color"
                      value={f[key] ?? '#000000'}
                      onChange={e => setf(key, e.target.value)}
                      style={{ width: 40, height: 40, borderRadius: 8, border: '1px solid var(--color-border)', cursor: 'pointer', padding: 2, flexShrink: 0 }}
                    />
                    <input
                      type="text"
                      value={f[key] ?? ''}
                      onChange={e => setf(key, e.target.value)}
                      style={{ ...inputBase, fontFamily: 'monospace', textTransform: 'uppercase' }}
                    />
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>{desc}</p>
                </div>
              ))}
            </div>

            {/* Gradient preview */}
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--color-surface-muted)', borderRadius: 10, border: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Preview:</span>
              <div style={{
                flex: 1,
                height: 32,
                borderRadius: 8,
                background: `linear-gradient(90deg, ${f.primary_color || PRIMARY}, ${f.secondary_color || '#1A1F36'}, ${f.tertiary_color || '#A78BFA'})`,
              }} />
            </div>
          </SectionCard>

          {/* ── 6. Login Page Styling ── */}
          <SectionCard
            title="Login Page Styling"
            subtitle="Background wallpaper and overlay tint for the client login screen."
            icon="wallpaper"
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
              {/* Wallpaper */}
              <div>
                <label style={labelBase}>Background Wallpaper</label>
                <div style={{
                  height: 160,
                  borderRadius: 12,
                  border: '1px solid var(--color-border)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                  ...(f.auth_background_url
                    ? {
                        backgroundImage: `url('${f.auth_background_url}')`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        transform: f.auth_background_flip ? 'scaleX(-1)' : 'scaleX(1)',
                      }
                    : { background: 'var(--color-surface-muted)' }),
                }}>
                  {!f.auth_background_url && (
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>Default</span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <label style={{ cursor: 'pointer', padding: '7px 14px', background: PRIMARY, color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>cloud_upload</span>
                      {wallpaperUploading ? 'Uploading…' : 'Upload'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleWallpaperUpload} />
                    </label>
                    {f.auth_background_url && (
                      <button
                        onClick={() => setf('auth_background_url', '')}
                        style={{ padding: '7px 12px', background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={wallpaperUrlInput}
                      onChange={e => setWallpaperUrlInput(e.target.value)}
                      style={{ ...inputBase, height: 34, fontSize: 12 }}
                    />
                    <button
                      onClick={() => {
                        if (wallpaperUrlInput.trim()) {
                          setf('auth_background_url', wallpaperUrlInput.trim());
                          setWallpaperUrlInput('');
                        }
                      }}
                      style={{ padding: '6px 12px', background: 'var(--color-surface-muted)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', color: 'var(--color-text)' }}
                    >
                      Use Link
                    </button>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>
                    <input
                      type="checkbox"
                      checked={!!f.auth_background_flip}
                      onChange={e => setf('auth_background_flip', e.target.checked)}
                    />
                    Flip Horizontal
                  </label>
                </div>
              </div>

              {/* Overlay */}
              <div>
                <label style={labelBase}>Overlay Tint</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <input
                    type="color"
                    value={f.auth_overlay_color ?? '#1E0B3B'}
                    onChange={e => setf('auth_overlay_color', e.target.value)}
                    style={{ width: 40, height: 40, borderRadius: 8, border: '1px solid var(--color-border)', cursor: 'pointer', padding: 2, flexShrink: 0 }}
                  />
                  <input
                    type="text"
                    value={f.auth_overlay_color ?? ''}
                    onChange={e => setf('auth_overlay_color', e.target.value)}
                    style={{ ...inputBase, fontFamily: 'monospace', textTransform: 'uppercase' }}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>
                  <input
                    type="checkbox"
                    checked={!f.auth_overlay_enabled}
                    onChange={e => setf('auth_overlay_enabled', !e.target.checked)}
                  />
                  Disable Overlay
                </label>
              </div>
            </div>
          </SectionCard>

          {/* ── 7. Login Text (Carousel) ── */}
          <SectionCard
            title="Login Text"
            subtitle="The 3 slides shown on the client login page."
            icon="view_carousel"
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              {slides.map((slide, i) => (
                <div
                  key={i}
                  style={{ background: 'var(--color-surface-muted)', borderRadius: 10, padding: 14, border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Slide {i + 1}
                  </span>
                  <input
                    type="text"
                    value={slide.title}
                    placeholder="Title"
                    onChange={e => {
                      const updated = slides.map((s, idx) => idx === i ? { ...s, title: e.target.value } : s);
                      setf('carousel_slides', updated);
                    }}
                    style={{ ...inputBase, fontWeight: 700 }}
                  />
                  <textarea
                    rows={3}
                    value={slide.text}
                    placeholder="Description"
                    onChange={e => {
                      const updated = slides.map((s, idx) => idx === i ? { ...s, text: e.target.value } : s);
                      setf('carousel_slides', updated);
                    }}
                    style={{ ...inputBase, height: 'auto', padding: '8px 12px', resize: 'none', fontSize: 12 }}
                  />
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          TAB: Billing
      ────────────────────────────────────────────────────────────────────── */}
      {tab === 'Billing' && (
        <div style={{ maxWidth: 900 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <SectionCard title="Add Payment Method" icon="credit_card">
              <form onSubmit={addCard} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Card Type">
                  <select
                    style={{ ...inputBase, cursor: 'pointer' }}
                    value={cardForm.card_type}
                    onChange={e => setCardForm(prev => ({ ...prev, card_type: e.target.value }))}
                  >
                    <option value="visa">Visa</option>
                    <option value="mastercard">Mastercard</option>
                  </select>
                </Field>
                <Field label="Last 4 Digits">
                  <input
                    style={inputBase}
                    type="text"
                    maxLength={4}
                    placeholder="1234"
                    value={cardForm.last_four}
                    onChange={e => setCardForm(prev => ({ ...prev, last_four: e.target.value }))}
                  />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="Expiry Month">
                    <input
                      style={inputBase}
                      type="text"
                      maxLength={2}
                      placeholder="MM"
                      value={cardForm.expiry_month}
                      onChange={e => setCardForm(prev => ({ ...prev, expiry_month: e.target.value }))}
                    />
                  </Field>
                  <Field label="Expiry Year">
                    <input
                      style={inputBase}
                      type="text"
                      maxLength={4}
                      placeholder="YYYY"
                      value={cardForm.expiry_year}
                      onChange={e => setCardForm(prev => ({ ...prev, expiry_year: e.target.value }))}
                    />
                  </Field>
                </div>
                <button
                  type="submit"
                  disabled={cardSaving}
                  style={{ width: '100%', padding: '10px', borderRadius: 10, background: PRIMARY, color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: cardSaving ? 'not-allowed' : 'pointer', opacity: cardSaving ? 0.7 : 1, fontFamily: 'inherit' }}
                >
                  {cardSaving ? 'Adding…' : 'Add Card'}
                </button>
              </form>
            </SectionCard>

            <SectionCard title="Saved Cards" icon="wallet">
              {cardsLoading ? (
                <div style={{ padding: 20, textAlign: 'center' }}>
                  <div className="spinner" style={{ margin: '0 auto' }} />
                </div>
              ) : cards.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No payment methods saved yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {cards.map((card: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--color-surface-muted)', borderRadius: 10, border: '1px solid var(--color-border)' }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)', fontSize: 20 }}>credit_card</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>•••• {card.last_four}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                          {card.card_type?.toUpperCase()} — Exp: {card.expiry_month}/{card.expiry_year}
                        </div>
                      </div>
                      {card.is_default && (
                        <span style={{ fontSize: 10, background: '#d1fae5', color: '#059669', padding: '2px 8px', borderRadius: 999, fontWeight: 700, textTransform: 'uppercase' }}>
                          Default
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          TAB: User Management
      ────────────────────────────────────────────────────────────────────── */}
      {tab === 'User Management' && (
        <div style={{ maxWidth: 900 }}>
          <SectionCard title="User Management" subtitle="Manage permissions and roles for all staff and clients." icon="manage_accounts">
            {/* Info banner */}
            <div style={{ background: 'rgba(109,40,217,0.05)', border: '1px solid rgba(109,40,217,0.15)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span className="material-symbols-outlined" style={{ color: PRIMARY, fontSize: 18, marginTop: 1, flexShrink: 0 }}>info</span>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text)', lineHeight: 1.5 }}>
                Search for users, view their system roles, and promote or demote them. Role changes take effect immediately on their next session.
              </p>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 16, maxWidth: 320 }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--color-text-muted)' }}>
                search
              </span>
              <input
                type="text"
                placeholder="Search by name, email or ID…"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                style={{ ...inputBase, paddingLeft: 36 }}
              />
            </div>

            <div style={{ borderRadius: 10, border: '1px solid var(--color-border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ background: 'var(--color-surface-muted)' }}>
                  <tr>
                    {['User', 'System ID', 'Role', 'Action'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Action' ? 'right' : 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usersLoading ? (
                    <tr>
                      <td colSpan={4} style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <div className="spinner" style={{ margin: '0 auto 10px' }} />
                        Loading users…
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: 28, textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        {userSearch ? 'No users match your search.' : 'No users found.'}
                      </td>
                    </tr>
                  ) : filteredUsers.map((user: any) => {
                    const badge = getRoleBadge(user.role ?? 'borrower');
                    return (
                      <tr key={user.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(109,40,217,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: PRIMARY, flexShrink: 0 }}>
                              {(user.full_name ?? 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700 }}>{user.full_name ?? 'Unknown'}</div>
                              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{user.email ?? ''}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <code style={{ fontSize: 11, color: 'var(--color-text-muted)', background: 'var(--color-surface-muted)', padding: '2px 6px', borderRadius: 4 }}>
                            {(user.id ?? '').substring(0, 8)}…
                          </code>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ ...badge, padding: '2px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                            {getRoleLabel(user.role ?? 'borrower')}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button
                            onClick={() => {
                              setRoleModal({ userId: user.id, userName: user.full_name ?? 'User', currentRole: user.role ?? 'borrower' });
                              setNewRole(user.role ?? 'borrower');
                            }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', background: 'var(--color-surface-muted)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--color-text)', fontFamily: 'inherit' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>manage_accounts</span>
                            Change Role
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!usersLoading && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'right' }}>
                Showing {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          TAB: Roles & Permissions
      ────────────────────────────────────────────────────────────────────── */}
      {tab === 'Roles & Permissions' && (
        <div style={{ maxWidth: 900 }}>
          <SectionCard title="System Roles" subtitle="Access levels and permissions for staff members." icon="admin_panel_settings">
            <div style={{ borderRadius: 10, border: '1px solid var(--color-border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ background: 'var(--color-surface-muted)' }}>
                  <tr>
                    {['Role Name', 'Users', 'Permissions', 'Status'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'Super Admin',  users: 1,  perm: 'Full Access',       permColor: '#6D28D9', permBg: 'rgba(109,40,217,0.1)' },
                    { name: 'Branch Admin', users: 4,  perm: 'Approve / Decline', permColor: '#2563EB', permBg: 'rgba(37,99,235,0.1)' },
                    { name: 'Loan Officer', users: 12, perm: 'Read & Review',     permColor: '#64748B', permBg: 'rgba(100,116,139,0.1)' },
                  ].map(row => (
                    <tr key={row.name} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text)' }}>{row.name}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)' }}>{row.users}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: row.permBg, color: row.permColor, padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                          {row.perm}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: '#d1fae5', color: '#059669', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          TAB: Audit Logs
      ────────────────────────────────────────────────────────────────────── */}
      {tab === 'Audit Logs' && (
        <div style={{ maxWidth: 900 }}>
          <SectionCard
            title="Audit Logs"
            subtitle="Security and compliance event tracking."
            icon="history"
            headerRight={
              <button
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface-card, #fff)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--color-text)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span>
                Export CSV
              </button>
            }
          >
            <div style={{ borderRadius: 10, border: '1px solid var(--color-border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ background: 'var(--color-surface-muted)' }}>
                  <tr>
                    {['Timestamp', 'User', 'Event', 'IP Address'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontFamily: 'monospace', fontSize: 12 }}>
                      {new Date().toLocaleDateString('en-ZA')} {new Date().toLocaleTimeString('en-ZA')}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700 }}>Admin User</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: 'rgba(37,99,235,0.1)', color: '#2563EB', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                        Settings Updated
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontFamily: 'monospace', fontSize: 12 }}>
                      192.168.1.1
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: 12, fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center' }}>
              Full audit log integration coming soon. Events are stored in the database.
            </p>
          </SectionCard>
        </div>
      )}

      {/* ── Role Change Modal ───────────────────────────────────────────────── */}
      {roleModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setRoleModal(null); }}
        >
          <div style={{ background: 'var(--color-surface-card, #fff)', borderRadius: 16, padding: 28, width: 400, maxWidth: '92vw', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>
              Change User Role
            </h3>
            <div style={{ background: 'rgba(109,40,217,0.05)', border: '1px solid rgba(109,40,217,0.15)', borderRadius: 10, padding: '10px 14px', marginBottom: 18, fontSize: 13 }}>
              <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{roleModal.userName}</div>
              <div style={{ color: 'var(--color-text-muted)', marginTop: 2 }}>
                Current role: {getRoleLabel(roleModal.currentRole)}
              </div>
            </div>

            <label style={labelBase}>New Role</label>
            <select
              style={{ ...inputBase, cursor: 'pointer', marginBottom: 20 }}
              value={newRole}
              onChange={e => setNewRole(e.target.value)}
            >
              <option value="borrower">Client (Borrower)</option>
              <option value="base_admin">Loan Officer (Base Admin)</option>
              <option value="admin">Branch Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setRoleModal(null)}
                style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--color-text)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleRoleChange}
                disabled={changingRole}
                style={{ padding: '8px 20px', borderRadius: 8, background: PRIMARY, color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: changingRole ? 'not-allowed' : 'pointer', opacity: changingRole ? 0.7 : 1, fontFamily: 'inherit' }}
              >
                {changingRole ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
