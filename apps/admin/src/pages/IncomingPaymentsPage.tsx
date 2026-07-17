import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchIncomingPayments } from '../services/adminData';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

const STATUS_BADGE: Record<string, string> = {
  confirmed: 'badge-green', pending: 'badge-yellow', rejected: 'badge-red',
};

function getInitials(name: string) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function AvatarCircle({ name }: { name: string }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: 'rgba(124,58,237,0.12)', color: 'var(--color-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: 13, flexShrink: 0,
    }}>
      {getInitials(name)}
    </div>
  );
}

export function IncomingPaymentsPage() {
  const [search, setSearch]           = useState('');
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

  const totalConfirmed = payments.filter((p: any) => p.status === 'confirmed').reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
  const totalPending   = payments.filter((p: any) => p.status === 'pending').length;
  const totalRejected  = payments.filter((p: any) => p.status === 'rejected').length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Incoming Payments</h1>
          <p className="page-subtitle">Manual and system-collected payments</p>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        <div className="stat-card"><span className="stat-label">Total Payments</span><div className="stat-value">{payments.length}</div></div>
        <div className="stat-card"><span className="stat-label">Total Confirmed</span><div className="stat-value" style={{ fontSize: 18, color: '#10B981' }}>{fmt(totalConfirmed)}</div></div>
        <div className="stat-card"><span className="stat-label">Pending Review</span><div className="stat-value" style={{ color: '#F59E0B' }}>{totalPending}</div></div>
        <div className="stat-card"><span className="stat-label">Rejected</span><div className="stat-value" style={{ color: '#EF4444' }}>{totalRejected}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="admin-search">
          <i className="fa-solid fa-search admin-search-icon" />
          <input type="text" placeholder="Search by client…" value={search} onChange={e => setSearch(e.target.value)} />
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
              <tr>
                <th>Client</th>
                <th>Loan #</th>
                <th style={{ textAlign: 'right' }}>Amount Paid</th>
                <th style={{ textAlign: 'right' }}>Monthly Repayment</th>
                <th style={{ textAlign: 'right' }}>Outstanding</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={7}><div className="empty-state"><i className="fa-solid fa-money-bill-wave" /><p>No payments found</p></div></td></tr>
                : filtered.map((p: any) => {
                  const name = p.profiles?.full_name ?? '—';
                  const monthly = Number(p.loan_applications?.offer_monthly_repayment) || 0;
                  const outstanding = Number(p.loan_applications?.loans?.[0]?.outstanding_balance ?? p.loan_applications?.offer_total_repayment ?? 0);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <AvatarCircle name={name} />
                          <div>
                            <div style={{ fontWeight: 600 }}>{name}</div>
                            {p.profiles?.identity_number && (
                              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{p.profiles.identity_number}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                        {p.loan_applications?.loan_number ?? p.application_id ?? '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#10B981' }}>
                        {fmt(Number(p.amount) || 0)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
                        {monthly > 0 ? fmt(monthly) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
                        {outstanding > 0 ? fmt(outstanding) : '—'}
                      </td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[p.status] ?? 'badge-gray'}`} style={{ textTransform: 'capitalize' }}>
                          {p.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        {new Date(p.created_at).toLocaleDateString('en-ZA')}
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
