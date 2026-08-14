import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMandates } from '../services/adminData';

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatCurrency = (value: number | string | null | undefined): string => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'R 0.00';
  return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (value: string | null | undefined): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// ── Status theme ───────────────────────────────────────────────────────────────

const STATUS_THEME: Record<string, { bg: string; color: string; border: string; icon: string; label: string }> = {
  success: { bg: '#d1fae5', color: '#065f46', border: '#a7f3d0', icon: 'check_circle', label: 'Active' },
  failed:  { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', icon: 'cancel',       label: 'Failed' },
  pending: { bg: '#fef3c7', color: '#92400e', border: '#fde68a', icon: 'schedule',     label: 'Awaiting bank' },
  unknown: { bg: '#f3f4f6', color: '#374151', border: '#e5e7eb', icon: 'help',         label: 'Unknown' },
};

const getStatusTheme = (status: string) =>
  STATUS_THEME[(status || 'unknown').toLowerCase()] ?? STATUS_THEME.unknown;

// ── Friendly error mapping ─────────────────────────────────────────────────────

const MANDATE_ERROR_MAP: [RegExp, string][] = [
  [/account.not.found|invalid.account/i,   "The client's bank account number was not found. Please ask them to check their account details and update."],
  [/insufficient.funds|no.funds/i,          'The account did not have enough funds when we tried. Please try again or contact the client.'],
  [/account.closed|closed.account/i,        'This bank account is closed. Please ask the client to provide a new account.'],
  [/wrong.branch|invalid.branch/i,          'The branch code does not match the selected bank. Please update the bank details.'],
  [/not.authenticated|authentication.failed/i, "The client's bank needs to approve this. This usually happens within 1–2 business days."],
  [/duplicate/i,                            'A debit order for this client already exists.'],
  [/config|credentials|503|unavailable/i,   'We could not reach the payment provider right now. Please try again in a few minutes.'],
];

function mandateFriendlyError(raw: string | null | undefined): string {
  if (!raw) return '';
  for (const [pattern, msg] of MANDATE_ERROR_MAP) {
    if (pattern.test(raw)) return msg;
  }
  return raw;
}

// ── Avatar ─────────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'rgba(109,40,217,0.1)', color: '#6D28D9',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size < 36 ? 11 : 13, flexShrink: 0,
    }}>
      {getInitials(name)}
    </div>
  );
}

// ── Action button ──────────────────────────────────────────────────────────────

function ActionBtn({
  label, icon, loading = false, onClick, danger = false, primary = false,
}: {
  label: string; icon: string; loading?: boolean; onClick: () => void;
  danger?: boolean; primary?: boolean;
}) {
  const bg     = danger ? '#fee2e2' : primary ? '#6D28D9' : '#f3f4f6';
  const color  = danger ? '#991b1b' : primary ? '#fff'    : '#374151';
  const border = danger ? '#fca5a5' : primary ? '#6D28D9' : '#e5e7eb';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
        background: bg, color, border: `1px solid ${border}`,
        cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
        fontFamily: 'inherit', whiteSpace: 'nowrap',
      }}>
      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
        {loading ? 'hourglass_empty' : icon}
      </span>
      {loading ? '…' : label}
    </button>
  );
}

// ── API helper ─────────────────────────────────────────────────────────────────

async function apiPost(path: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.success === false) {
    throw new Error(payload.error || payload.message || `Request failed (${res.status})`);
  }
  return payload;
}

// ── Filter tabs ────────────────────────────────────────────────────────────────

const FILTERS = [
  { key: 'all',     label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'success', label: 'Active' },
  { key: 'failed',  label: 'Failed' },
] as const;

// ── Health banner ──────────────────────────────────────────────────────────────

