import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMandates } from '../services/adminData';

const STATUS_BADGE: Record<string, string> = {
  active: 'badge-green', pending: 'badge-yellow', cancelled: 'badge-red', suspended: 'badge-gray',
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

export function MandatesPage() {
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-mandates'],
    queryFn: fetchMandates,
    staleTime: 60_000,
  });

  const mandates = data?.data ?? [];

  const filtered = mandates.filter((m: any) => {
    const name = m.profiles?.full_name ?? '';
    const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase()) || (m.account_number ?? '').includes(search);
    const matchStatus = statusFilter === 'ALL' || m.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const activeCount    = mandates.filter((m: any) => m.status === 'active').length;
  const pendingCount   = mandates.filter((m: any) => m.status === 'pending').length;
  const cancelledCount = mandates.filter((m: any) => m.status === 'cancelled').length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mandates</h1>
          <p className="page-subtitle">Debit order mandates across all clients</p>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        <div className="stat-card"><span className="stat-label">Total Mandates</span><div className="stat-value">{mandates.length}</div></div>
        <div className="stat-card"><span className="stat-label">Active</span><div className="stat-value" style={{ color: '#10B981' }}>{activeCount}</div></div>
        <div className="stat-card"><span className="stat-label">Pending</span><div className="stat-value" style={{ color: '#F59E0B' }}>{pendingCount}</div></div>
        <div className="stat-card"><span className="stat-label">Cancelled</span><div className="stat-value" style={{ color: '#EF4444' }}>{cancelledCount}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="admin-search">
          <i className="fa-solid fa-search admin-search-icon" />
          <input type="text" placeholder="Search client or account…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="admin-select" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="ALL">All Statuses</option>
          {['active', 'pending', 'cancelled', 'suspended'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
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
                <th>Bank / Account</th>
                <th>Collection Day</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={5}><div className="empty-state"><i className="fa-solid fa-receipt" /><p>No mandates found</p></div></td></tr>
                : filtered.map((m: any) => {
                  const name = m.profiles?.full_name ?? '—';
                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <AvatarCircle name={name} />
                          <div>
                            <div style={{ fontWeight: 600 }}>{name}</div>
                            {m.profiles?.identity_number && (
                              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{m.profiles.identity_number}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 13 }}>{m.bank_name ?? m.bank ?? '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                          {m.account_number ? `****${String(m.account_number).slice(-4)}` : '—'}
                        </div>
                      </td>
                      <td>
                        {m.collection_day
                          ? <span style={{ fontWeight: 600 }}>{m.collection_day}<sup>th</sup></span>
                          : '—'
                        }
                      </td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[m.status] ?? 'badge-gray'}`} style={{ textTransform: 'capitalize' }}>
                          {m.status ?? 'unknown'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        {new Date(m.created_at).toLocaleDateString('en-ZA')}
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
