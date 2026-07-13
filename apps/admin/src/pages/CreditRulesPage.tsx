import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCreditRules } from '../services/adminData';

export function CreditRulesPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-credit-rules'],
    queryFn: fetchCreditRules,
    staleTime: 60_000,
  });

  const rules = (data?.data ?? []).filter((r: any) =>
    !search || (r.name ?? r.rule_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Credit Rules</h1>
          <p className="page-subtitle">Automated decisioning criteria</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div className="admin-search">
          <i className="fa-solid fa-search admin-search-icon" />
          <input type="text" placeholder="Search rules…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="spinner" /></div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Rule Name</th><th>Category</th><th>Condition</th><th>Threshold</th><th>Action</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rules.length === 0
                ? <tr><td colSpan={6}><div className="empty-state"><i className="fa-solid fa-scale-balanced" /><p>No credit rules configured</p></div></td></tr>
                : rules.map((r: any) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.name ?? r.rule_name ?? '—'}</td>
                    <td style={{ fontSize: 12 }}>{r.category ?? '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{r.condition ?? '—'}</td>
                    <td>{r.threshold ?? r.value ?? '—'}</td>
                    <td><span className="badge badge-blue">{r.action ?? '—'}</span></td>
                    <td><span className={`badge ${r.is_active ? 'badge-green' : 'badge-gray'}`}>{r.is_active ? 'Active' : 'Inactive'}</span></td>
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
