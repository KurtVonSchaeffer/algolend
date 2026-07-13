import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCashLedger } from '../services/adminData';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

export function CashLedgerPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-cash-ledger'],
    queryFn: fetchCashLedger,
    staleTime: 60_000,
  });

  const entries = data?.data ?? [];

  const totalIn = entries.filter((e: any) => e.type === 'credit' || Number(e.amount) > 0)
    .reduce((s: number, e: any) => s + Math.abs(Number(e.amount) || 0), 0);
  const totalOut = entries.filter((e: any) => e.type === 'debit' || Number(e.amount) < 0)
    .reduce((s: number, e: any) => s + Math.abs(Number(e.amount) || 0), 0);

  const filtered = entries.filter((e: any) =>
    !search || (e.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cash Ledger</h1>
          <p className="page-subtitle">All cash flow transactions</p>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="stat-card"><span className="stat-label">Total Inflows</span><div className="stat-value" style={{ color: '#10B981', fontSize: 20 }}>{fmt(totalIn)}</div></div>
        <div className="stat-card"><span className="stat-label">Total Outflows</span><div className="stat-value" style={{ color: '#EF4444', fontSize: 20 }}>{fmt(totalOut)}</div></div>
        <div className="stat-card"><span className="stat-label">Net Balance</span><div className="stat-value" style={{ color: totalIn - totalOut >= 0 ? '#10B981' : '#EF4444', fontSize: 20 }}>{fmt(totalIn - totalOut)}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div className="admin-search">
          <i className="fa-solid fa-search admin-search-icon" />
          <input type="text" placeholder="Search description…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="spinner" /></div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Date</th><th>Description</th><th>Reference</th><th>Type</th><th>Amount</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={5}><div className="empty-state"><i className="fa-solid fa-wallet" /><p>No ledger entries found</p></div></td></tr>
                : filtered.map((e: any) => {
                  const isCredit = e.type === 'credit' || Number(e.amount) > 0;
                  return (
                    <tr key={e.id}>
                      <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{new Date(e.transaction_date ?? e.created_at).toLocaleDateString('en-ZA')}</td>
                      <td>{e.description ?? '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{e.reference ?? '—'}</td>
                      <td><span className={`badge ${isCredit ? 'badge-green' : 'badge-red'}`}>{isCredit ? 'Credit' : 'Debit'}</span></td>
                      <td style={{ fontWeight: 700, color: isCredit ? '#10B981' : '#EF4444' }}>
                        {isCredit ? '+' : '-'}{fmt(Math.abs(Number(e.amount) || 0))}
                      </td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
