import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCashLedger, createCashLedgerEntry } from '../services/adminData';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

const ENTRY_TYPES = ['credit', 'debit', 'opening_balance', 'closing_balance'];
const CATEGORIES  = ['loan_disbursement', 'loan_repayment', 'fee', 'interest', 'expense', 'transfer', 'other'];

export function CashLedgerPage() {
  const qc = useQueryClient();
  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [showModal, setShowModal]   = useState(false);
  const [entryForm, setEntryForm]   = useState<Record<string, string>>({
    transaction_date: new Date().toISOString().slice(0, 10),
    type: 'credit',
    category: 'other',
    amount: '',
    description: '',
    reference: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-cash-ledger'],
    queryFn: fetchCashLedger,
    staleTime: 60_000,
  });

  const createMut = useMutation({
    mutationFn: (entry: Record<string, unknown>) => createCashLedgerEntry(entry),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-cash-ledger'] }); setShowModal(false); setEntryForm(f => ({ ...f, amount: '', description: '', reference: '' })); },
  });

  const allEntries = data?.data ?? [];

  const entries = useMemo(() => {
    return allEntries.filter((e: any) => {
      const matchSearch = !search || (e.description ?? '').toLowerCase().includes(search.toLowerCase()) || (e.reference ?? '').toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === 'ALL' || e.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [allEntries, search, typeFilter]);

  // Compute running balance (sorted chronologically, newest at top for display)
  const withBalance = useMemo(() => {
    const sorted = [...allEntries].sort((a: any, b: any) =>
      new Date(a.transaction_date ?? a.created_at).getTime() - new Date(b.transaction_date ?? b.created_at).getTime()
    );
    let running = 0;
    const balMap: Record<string, number> = {};
    sorted.forEach((e: any) => {
      const amt = Number(e.amount) || 0;
      const isCredit = e.type === 'credit' || e.type === 'opening_balance' || amt > 0;
      running += isCredit ? Math.abs(amt) : -Math.abs(amt);
      balMap[e.id] = running;
    });
    return balMap;
  }, [allEntries]);

  const totalIn  = allEntries.filter((e: any) => e.type === 'credit' || e.type === 'opening_balance' || Number(e.amount) > 0).reduce((s: number, e: any) => s + Math.abs(Number(e.amount) || 0), 0);
  const totalOut = allEntries.filter((e: any) => e.type === 'debit' || Number(e.amount) < 0).reduce((s: number, e: any) => s + Math.abs(Number(e.amount) || 0), 0);
  const net = totalIn - totalOut;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    createMut.mutate({
      ...entryForm,
      amount: Number(entryForm.amount),
    });
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cash Ledger</h1>
          <p className="page-subtitle">Daily cash flow journal — read-only entries cannot be deleted</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          Add Entry
        </button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="stat-card">
          <span className="stat-label">Total Cash In</span>
          <div className="stat-value" style={{ color: '#10B981', fontSize: 20 }}>{fmt(totalIn)}</div>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Cash Out</span>
          <div className="stat-value" style={{ color: '#EF4444', fontSize: 20 }}>{fmt(totalOut)}</div>
        </div>
        <div className="stat-card">
          <span className="stat-label">Net Balance</span>
          <div className="stat-value" style={{ color: net >= 0 ? '#10B981' : '#EF4444', fontSize: 20 }}>{fmt(net)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="admin-search">
          <i className="fa-solid fa-search admin-search-icon" />
          <input type="text" placeholder="Search description or reference…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="admin-select" style={{ width: 'auto' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="ALL">All Types</option>
          {ENTRY_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}</span>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="spinner" /></div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Category</th>
                <th>Description</th>
                <th>Reference</th>
                <th style={{ textAlign: 'right' }}>Cash In</th>
                <th style={{ textAlign: 'right' }}>Cash Out</th>
                <th style={{ textAlign: 'right' }}>Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0
                ? <tr><td colSpan={8}><div className="empty-state"><i className="fa-solid fa-wallet" /><p>No ledger entries found</p></div></td></tr>
                : entries.map((e: any) => {
                  const amt = Number(e.amount) || 0;
                  const isCredit = e.type === 'credit' || e.type === 'opening_balance' || amt > 0;
                  const cashIn  = isCredit ? Math.abs(amt) : 0;
                  const cashOut = !isCredit ? Math.abs(amt) : 0;
                  const balance = withBalance[e.id] ?? 0;
                  return (
                    <tr key={e.id}>
                      <td style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(e.transaction_date ?? e.created_at).toLocaleDateString('en-ZA')}
                      </td>
                      <td>
                        <span className={`badge ${isCredit ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10 }}>
                          {(e.type ?? (isCredit ? 'credit' : 'debit')).replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        {(e.category ?? '—').replace(/_/g, ' ')}
                      </td>
                      <td style={{ maxWidth: 220 }}>{e.description ?? '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{e.reference ?? '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: cashIn > 0 ? 600 : 400, color: cashIn > 0 ? '#10B981' : 'var(--color-text-muted)' }}>
                        {cashIn > 0 ? `+${fmt(cashIn)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: cashOut > 0 ? 600 : 400, color: cashOut > 0 ? '#EF4444' : 'var(--color-text-muted)' }}>
                        {cashOut > 0 ? `-${fmt(cashOut)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: balance >= 0 ? '#111827' : '#EF4444' }}>
                        {fmt(balance)}
                      </td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>
      )}

      {/* Add Entry Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowModal(false)}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16 }}>New Journal Entry</h3>
              <button className="admin-icon-btn" onClick={() => setShowModal(false)}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Date</label>
                  <input className="admin-input" type="date" required value={entryForm.transaction_date} onChange={e => setEntryForm(f => ({ ...f, transaction_date: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Type</label>
                  <select className="admin-select" required value={entryForm.type} onChange={e => setEntryForm(f => ({ ...f, type: e.target.value }))}>
                    {ENTRY_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Category</label>
                  <select className="admin-select" value={entryForm.category} onChange={e => setEntryForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Amount (R)</label>
                  <input className="admin-input" type="number" min="0" step="0.01" required placeholder="e.g. 5000" value={entryForm.amount} onChange={e => setEntryForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Description</label>
                  <input className="admin-input" type="text" required placeholder="Brief description…" value={entryForm.description} onChange={e => setEntryForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Reference</label>
                  <input className="admin-input" type="text" placeholder="Optional reference number…" value={entryForm.reference} onChange={e => setEntryForm(f => ({ ...f, reference: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={createMut.isPending}>
                  {createMut.isPending ? 'Saving…' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