function HealthBanner({ config }: { config: any }) {
  const ok = Boolean(config?.configured);
  return (
    <div style={{
      marginBottom: 24, borderRadius: 16, padding: '16px 20px',
      border: `1px solid ${ok ? '#a7f3d0' : '#fca5a5'}`,
      background: ok ? '#d1fae5' : '#fee2e2',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 24, color: ok ? '#059669' : '#dc2626', flexShrink: 0 }}>
        {ok ? 'check_circle' : 'cancel'}
      </span>
      <div>
        <p style={{ fontWeight: 700, fontSize: 13, color: ok ? '#065f46' : '#991b1b', margin: 0 }}>
          {ok ? 'Bank connection is ready' : 'Bank connection is not set up'}
        </p>
        <p style={{ fontSize: 12, color: ok ? '#047857' : '#b91c1c', margin: '2px 0 0' }}>
          {ok
            ? 'Debit mandates can be submitted and collected normally.'
            : 'Mandates cannot be submitted until this is resolved — contact your system administrator.'}
        </p>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function MandatesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch]           = useState('');
  const [filter, setFilter]           = useState<string>('all');
  const [selected, setSelected]       = useState<any>(null);
  const [toast, setToast]             = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [loadingSure, setLoadingSure] = useState(false);
  const [downloading, setDownloading] = useState(false);

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-mandates'],
    queryFn: fetchMandates,
    staleTime: 60_000,
  });

  const { data: configData } = useQuery({
    queryKey: ['suresystems-config'],
    queryFn: async () => {
      const res = await fetch('/api/suresystems/config');
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 300_000,
    retry: false,
  });

  const mandates: any[] = data?.data ?? [];
  const total   = mandates.length;
  const success = mandates.filter(m => (m.status ?? '').toLowerCase() === 'success').length;
  const failed  = mandates.filter(m => (m.status ?? '').toLowerCase() === 'failed').length;
  const pending = total - success - failed;

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return mandates.filter(m => {
      const status = (m.status || 'unknown').toLowerCase();
      if (filter !== 'all' && status !== filter) return false;
      if (!term) return true;
      return [m.profiles?.full_name, m.profiles?.email, m.contract_reference, m.application_id, m.message]
        .filter(Boolean).join(' ').toLowerCase().includes(term);
    });
  }, [mandates, search, filter]);

  async function handleLoadFromSureSystems() {
    setLoadingSure(true);
    try {
      const res  = await fetch('/api/admin/mandates/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(json.error || 'Load failed', 'error'); return; }
      showToast(json.message || 'Mandates loaded', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-mandates'] });
    } catch (err: any) {
      showToast(err.message || 'Failed to load mandates', 'error');
    } finally {
      setLoadingSure(false);
    }
  }

  async function handleDownloadCollections() {
    setDownloading(true);
    try {
      const result  = await apiPost('/api/suresystems/payments/download', { frontEndUserName: 'webuser' });
      const content = result.content || result.data || result.fileContent;
      if (content) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url  = URL.createObjectURL(blob);
        const a    = Object.assign(document.createElement('a'), {
          href: url, download: `collections-${new Date().toISOString().slice(0, 10)}.txt`,
        });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Collection report downloaded', 'success');
      } else {
        showToast('Report downloaded — check your bank portal for the file', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Download failed', 'error');
    } finally {
      setDownloading(false);
    }
  }

  const kpiCards = [
    { label: 'Total',        value: total,   icon: 'description', bg: '#fff',     border: '#e5e7eb', textColor: '#111827' },
    { label: 'Active',       value: success, icon: 'check_circle',bg: '#d1fae5',  border: '#a7f3d0', textColor: '#065f46' },
    { label: 'Awaiting bank',value: pending, icon: 'schedule',    bg: '#fef3c7',  border: '#fde68a', textColor: '#92400e' },
    { label: 'Failed',       value: failed,  icon: 'cancel',      bg: '#fee2e2',  border: '#fca5a5', textColor: '#991b1b' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: 'fadeIn 0.3s ease' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 99999,
          background: toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#ef4444' : '#3b82f6',
          color: '#fff', padding: '12px 20px', borderRadius: 12, fontWeight: 600, fontSize: 13,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', gap: 8, maxWidth: 380,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
          </span>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>Debit Mandates</h1>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginTop: 4 }}>
            Manage monthly debit collection for client loans.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={handleDownloadCollections} disabled={downloading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, background: '#fff', color: 'var(--color-text)', fontWeight: 600, fontSize: 13, border: '1px solid var(--color-border)', cursor: downloading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: downloading ? 0.7 : 1 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>
              {downloading ? 'hourglass_empty' : 'download'}
            </span>
            {downloading ? 'Downloading…' : 'Download report'}
          </button>
          <button type="button" onClick={handleLoadFromSureSystems} disabled={loadingSure}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, background: '#6D28D9', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: loadingSure ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loadingSure ? 0.7 : 1 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>
              {loadingSure ? 'hourglass_empty' : 'cloud_download'}
            </span>
            {loadingSure ? 'Loading…' : 'Load from SureSystems'}
          </button>
          <button type="button" onClick={() => refetch()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, background: '#fff', color: 'var(--color-text)', fontWeight: 600, fontSize: 13, border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'inherit' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {/* Health banner — only render when we have a real response */}
      {configData !== undefined && configData !== null && (
        <HealthBanner config={configData} />
      )}

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {kpiCards.map(c => (
          <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 20, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: c.textColor, opacity: 0.6, margin: 0 }}>{c.label}</p>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: c.textColor, opacity: 0.4 }}>{c.icon}</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: c.textColor }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="glass-card" style={{ borderRadius: 24, overflow: 'hidden', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Toolbar */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>Mandate History</h2>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>Click a row to check status or cancel.</p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--color-text-muted)' }}>search</span>
                <input
                  type="text"
                  placeholder="Search client or reference…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ height: 38, paddingLeft: 34, paddingRight: 12, borderRadius: 10, border: '1px solid var(--color-border)', fontSize: 13, fontFamily: 'inherit', width: 240, background: 'var(--color-surface-muted)', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {FILTERS.map(f => (
                  <button key={f.key} type="button" onClick={() => setFilter(f.key)}
                    style={{
                      padding: '6px 14px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                      border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                      background: filter === f.key ? '#111827' : '#f3f4f6',
                      color:      filter === f.key ? '#fff'    : '#6b7280',
                    }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Table body */}
        <div style={{ overflowX: 'auto', flex: 1 }}>
          {isLoading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              Loading mandates…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '64px 24px', textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%', background: '#f3f4f6', marginBottom: 16 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#9ca3af' }}>folder_open</span>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 4px' }}>No mandates yet</h3>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>Mandates will appear here once they have been submitted.</p>
            </div>
          ) : (
            <table style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--color-surface-muted)', position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  {['Client', 'Status', 'Loan Amount', 'Last Updated', ''].map(h => (
                    <th key={h} style={{ padding: '12px 24px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item: any) => {
                  const theme  = getStatusTheme(item.status);
                  const name   = item.profiles?.full_name || 'Unknown client';
                  const amount = item.loan_applications?.amount != null ? formatCurrency(item.loan_applications.amount) : '—';
                  const errMsg = mandateFriendlyError(item.message);
                  return (
                    <tr key={item.id}
                      style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'background 0.15s' }}
                      onClick={() => setSelected(item)}
                      onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-muted)'; }}
                      onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>

                      {/* Client */}
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Avatar name={name} />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text)' }}>{name}</div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                              {item.application_id ? `App #${item.application_id}` : (item.profiles?.email ?? '')}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                          background: theme.bg, color: theme.color, border: `1px solid ${theme.border}`,
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{theme.icon}</span>
                          {theme.label}
                        </span>
                        {errMsg && (
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={errMsg}>
                            {errMsg}
                          </div>
                        )}
                      </td>

                      {/* Loan Amount */}
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text)' }}>{amount}</div>
                        <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-muted)', marginTop: 2 }}>
                          {item.contract_reference || '—'}
                        </div>
                      </td>

                      {/* Last Updated */}
                      <td style={{ padding: '16px 24px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                        {formatDate(item.updated_at)}
                      </td>

                      {/* Chevron */}
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#d1d5db' }}>chevron_right</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>
            Showing {filtered.length} mandate{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <MandateModal
          mandate={selected}
          onClose={() => setSelected(null)}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['admin-mandates'] })}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ── Mandate detail modal ───────────────────────────────────────────────────────

function MandateModal({
  mandate, onClose, onRefresh, showToast,
}: {
  mandate: any;
  onClose: () => void;
  onRefresh: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const name   = mandate.profiles?.full_name || 'Unknown';
  const amount = mandate.loan_applications?.amount != null ? formatCurrency(mandate.loan_applications.amount) : '—';
  const ref    = mandate.contract_reference || '';
  const hasRef = Boolean(ref);
  const isFailed = (mandate.status || '').toLowerCase() === 'failed';
  const theme    = getStatusTheme(mandate.status);
  const errMsg   = mandateFriendlyError(mandate.message);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Schedule / date-list state
  const [scheduleItems, setScheduleItems] = useState<any[] | null>(null);
  const [dateList, setDateList]           = useState<any[] | null>(null);
  const [scheduleError, setScheduleError] = useState('');
  const [showResults, setShowResults]     = useState(false);

  // Sub-form state
  const [showChangeDate, setShowChangeDate]     = useState(false);
  const [showCancelPmt, setShowCancelPmt]       = useState(false);
  const [changeDateInst, setChangeDateInst]     = useState('');
  const [changeDateVal, setChangeDateVal]       = useState('');
  const [cancelInstNo, setCancelInstNo]         = useState('');

  // TT3 state
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const drawingRef     = useRef(false);
  const lastXRef       = useRef(0);
  const lastYRef       = useRef(0);
  const [tt3B64, setTt3B64]       = useState<string | null>(null);
  const [tt3Mime, setTt3Mime]     = useState('image/png');
  const [tt3FileName, setTt3FileName] = useState('');

  // Init signature canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    function getPos(e: MouseEvent | TouchEvent): [number, number] {
      if (!canvas) return [0, 0];
      const rect = canvas.getBoundingClientRect();
      const src  = 'touches' in e ? e.touches[0] : e as MouseEvent;
      return [
        (src.clientX - rect.left) * (canvas.width / rect.width),
        (src.clientY - rect.top)  * (canvas.height / rect.height),
      ];
    }
    const start = (e: MouseEvent | TouchEvent) => {
      e.preventDefault(); drawingRef.current = true;
      [lastXRef.current, lastYRef.current] = getPos(e);
    };
    const draw = (e: MouseEvent | TouchEvent) => {
      if (!drawingRef.current) return; e.preventDefault();
      const [x, y] = getPos(e);
      ctx.beginPath(); ctx.moveTo(lastXRef.current, lastYRef.current); ctx.lineTo(x, y); ctx.stroke();
      lastXRef.current = x; lastYRef.current = y;
    };
    const stop = () => { drawingRef.current = false; };

    canvas.addEventListener('mousedown',  start);
    canvas.addEventListener('mousemove',  draw);
    canvas.addEventListener('mouseup',    stop);
    canvas.addEventListener('mouseleave', stop);
    canvas.addEventListener('touchstart', start as EventListener, { passive: false });
    canvas.addEventListener('touchmove',  draw  as EventListener, { passive: false });
    canvas.addEventListener('touchend',   stop);
    return () => {
      canvas.removeEventListener('mousedown',  start);
      canvas.removeEventListener('mousemove',  draw);
      canvas.removeEventListener('mouseup',    stop);
      canvas.removeEventListener('mouseleave', stop);
      canvas.removeEventListener('touchstart', start as EventListener);
      canvas.removeEventListener('touchmove',  draw  as EventListener);
      canvas.removeEventListener('touchend',   stop);
    };
  }, []);

  function clearSignature() {
    canvasRef.current?.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setTt3B64(null); setTt3FileName('');
  }

  function isCanvasBlank(): boolean {
    const canvas = canvasRef.current;
    if (!canvas) return true;
    return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data.every((v, i) => i % 4 === 3 ? v === 0 : true);
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function runStatusAction(mode: 'finalfate' | 'enquiry') {
    if (!hasRef) { showToast('This mandate has no reference number yet.', 'error'); return; }
    setActionLoading(mode);
    try {
      await apiPost('/api/suresystems/mandates/check-status', {
        applicationId: mandate.application_id ?? null,
        contractReference: ref,
        frontEndUserName: mandate.profiles?.email || 'webuser',
        mode,
      });
      showToast('Status updated', 'success');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Status check failed', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancelMandate() {
    if (!hasRef) { showToast('This mandate has no reference number to cancel.', 'error'); return; }
    setActionLoading('cancel');
    try {
      await apiPost('/api/suresystems/mandates/cancel-record', {
        applicationId: mandate.application_id ?? null,
        contractReference: ref,
        frontEndUserName: mandate.profiles?.email || 'webuser',
      });
      showToast('Mandate cancelled', 'success');
      onClose(); onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Cancel failed', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRetry() {
    if (!mandate.application_id) return;
    setActionLoading('retry');
    try {
      const res = await apiPost('/api/suresystems/activate-application', { applicationId: mandate.application_id });
      if (res.success) { showToast('Mandate activated successfully', 'success'); onClose(); onRefresh(); }
      else throw new Error(res.error || 'Activation failed');
    } catch (err: any) {
      showToast(`Retry failed: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleGetSchedule() {
    setActionLoading('schedule'); setScheduleError(''); setDateList(null);
    try {
      const result = await apiPost('/api/suresystems/installments/batch/installment', {
        contractReference: ref, frontEndUserName: mandate.profiles?.email || 'webuser',
      });
      setScheduleItems(result.installment || result.installments || result.data || []);
      setShowResults(true);
    } catch (err: any) {
      setScheduleError(err.message || 'Could not load schedule'); setShowResults(true);
    } finally { setActionLoading(null); }
  }

  async function handleGetDateList() {
    setActionLoading('datelist'); setScheduleError(''); setScheduleItems(null);
    try {
      const result = await apiPost('/api/suresystems/mandates/datelist', {
        contractReference: ref, frontEndUserName: mandate.profiles?.email || 'webuser',
      });
      setDateList(result.dateList || result.dates || result.data || []);
      setShowResults(true);
    } catch (err: any) {
      setScheduleError(err.message || 'Could not load date list'); setShowResults(true);
    } finally { setActionLoading(null); }
  }

  async function handleUpdateDate() {
    if (!changeDateInst || !changeDateVal) { showToast('Please fill in all fields.', 'error'); return; }
    setActionLoading('change-date');
    try {
      await apiPost('/api/suresystems/installments/batch/update', {
        frontEndUserName: mandate.profiles?.email || 'webuser',
        installments: [{ contractReference: ref, installmentNo: Number(changeDateInst), collectionDate: changeDateVal.replace(/-/g, '') }],
      });
      showToast(`Payment #${changeDateInst} date updated`, 'success');
      setShowChangeDate(false);
    } catch (err: any) {
      showToast(err.message || 'Update failed', 'error');
    } finally { setActionLoading(null); }
  }

  async function handleCancelInstallment() {
    if (!cancelInstNo) { showToast('Please enter a payment number.', 'error'); return; }
    setActionLoading('cancel-inst');
    try {
      await apiPost('/api/suresystems/installments/cancel', {
        contractReference: ref, installmentNo: Number(cancelInstNo), frontEndUserName: mandate.profiles?.email || 'webuser',
      });
      showToast(`Payment #${cancelInstNo} cancelled`, 'success');
      setShowCancelPmt(false);
    } catch (err: any) {
      showToast(err.message || 'Cancel failed', 'error');
    } finally { setActionLoading(null); }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const result = ev.target?.result as string;
      const ci = result.indexOf(',');
      setTt3B64(ci >= 0 ? result.slice(ci + 1) : result);
      setTt3Mime(file.type || 'image/png');
      setTt3FileName(file.name);
      canvasRef.current?.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmitTT3() {
    if (!hasRef) { showToast('No contract reference for this mandate.', 'error'); return; }
    let signatureImageBase64 = tt3B64;
    let signatureMimeType    = tt3Mime || 'image/png';
    if (!signatureImageBase64) {
      if (isCanvasBlank()) { showToast("Please draw or upload the client's signature before submitting.", 'error'); return; }
      signatureImageBase64 = canvasRef.current!.toDataURL('image/png').split(',')[1];
    }
    setActionLoading('tt3');
    try {
      await apiPost('/api/suresystems/mandates/tt3-signature', {
        contractReference: ref, frontEndUserName: mandate.profiles?.email || 'webuser',
        signatureImageBase64, signatureMimeType,
      });
      showToast('TT3 signature submitted successfully', 'success');
      clearSignature(); onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Signature submission failed', 'error');
    } finally { setActionLoading(null); }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 38, padding: '0 12px', border: '1px solid #e5e7eb',
    borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 24, width: '100%', maxWidth: 560,
          boxShadow: '0 32px 80px rgba(0,0,0,0.22)', maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {/* Modal header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={name} size={40} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{name}</div>
              {mandate.application_id && <div style={{ fontSize: 11, color: '#9ca3af' }}>App #{mandate.application_id}</div>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#6b7280' }}>close</span>
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Status banner */}
          <div style={{ padding: 16, borderRadius: 16, background: theme.bg, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: theme.color, marginTop: 1, flexShrink: 0 }}>{theme.icon}</span>
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: theme.color, margin: 0 }}>{theme.label}</p>
              <p style={{ fontSize: 12, color: theme.color, margin: '4px 0 0', opacity: 0.9 }}>
                {errMsg || 'No further details from the bank.'}
              </p>
            </div>
          </div>

          {/* Detail grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {([
              ['Client',       name],
              ['Loan amount',  amount],
              ['Reference',    ref || '—'],
              ['Last updated', formatDate(mandate.updated_at)],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} style={{ background: '#f9fafb', border: '1px solid #f0f0f0', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', fontFamily: label === 'Reference' ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Main action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {hasRef && <>
              <ActionBtn label="Check Fate"     icon="manage_search" loading={actionLoading === 'finalfate'} onClick={() => runStatusAction('finalfate')} />
              <ActionBtn label="Run Enquiry"    icon="query_stats"   loading={actionLoading === 'enquiry'}   onClick={() => runStatusAction('enquiry')} />
              <ActionBtn label="Cancel Mandate" icon="cancel"        loading={actionLoading === 'cancel'}    onClick={handleCancelMandate} danger />
            </>}
            {isFailed && (
              <ActionBtn label="Retry Activation" icon="refresh" loading={actionLoading === 'retry'} onClick={handleRetry} primary />
            )}
          </div>

          {/* Open application */}
          {mandate.application_id && (
            <a href={`/applications/${mandate.application_id}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#6D28D9', color: '#fff', padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 600, textDecoration: 'none', alignSelf: 'flex-start' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
              Open Application
            </a>
          )}

          {/* Installments section */}
          {hasRef && (
            <div style={{ border: '1px solid #f0f0f0', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', background: '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: '#374151', margin: 0 }}>Installment Management</p>
              </div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <ActionBtn label="View Schedule"      icon="calendar_month" loading={actionLoading === 'schedule'} onClick={handleGetSchedule} />
                  <ActionBtn label="View Date List"     icon="event_note"     loading={actionLoading === 'datelist'} onClick={handleGetDateList} />
                  <ActionBtn label="Change Payment Date" icon="edit_calendar"
                    onClick={() => { setShowChangeDate(v => !v); setShowCancelPmt(false); }} />
                  <ActionBtn label="Cancel a Payment"   icon="event_busy"
                    onClick={() => { setShowCancelPmt(v => !v); setShowChangeDate(false); }} danger />
                </div>

                {/* Results area */}
                {showResults && (
                  <div style={{ marginTop: 4 }}>
                    {scheduleError && <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{scheduleError}</p>}
                    {scheduleItems && scheduleItems.length === 0 && <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>No scheduled payments found.</p>}
                    {scheduleItems && scheduleItems.length > 0 && (
                      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                        <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead style={{ background: '#f9fafb' }}>
                            <tr>
                              {['#', 'Date', 'Amount', 'Status'].map(h => (
                                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {scheduleItems.map((inst: any, i: number) => {
                              const raw = String(inst.collectionDate || inst.date || '');
                              const dateStr = raw.length === 8 ? `${raw.slice(6, 8)}/${raw.slice(4, 6)}/${raw.slice(0, 4)}` : (raw || '—');
                              const amt = inst.installmentAmount != null ? formatCurrency(inst.installmentAmount)
                                : inst.amount != null ? formatCurrency(inst.amount) : '—';
                              return (
                                <tr key={i} style={{ borderTop: '1px solid #f0f0f0' }}>
                                  <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{inst.installmentNo ?? inst.no ?? ''}</td>
                                  <td style={{ padding: '8px 12px' }}>{dateStr}</td>
                                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{amt}</td>
                                  <td style={{ padding: '8px 12px' }}>{inst.status || inst.installmentStatus || '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {dateList && dateList.length === 0 && <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>No date list entries found.</p>}
                    {dateList && dateList.length > 0 && (
                      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', background: '#fff' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', margin: '0 0 6px' }}>Collection date list</p>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                          {dateList.map((d: any, i: number) => (
                            <li key={i} style={{ fontSize: 13, color: '#374151', padding: '6px 0', borderBottom: i < dateList.length - 1 ? '1px solid #f0f0f0' : 'none' }}>{String(d)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Change date sub-form */}
                {showChangeDate && (
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#f9fafb', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <p style={{ fontWeight: 700, fontSize: 12, color: '#374151', margin: 0 }}>Change Payment Date</p>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Payment #</label>
                        <input type="number" value={changeDateInst} min={1} placeholder="e.g. 3"
                          onChange={e => setChangeDateInst(e.target.value)} style={inputStyle} />
                      </div>
                      <div style={{ flex: 2 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>New Date</label>
                        <input type="date" value={changeDateVal} onChange={e => setChangeDateVal(e.target.value)} style={inputStyle} />
                      </div>
                    </div>
                    <ActionBtn label="Update Date" icon="check" loading={actionLoading === 'change-date'} onClick={handleUpdateDate} primary />
                  </div>
                )}

                {/* Cancel payment sub-form */}
                {showCancelPmt && (
                  <div style={{ border: '1px solid #fca5a5', borderRadius: 12, padding: 16, background: '#fff5f5', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <p style={{ fontWeight: 700, fontSize: 12, color: '#991b1b', margin: 0 }}>Cancel a Payment</p>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Payment # to cancel</label>
                      <input type="number" value={cancelInstNo} min={1} placeholder="e.g. 3"
                        onChange={e => setCancelInstNo(e.target.value)}
                        style={{ ...inputStyle, border: '1px solid #fca5a5' }} />
                    </div>
                    <ActionBtn label="Cancel Payment" icon="event_busy" loading={actionLoading === 'cancel-inst'} onClick={handleCancelInstallment} danger />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TT3 Signature section */}
          {hasRef && (
            <div style={{ border: '1px solid #f0f0f0', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', background: '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: '#374151', margin: 0 }}>TT3 Signature</p>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>Draw or upload the client's signature</p>
              </div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, background: '#fafafa', overflow: 'hidden' }}>
                  <canvas
                    ref={canvasRef}
                    width={480}
                    height={160}
                    style={{ display: 'block', width: '100%', height: 160, cursor: 'crosshair', touchAction: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: '#f3f4f6', color: '#374151', fontWeight: 600, fontSize: 12, cursor: 'pointer', border: '1px solid #e5e7eb', fontFamily: 'inherit' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload</span>
                    Upload file
                    <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
                  </label>
                  {tt3FileName && <span style={{ fontSize: 11, color: '#6b7280' }}>{tt3FileName}</span>}
                  <button type="button" onClick={clearSignature}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: '#f3f4f6', color: '#374151', fontWeight: 600, fontSize: 12, cursor: 'pointer', border: '1px solid #e5e7eb', fontFamily: 'inherit' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>restart_alt</span>
                    Clear
                  </button>
                  <ActionBtn label="Submit Signature" icon="send" loading={actionLoading === 'tt3'} onClick={handleSubmitTT3} primary />
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
