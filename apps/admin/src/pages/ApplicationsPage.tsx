import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchLoanApplications } from '../services/adminData';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'badge-yellow',
  UNDER_REVIEW: 'badge-blue',
  APPROVED: 'badge-green',
  AWAITING_DISBURSEMENT: 'badge-purple',
  DISBURSED: 'badge-green',
  DECLINED: 'badge-red',
};

const ALL_STATUSES = ['ALL', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'AWAITING_DISBURSEMENT', 'DISBURSED', 'DECLINED'];

export function ApplicationsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-applications'],
    queryFn: fetchLoanApplications,
    staleTime: 60_000,
  });

  const apps = data?.data ?? [];

  const filtered = apps.filter(a => {
    const name = (a.profiles as any)?.full_name ?? '';
    const id = String(a.id ?? '');
    const matchSearch =
      !search ||
      name.toLowerCase().includes(search.toLowerCase()) ||
      id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Applications</h1>
          <p className="page-subtitle">{apps.length} total applications</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/create-application')}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
          New Application
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="admin-search">
          <i className="fa-solid fa-search admin-search-icon" />
          <input
            type="text"
            placeholder="Search by name or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="admin-select"
          style={{ width: 'auto' }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>ID Number</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date Applied</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <i className="fa-solid fa-inbox" />
                      <p>No applications found</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(app => (
                <tr
                  key={app.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/applications/${app.id}`)}
                >
                  <td style={{ fontWeight: 600 }}>{(app.profiles as any)?.full_name ?? '—'}</td>
                  <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{(app.profiles as any)?.identity_number ?? '—'}</td>
                  <td style={{ fontWeight: 700 }}>{fmt(Number(app.amount) || 0)}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[app.status] ?? 'badge-gray'}`}>
                      {app.status?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                    {new Date(app.created_at).toLocaleDateString('en-ZA')}
                  </td>
                  <td>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-text-muted)' }}>chevron_right</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
