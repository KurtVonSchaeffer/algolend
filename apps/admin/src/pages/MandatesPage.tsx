import { useQuery } from '@tanstack/react-query';
import { fetchMandates } from '../services/adminData';

const STATUS_BADGE: Record<string, string> = {
  active: 'badge-green', pending: 'badge-yellow', cancelled: 'badge-red', suspended: 'badge-gray',
};

export function MandatesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-mandates'],
    queryFn: fetchMandates,
    staleTime: 60_000,
  });

  const mandates = data?.data ?? [];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mandates</h1>
          <p className="page-subtitle">Debit order mandates across all clients</p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="spinner" /></div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Client</th><th>Account</th><th>Collection Day</th><th>Status</th><th>Created</th></tr>
            </thead>
            <tbody>
              {mandates.length === 0
                ? <tr><td colSpan={5}><div className="empty-state"><i className="fa-solid fa-receipt" /><p>No mandates found</p></div></td></tr>
                : mandates.map((m: any) => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.profiles?.full_name ?? '—'}</td>
                    <td style={{ fontSize: 12 }}>{m.account_number ? `****${String(m.account_number).slice(-4)}` : '—'}</td>
                    <td>{m.collection_day ?? '—'}</td>
                    <td><span className={`badge ${STATUS_BADGE[m.status] ?? 'badge-gray'}`}>{m.status ?? 'unknown'}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{new Date(m.created_at).toLocaleDateString('en-ZA')}</td>
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
