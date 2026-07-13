import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchLoans } from '../services/adminData';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

const STATUS_BADGE: Record<string, string> = {
  active: 'badge-green', repaid: 'badge-blue', settled: 'badge-blue',
  default: 'badge-red', arrears: 'badge-yellow', cancelled: 'badge-gray',
};

export function LoanBookPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-loans'],
    queryFn: fetchLoans,
    staleTime: 60_000,
  });

  const loans = data?.data ?? [];
  const filtered = loans.filter((l: any) => {
    const name = l.profiles?.full_name ?? '';
    const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPortfolio = loans.filter((l: any) => l.status === 'active')
    .reduce((s: number, l: any) => s + (Number(l.outstanding_balance) || 0), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Loan Book</h1>
          <p className="page-subtitle">{loans.length} total loans</p>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        <div className="stat-card"><span className="stat-label">Total Loans</span><div className="stat-value">{loans.length}</div></div>
        <div className="stat-card"><span className="stat-label">Active</span><div className="stat-value" style={{ color: '#10B981' }}>{loans.filter((l: any) => l.status === 'active').length}</div></div>
        <div className="stat-card"><span className="stat-label">In Arrears</span><div className="stat-value" style={{ color: '#F59E0B' }}>{loans.filter((l: any) => l.status === 'arrears').length}</div></div>
        <div className="stat-card"><span className="stat-label">Active Portfolio</span><div className="stat-value" style={{ fontSize: 18 }}>{fmt(totalPortfolio)}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div className="admin-search">
          <i className="fa-solid fa-search admin-search-icon" />
          <input type="text" placeholder="Search by client…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="admin-select" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="ALL">All Statuses</option>
          {['active','repaid','settled','default','arrears','cancelled'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="spinner" /></div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Client</th><th>Principal</th><th>Outstanding</th><th>Interest Rate</th><th>Status</th><th>Date</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={6}><div className="empty-state"><i className="fa-solid fa-book" /><p>No loans found</p></div></td></tr>
                : filtered.map((l: any) => (
                  <tr key={l.id}>
                    <td style={{ fontWeight: 600 }}>{l.profiles?.full_name ?? '—'}</td>
                    <td>{fmt(Number(l.principal_amount) || 0)}</td>
                    <td style={{ fontWeight: 700 }}>{fmt(Number(l.outstanding_balance) || 0)}</td>
                    <td>{l.interest_rate != null ? `${l.interest_rate}%` : '—'}</td>
                    <td><span className={`badge ${STATUS_BADGE[l.status] ?? 'badge-gray'}`}>{l.status}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{new Date(l.created_at).toLocaleDateString('en-ZA')}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
