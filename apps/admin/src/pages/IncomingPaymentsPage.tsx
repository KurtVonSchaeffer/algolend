import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchIncomingPayments } from '../services/adminData';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

const STATUS_BADGE: Record<string, string> = {
  confirmed: 'badge-green', pending: 'badge-yellow', rejected: 'badge-red',
};

export function IncomingPaymentsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-incoming-payments'],
    queryFn: fetchIncomingPayments,
    staleTime: 60_000,
  });

  const payments = data?.data ?? [];

  const filtered = payments.filter((p: any) => {
    const name = p.profiles?.full_name ?? '';
    const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalConfirmed = payments
    .filter((p: any) => p.status === 'confirmed')
    .reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Incoming Payments</h1>
          <p className="page-subtitle">Manual and system-collected payments</p>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="stat-card">
          <span className="stat-label">Total Payments</span>
          <div className="stat-value">{payments.length}</div>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Confirmed</span>
          <div className="stat-value">{fmt(totalConfirmed)}</div>
        </div>
        <div className="stat-card">
          <span className="stat-label">Pending Review</span>
          <div className="stat-value">{payments.filter((p: any) => p.status === 'pending').length}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="admin-search">
          <i className="fa-solid fa-search admin-search-icon" />
          <input type="text" placeholder="Search by name…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="admin-select" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="ALL">All Statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="spinner" /></div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Client</th><th>Loan #</th><th>Amount</th><th>Outstanding Balance</th><th>Status</th><th>Date</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={6}><div className="empty-state"><i className="fa-solid fa-money-bill-wave" /><p>No payments found</p></div></td></tr>
                : filtered.map((p: any) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.profiles?.full_name ?? '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{p.profiles?.identity_number ?? ''}</div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{p.loan_applications?.loan_number ?? p.application_id ?? '—'}</td>
                    <td style={{ fontWeight: 700 }}>{fmt(Number(p.amount) || 0)}</td>
                    <td style={{ color: 'var(--color-text-muted)' }}>
                      {fmt(Number(p.loan_applications?.loans?.[0]?.outstanding_balance ?? p.loan_applications?.offer_total_repayment ?? 0))}
                    </td>
                    <td><span className={`badge ${STATUS_BADGE[p.status] ?? 'badge-gray'}`}>{p.status}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{new Date(p.created_at).toLocaleDateString('en-ZA')}</td>
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
