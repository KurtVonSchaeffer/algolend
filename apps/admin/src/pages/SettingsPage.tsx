import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchSystemSettings, updateSystemSettings } from '../services/adminData';
import { UsersPage } from './UsersPage';

const TABS = ['Branding', 'Theme', 'Auth Page', 'Legal', 'User Management'];

const DEFAULT_FORM = {
  company_name: '',
  company_logo_url: '',
  primary_color: '#7C3AED',
  secondary_color: '#1A1F36',
  tertiary_color: '#A78BFA',
  theme_mode: 'light',
  auth_background_url: '',
  auth_overlay_color: '#1E0B3B',
  auth_overlay_enabled: true,
  auth_background_flip: false,
  legal_entity_name: '',
  company_reg_name: '',
  fsp_number: '',
  ncr_number: '',
};

export function SettingsPage({ section = 'general' }: { section?: 'general' | 'user-management' }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState(section === 'user-management' ? 'User Management' : 'Branding');
  const [form, setForm] = useState<Record<string, any> | null>(null);
  const [saved, setSaved] = useState(false);

  const { isLoading, data: settingsResult } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: fetchSystemSettings,
    staleTime: 60_000,
  });

  // Set form once query completes — fall back to defaults if no DB row exists
  useEffect(() => {
    if (!isLoading && !form) {
      setForm(settingsResult?.data ?? DEFAULT_FORM);
    }
  }, [isLoading, settingsResult, form]);

  const mutation = useMutation({
    mutationFn: (data: Record<string, any>) => updateSystemSettings(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-settings'] });
      qc.invalidateQueries({ queryKey: ['system-settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const set = (key: string, value: unknown) => setForm((f: any) => ({ ...f, [key]: value }));

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}><div className="spinner" /></div>;
  }
  if (!form) return null;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Platform configuration and branding</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {saved && <span style={{ color: '#10B981', fontWeight: 600, fontSize: 13 }}>✓ Saved successfully</span>}
          <button
            className="btn btn-primary"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(form)}
          >
            {mutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="tab-bar">
        {TABS.map(t => <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === 'Branding' && (
        <div className="chart-card" style={{ maxWidth: 600 }}>
          <p className="chart-title">Company Branding</p>
          {[
            { label: 'Company Name', key: 'company_name', type: 'text' },
            { label: 'Logo URL', key: 'company_logo_url', type: 'url' },
            { label: 'Legal Entity Name', key: 'legal_entity_name', type: 'text' },
            { label: 'Company Reg Name', key: 'company_reg_name', type: 'text' },
            { label: 'FSP Number', key: 'fsp_number', type: 'text' },
            { label: 'NCR Number', key: 'ncr_number', type: 'text' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>{f.label}</label>
              <input
                className="admin-input"
                type={f.type}
                value={form[f.key] ?? ''}
                onChange={e => set(f.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      {tab === 'Theme' && (
        <div className="chart-card" style={{ maxWidth: 600 }}>
          <p className="chart-title">Colours &amp; Theme</p>
          {[
            { label: 'Primary Colour', key: 'primary_color' },
            { label: 'Secondary Colour', key: 'secondary_color' },
            { label: 'Tertiary Colour', key: 'tertiary_color' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="color" value={form[f.key] ?? '#000000'} onChange={e => set(f.key, e.target.value)}
                style={{ width: 44, height: 44, border: '1px solid var(--color-border)', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>{f.label}</label>
                <input className="admin-input" type="text" value={form[f.key] ?? ''} onChange={e => set(f.key, e.target.value)} />
              </div>
            </div>
          ))}
          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>Theme Mode</label>
            <select className="admin-select" value={form.theme_mode ?? 'dark'} onChange={e => set('theme_mode', e.target.value)}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>
      )}

      {tab === 'Auth Page' && (
        <div className="chart-card" style={{ maxWidth: 600 }}>
          <p className="chart-title">Login Page Appearance</p>
          {[
            { label: 'Background Image URL', key: 'auth_background_url', type: 'url' },
            { label: 'Overlay Colour', key: 'auth_overlay_color', type: 'color' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>{f.label}</label>
              {f.type === 'color'
                ? <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <input type="color" value={form[f.key] ?? '#000000'} onChange={e => set(f.key, e.target.value)}
                      style={{ width: 44, height: 44, border: '1px solid var(--color-border)', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                    <input className="admin-input" type="text" value={form[f.key] ?? ''} onChange={e => set(f.key, e.target.value)} />
                  </div>
                : <input className="admin-input" type={f.type} value={form[f.key] ?? ''} onChange={e => set(f.key, e.target.value)} />
              }
            </div>
          ))}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={!!form.auth_overlay_enabled} onChange={e => set('auth_overlay_enabled', e.target.checked)} />
              Enable overlay
            </label>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={!!form.auth_background_flip} onChange={e => set('auth_background_flip', e.target.checked)} />
              Flip background image
            </label>
          </div>
        </div>
      )}

      {tab === 'Legal' && (
        <div className="chart-card" style={{ maxWidth: 600 }}>
          <p className="chart-title">Legal &amp; Compliance Info</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
            These values appear in compliance reports and regulatory submissions.
          </p>
          {[
            { label: 'FSP Number', key: 'fsp_number' },
            { label: 'NCR Number', key: 'ncr_number' },
            { label: 'Legal Entity Name', key: 'legal_entity_name' },
            { label: 'Company Reg Name', key: 'company_reg_name' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>{f.label}</label>
              <input className="admin-input" type="text" value={form[f.key] ?? ''} onChange={e => set(f.key, e.target.value)} />
            </div>
          ))}
        </div>
      )}

      {tab === 'User Management' && (
        <UsersPage embedded title="User Management" />
      )}
    </>
  );
}
