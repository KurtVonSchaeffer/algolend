import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminPageShell } from '../components/ui/AdminPage';
import {
  fetchArrearsAccounts, updateLoanEscalation,
  type ArrearAccount, type EscalationStage,
} from '../services/adminData';

// ── Types ──────────────────────────────────────────────────────────────────────

type DPDBand = 'ALL' | '1-30' | '31-60' | '61-90' | '90+';

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGE_CONFIG: Record<EscalationStage, { label: string; color: string; bg: string; border: string; icon: string }> = {
  REMINDER:    { label: 'Reminder',    color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: 'notifications' },
  COLLECTIONS: { label: 'Collections', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: 'gavel' },
  LEGAL:       { label: 'Legal',       color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: 'account_balance' },
  WRITE_OFF:   { label: 'Write-Off',   color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb', icon: 'money_off' },
};

const STAGE_ORDER: EscalationStage[] = ['REMINDER', 'COLLECTIONS', 'LEGAL', 'WRITE_OFF'];
const BAND_OPTIONS: DPDBand[] = ['ALL', '1-30', '31-60', '61-90', '90+'];
const BAND_COLORS: Record<string, string> = {
  'ALL': '#6b7280', '1-30': '#16a34a', '31-60': '#d97706', '61-90': '#dc2626', '90+': '#7c3aed',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

const fmtDate = (d: string | null): string =>
  d ? new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function dpgBand(dpd: number): Exclude<DPDBand, 'ALL'> {
  if (dpd <= 30) return '1-30';
  if (dpd <= 60) return '31-60';
  if (dpd <= 90) return '61-90';
  return '90+';
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ArrearsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [band, setBand] = useState<DPDBand>('ALL');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const { data: result, isLoading } = useQuery({
    queryKey: ['arrears-accounts'],
    queryFn: fetchArrearsAccounts,
    staleTime: 30_000,
  });

  const accounts: ArrearAccount[] = result?.data ?? [];

  const toast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const filtered = useMemo(() => {
    return accounts.filter(a => {
      const matchBand = band === 'ALL' || dpgBand(a.dpd) === band;
      const matchSearch = !search ||
        a.clientName.toLowerCase().includes(search.toLowerCase()) ||
        a.loanNumber?.toLowerCase().includes(search.toLowerCase()) ||
        a.appId.includes(search);
      return matchBand && matchSearch;
    });
  }, [accounts, band, search]);

  const kpis = useMemo(() => ({
    total: accounts.reduce((s, a) => s + a.arrears, 0),
    avgDpd: accounts.length ? accounts.reduce((s, a) => s + a.dpd, 0) / accounts.length : 0,
    highRisk: accounts.filter(a => a.dpd > 60).length,
    count: accounts.length,
  }), [accounts]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(selected.size === filtered.length && filtered.length > 0
      ? new Set()
      : new Set(filtered.map(a => a.id)));
  };

  const handleEscalate = (account: ArrearAccount, toStage: EscalationStage) => {
    updateLoanEscalation(account.id, toStage);
    qc.invalidateQueries({ queryKey: ['arrears-accounts'] });
    toast(`${account.clientName} escalated to ${STAGE_CONFIG[toStage].label}`);
    setActionId(null);
  };

  const handleBulkReminder = () => {
    toast(`Reminder SMS queued for ${selected.size} account${selected.size > 1 ? 's' : ''}`);
    setSelected(new Set());
  };

  const card: React.CSSProperties = {
    background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  };

  return (
    <AdminPageShell>
      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed', top: 80, right: 24, zIndex: 9999,
          background: '#059669', color: '#fff', padding: '12px 20px',
          borderRadius: 12, fontWeight: 700, fontSize: 13,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}>
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#111827', margin: 0 }}>Collections & Arrears</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
          Monitor overdue accounts, track DPD, and manage escalation workflows.
        </p>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Arrears',        value: fmt(kpis.total),              icon: 'account_balance_wallet', color: '#dc2626' },
          { label: 'Accounts in Arrears',  value: kpis.count,                   icon: 'group',                  color: '#d97706' },
          { label: 'Avg Days Past Due',    value: `${kpis.avgDpd.toFixed(0)}d`, icon: 'calendar_today',         color: '#7c3aed' },
          { label: 'High Risk (DPD 60+)',  value: kpis.highRisk,                icon: 'warning',                color: '#dc2626' },
        ].map(k => (
          <div key={k.label} style={{ ...card, padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${k.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: k.color }}>{k.icon}</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k.label}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filters + bulk actions */}
      <div style={{ ...card, padding: '14px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {BAND_OPTIONS.map(b => (
            <button key={b} onClick={() => setBand(b)} style={{
              padding: '5px 13px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
              background: band === b ? BAND_COLORS[b] : '#f3f4f6',
              color: band === b ? '#fff' : '#6b7280',
              transition: 'all 0.15s',
            }}>
              {b === 'ALL' ? 'All Bands' : `DPD ${b}`}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 26, background: '#e5e7eb', flexShrink: 0 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 180, border: '1px solid #e5e7eb', borderRadius: 10, padding: '6px 11px', background: '#f9fafb' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#9ca3af' }}>search</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or loan number…"
            style={{ border: 'none', background: 'none', outline: 'none', fontSize: 12, flex: 1, color: '#111827' }}
          />
        </div>

        {selected.size > 0 && (
          <>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>{selected.size} selected</span>
            <button onClick={handleBulkReminder} style={{
              padding: '6px 13px', borderRadius: 9, border: 'none', cursor: 'pointer',
              background: '#7c3aed', color: '#fff', fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>sms</span>
              Send Reminder SMS
            </button>
          </>
        )}
      </div>

      {/* Table */}
      <div style={card}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={selectAll}
            style={{ width: 15, height: 15, cursor: 'pointer' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
            {isLoading ? 'Loading…' : `${filtered.length} account${filtered.length !== 1 ? 's' : ''}${band !== 'ALL' ? ` — DPD ${band}` : ''}`}
          </span>
        </div>

        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 32, display: 'block', marginBottom: 8, animation: 'spin 1s linear infinite' }}>refresh</span>
            Loading arrears data…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>check_circle</span>
            {accounts.length === 0 ? 'No accounts in arrears.' : 'No accounts match this filter.'}
          </div>
        ) : (
          filtered.map((acct, i) => {
            const stage = STAGE_CONFIG[acct.stage];
            const isSelected = selected.has(acct.id);
            const dpdbColor = acct.dpd <= 30 ? '#16a34a' : acct.dpd <= 60 ? '#d97706' : '#dc2626';
            const isOpen = actionId === acct.id;
            const higherStages = STAGE_ORDER.filter(s =>
              STAGE_ORDER.indexOf(s) > STAGE_ORDER.indexOf(acct.stage)
            );

            return (
              <div key={acct.id} style={{
                padding: '15px 18px',
                borderBottom: i < filtered.length - 1 ? '1px solid #f3f4f6' : 'none',
                background: isSelected ? '#faf5ff' : 'transparent',
                transition: 'background 0.1s',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(acct.id)}
                    style={{ width: 15, height: 15, cursor: 'pointer', marginTop: 4 }} />

                  {/* Avatar */}
                  <div style={{
                    width: 38, height: 38, borderRadius: 11, background: '#f5f3ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 13, color: '#7c3aed', flexShrink: 0,
                  }}>
                    {acct.clientName.split(' ').map(p => p[0]).join('').slice(0, 2)}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => navigate(`/applications/${acct.appId}`)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 14, fontWeight: 800, color: '#111827', textDecoration: 'underline' }}
                      >
                        {acct.clientName}
                      </button>
                      <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{acct.loanNumber}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
                        background: stage.bg, color: stage.color, border: `1px solid ${stage.border}`,
                        display: 'flex', alignItems: 'center', gap: 3,
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{stage.icon}</span>
                        {stage.label}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 20,
                        background: `${dpdbColor}18`, color: dpdbColor,
                      }}>
                        {acct.dpd} DPD
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 18, marginTop: 5, flexWrap: 'wrap' }}>
                      {[
                        { l: 'Arrears',     v: fmt(acct.arrears),     c: '#dc2626' },
                        { l: 'Outstanding', v: fmt(acct.outstanding),  c: '#111827' },
                        { l: 'Loan',        v: fmt(acct.loanAmount),  c: '#6b7280' },
                        { l: 'Last Payment',v: fmtDate(acct.lastPaymentDate), c: '#6b7280' },
                      ].map(({ l, v, c }) => (
                        <div key={l} style={{ fontSize: 12, color: '#9ca3af' }}>
                          {l}: <strong style={{ color: c }}>{v}</strong>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 5, fontSize: 11, color: '#374151', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, padding: '4px 9px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 12, color: '#9ca3af' }}>chevron_right</span>
                      {acct.nextAction}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                    <button
                      onClick={() => toast(`SMS reminder queued for ${acct.clientName}`)}
                      style={{ padding: '6px 11px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>sms</span>
                      Remind
                    </button>
                    {higherStages.length > 0 && (
                      <button
                        onClick={() => setActionId(isOpen ? null : acct.id)}
                        style={{ padding: '6px 11px', borderRadius: 8, border: 'none', background: 'var(--color-primary, #7c3aed)', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>arrow_upward</span>
                        Escalate
                      </button>
                    )}
                  </div>
                </div>

                {/* Escalation panel */}
                {isOpen && (
                  <div style={{ marginTop: 10, padding: '13px 14px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 11, marginLeft: 65 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#6b21a8', margin: '0 0 9px' }}>
                      Escalate {acct.clientName} to:
                    </p>
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                      {higherStages.map(s => (
                        <button key={s} onClick={() => handleEscalate(acct, s)} style={{
                          padding: '6px 13px', borderRadius: 8,
                          border: `1px solid ${STAGE_CONFIG[s].border}`,
                          background: STAGE_CONFIG[s].bg, cursor: 'pointer', fontSize: 11, fontWeight: 800,
                          color: STAGE_CONFIG[s].color, display: 'flex', alignItems: 'center', gap: 5,
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{STAGE_CONFIG[s].icon}</span>
                          {STAGE_CONFIG[s].label}
                        </button>
                      ))}
                      <button onClick={() => setActionId(null)} style={{
                        padding: '6px 11px', borderRadius: 8, border: '1px solid #e5e7eb',
                        background: '#fff', cursor: 'pointer', fontSize: 11, color: '#6b7280',
                      }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </AdminPageShell>
  );
}
