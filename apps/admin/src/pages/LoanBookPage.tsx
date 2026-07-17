import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchLoans } from '../services/adminData';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

const STATUS_BADGE: Record<string, string> = {
  active: 'badge-green', repaid: 'badge-blue', settled: 'badge-blue',
  default: 'badge-red', arrears: 'badge-yellow', cancelled: 'badge-gray',
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

function daysActive(created_at: string) {
  return Math.round((Date.now() - new Date(created_at).getTime()) / (1000 * 60 * 60 * 24));
}

function exportCsv(loans: any[]) {
  const headers = ['Loan #', 'Client', 'ID Number', 'Principal', 'Outstanding', 'Rate', 'Status', 'Days Active', 'Date'];
  const lines = loans.map(l => [
    l.loan_number ?? l.id,
    l.profiles?.full_name ?? '',
    l.profiles?.identity_number ?? '',
    Number(l.principal_amount) || 0,
    Number(l.outstanding_balance) || 0,
    l.interest_rate != null ? `${l.interest_rate}%` : '',
    l.status,
    daysActive(l.created_at),
    new Date(l.created_at).toLocaleDateString('en-ZA'),
  ].join(','));
  const blob = new Blob(['﻿' + [headers.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'algolend_loan_book.csv';
  a.click();
}

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
    const id = String(l.loan_number ?? l.id ?? '');
    const matchSearch = !search ||
      name.toLowerCase().includes(search.toLowerCase()) ||
      id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const active   = loans.filter((l: any) => l.status === 'active');
  const arrears  = loans.filter((l: any) => l.status === 'arrears');
  const defaults = loans.filter((l: any) => l.status === 'default');
  const totalPortfolio = active.reduce((s: number, l: any) => s + (Number(l.outstanding_balance ?? l.principal_amount) || 0), 0);
  const totalDisbursed = loans.reduce((s: number, l: any) => s + (Number(l.principal_amount) || 0), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Loan Book</h1>
          <p className="page-subtitle">Full portfolio — tracking days, arrears and status</p>
        </div>
        <button className="btn btn-secondary" onClick={() => exportCsv(filtered)} style={{ gap: 6 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
          Export
        </button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 24 }}>
        <div className="stat-card"><span className="stat-label">Total Loans</span><div className="stat-value">{loans.length}</div></div>
        <div className="stat-card"><span className="stat-label">Active</span><div className="stat-value" style={{ color: '#10B981' }}>{active.length}</div></div>
        <div className="stat-card"><span className="stat-label">In Arrears</span><div className="stat-value" style={{ color: '#F59E0B' }}>{arrears.length}</div></div>
        <div className="stat-card"><span className="stat-label">Defaulted</span><div className="stat-value" style={{ color: '#EF4444' }}>{defaults.length}</div></div>
        <div className="stat-card"><span className="stat-label">Active Portfolio</span><div className="stat-value" style={{ fontSize: 16 }}>{fmt(totalPortfolio)}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="admin-search">
          <i className="fa-solid fa-search admin-search-icon" />
          <input type="text" placeholder="Search by client or loan #…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="admin-select" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="ALL">All Statuses</option>
          {['active', 'repaid', 'settled', 'default', 'arrears', 'cancelled'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          {filtered.length} loan{filtered.length !== 1 ? 's' : ''} · {fmt(totalDisbursed)} disbursed
        </span>
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
                <th style={{ textAlign: 'right' }}>Principal</th>
                <th style={{ textAlign: 'right' }}>Outstanding</th>
                <th>Rate</th>
                <th>Days Active</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={8}><div className="empty-state"><i className="fa-solid fa-book" /><p>No loans found</p></div></td></tr>
                : filtered.map((l: any) => {
                  const name = l.profiles?.full_name ?? '—';
                  const days = daysActive(l.created_at);
                  const isOverdue = (l.status === 'arrears' || l.status === 'default');
                  return (
                    <tr key={l.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <AvatarCircle name={name} />
                          <div>
                            <div style={{ fontWeight: 600 }}>{name}</div>
                            {l.profiles?.identity_number && (
                              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{l.profiles.identity_number}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                        {l.loan_number ?? '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>{fmt(Number(l.principal_amount) || 0)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(Number(l.outstanding_balance ?? l.principal_amount) || 0)}</td>
                      <td>{l.interest_rate != null ? `${l.interest_rate}%` : '—'}</td>
                      <td>
                        <span style={{ fontWeight: isOverdue ? 700 : 400, color: isOverdue ? '#EF4444' : 'inherit' }}>
                          {days}d
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[l.status] ?? 'badge-gray'}`} style={{ textTransform: 'capitalize' }}>
                          {l.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        {new Date(l.created_at).toLocaleDateString('en-ZA')}
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
