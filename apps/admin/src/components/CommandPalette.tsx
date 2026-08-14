import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface Cmd {
  id: string;
  group: string;
  label: string;
  description?: string;
  icon: string;
  route?: string;
  keywords?: string;
}

const COMMANDS: Cmd[] = [
  { id: 'new-app',    group: 'Actions', label: 'New Application',     description: 'Start in-branch application wizard',  icon: 'add_circle',             route: '/create-application', keywords: 'create apply new loan in-branch' },
  { id: 'dashboard',  group: 'Go to',   label: 'Dashboard',            description: 'Portfolio overview & KPIs',           icon: 'dashboard',              route: '/dashboard',          keywords: 'home overview stats kpi' },
  { id: 'apps',       group: 'Go to',   label: 'Applications',         description: 'Manage & review loan applications',   icon: 'assignment',             route: '/applications',       keywords: 'loans applicants review pending status' },
  { id: 'analytics',  group: 'Go to',   label: 'Analytics',            description: 'Customer analytics & reports',        icon: 'analytics',              route: '/analytics',          keywords: 'charts graphs reports data trends' },
  { id: 'financials', group: 'Go to',   label: 'Financials',           description: 'Income statement & P&L',              icon: 'account_balance',        route: '/financials',         keywords: 'income profit loss revenue p&l' },
  { id: 'mandates',   group: 'Go to',   label: 'Mandates',             description: 'DebiCheck mandates',                  icon: 'verified',               route: '/mandates',           keywords: 'debicheck debit order' },
  { id: 'incoming',   group: 'Go to',   label: 'Incoming Payments',    description: 'Collections & recoveries',            icon: 'payments',               route: '/incoming-payments',  keywords: 'collections repayments revenue received' },
  { id: 'outgoing',   group: 'Go to',   label: 'Outgoing Payments',    description: 'Disbursements & payouts',             icon: 'send_money',             route: '/outgoing-payments',  keywords: 'disbursements payouts lending send' },
  { id: 'credit',     group: 'Go to',   label: 'Credit Rules',         description: 'Lending criteria & policies',         icon: 'rule',                   route: '/credit-rules',       keywords: 'scoring affordability criteria policy' },
  { id: 'portfolio',  group: 'Go to',   label: 'Portfolio',            description: 'Loan portfolio overview',             icon: 'pie_chart',              route: '/portfolio',          keywords: 'book loans active defaulted npl health' },
  { id: 'loanbook',   group: 'Go to',   label: 'Loan Book',            description: 'Active loans ledger',                 icon: 'menu_book',              route: '/loan-book',          keywords: 'loans book ledger list' },
  { id: 'ledger',     group: 'Go to',   label: 'Cash Ledger',          description: 'Cash flow & transactions',            icon: 'account_balance_wallet', route: '/cash-ledger',        keywords: 'cash transactions ledger flow' },
  { id: 'sacrra',     group: 'Go to',   label: 'SACRRA / NCR',         description: 'Compliance & regulatory reports',     icon: 'gavel',                  route: '/sacrra',             keywords: 'compliance ncr regulatory nca goaml' },
  { id: 'settings',   group: 'Go to',   label: 'Settings',             description: 'System, branding & user management', icon: 'settings',               route: '/settings',           keywords: 'profile branding billing users roles audit' },
];

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const q = query.toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(124,58,237,0.18)', color: 'var(--color-primary)', borderRadius: 3, padding: '0 2px' }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? COMMANDS.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.description?.toLowerCase().includes(query.toLowerCase()) ||
        c.keywords?.toLowerCase().includes(query.toLowerCase())
      )
    : COMMANDS;

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => { setSelected(0); }, [query]);

  const run = useCallback((cmd: Cmd) => {
    onClose();
    if (cmd.route) navigate(cmd.route);
  }, [navigate, onClose]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      if (e.key === 'Enter') { e.preventDefault(); if (filtered[selected]) run(filtered[selected]); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, selected, run, onClose]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${selected}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected, open]);

  if (!open) return null;

  const groups: Record<string, typeof filtered> = {};
  filtered.forEach(c => { (groups[c.group] ??= []).push(c); });
  let globalIdx = 0;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 72 }}
      onClick={onClose}
    >
      <style>{`
        @keyframes cmdIn { from { opacity:0; transform:scale(0.95) translateY(-12px); } to { opacity:1; transform:scale(1) translateY(0); } }
      `}</style>
      <div
        style={{ width: '100%', maxWidth: 560, background: 'var(--color-surface-card)', borderRadius: 18, border: '1px solid var(--color-border)', boxShadow: '0 40px 100px rgba(0,0,0,0.3), 0 0 0 1px rgba(124,58,237,0.08)', overflow: 'hidden', animation: 'cmdIn 0.18s cubic-bezier(0.34,1.56,0.64,1)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--color-border)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--color-text-muted)', flexShrink: 0 }}>search</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search pages, actions…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: 'var(--color-text)', fontFamily: 'inherit' }}
          />
          <kbd style={{ padding: '2px 7px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', fontFamily: 'inherit', flexShrink: 0 }}>ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: 420, overflowY: 'auto', padding: '6px 8px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '36px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
              No results for "<strong>{query}</strong>"
            </div>
          ) : Object.entries(groups).map(([group, cmds]) => (
            <div key={group}>
              <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-text-muted)', opacity: 0.5 }}>{group}</div>
              {cmds.map(cmd => {
                const itemIdx = globalIdx++;
                const active = selected === itemIdx;
                return (
                  <div
                    key={cmd.id}
                    data-idx={itemIdx}
                    onClick={() => run(cmd)}
                    onMouseEnter={() => setSelected(itemIdx)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', background: active ? 'rgba(124,58,237,0.08)' : 'transparent', transition: 'background 0.1s' }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? 'rgba(124,58,237,0.12)' : 'var(--color-surface-muted)', transition: 'background 0.1s' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: active ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>{cmd.icon}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: active ? 'var(--color-primary)' : 'var(--color-text)' }}>
                        <Highlight text={cmd.label} query={query} />
                      </div>
                      {cmd.description && (
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cmd.description}
                        </div>
                      )}
                    </div>
                    {active && (
                      <kbd style={{ padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(124,58,237,0.2)', background: 'rgba(124,58,237,0.08)', fontSize: 10, fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'inherit', flexShrink: 0 }}>↵</kbd>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 16, alignItems: 'center' }}>
          {[['↑↓', 'navigate'], ['↵', 'open'], ['esc', 'close']].map(([k, l]) => (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-text-muted)' }}>
              <kbd style={{ padding: '1px 6px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', fontSize: 10, fontFamily: 'inherit' }}>{k}</kbd>
              {l}
            </span>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-muted)', opacity: 0.45, fontWeight: 600 }}>AlgoLend</span>
        </div>
      </div>
    </div>
  );
}
