import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPayouts, approvePayout } from '../services/adminData';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'badge-yellow', APPROVED: 'badge-green', REJECTED: 'badge-red', PAID: 'badge-blue',
};

export function OutgoingPaymentsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payouts'],
    queryFn: fetchPayouts,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (id: string) => approvePayout(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-payouts'] }),
  });

  const payouts = data?.data ?? [];
  const pending = payouts.filter((p: any) => p.status === 'PENDING').length;
  const totalApproved = payouts.filter((p: any) => p.status === 'APPROVED')
    .reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Outgoing Payments</h1>
          <p className="page-subtitle">Disbursements awaiting approval</p>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="stat-card"><span className="stat-label">Total Payouts</span><div className="stat-value">{payouts.length}</div></div>
        <div className="stat-card"><span className="stat-label">Pending Approval</span><div className="stat-value" style={{ color: '#F59E0B' }}>{pending}</div></div>
        <div className="stat-card"><span className="stat-label">Total Approved</span><div className="stat-value">{fmt(totalApproved)}</div></div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="spinner" /></div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Recipient</th><th>Bank Account</th><th>Amount</th><th>Status</th><th>Date</th><th></th></tr>
            </thead>
            <tbody>
              {payouts.length === 0
                ? <tr><td colSpan={6}><div className="empty-state"><i className="fa-solid fa-paper-plane" /><p>No payouts found</p></div></td></tr>
                : payouts.map((p: any) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.profile?.full_name ?? '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{p.profile?.email}</div>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {p.application?.bank_account
                        ? `${p.application.bank_account.bank_name ?? ''} ****${String(p.application.bank_account.account_number ?? '').slice(-4)}`
                        : '—'}
                    </td>
                    <td style={{ fontWeight: 700 }}>{fmt(Number(p.amount) || 0)}</td>
                    <td><span className={`badge ${STATUS_BADGE[p.status] ?? 'badge-gray'}`}>{p.status}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{new Date(p.created_at).toLocaleDateString('en-ZA')}</td>
                    <td>
                      {p.status === 'PENDING' && (
                        <button
                          className="btn btn-primary" style={{ padding: '5px 14px', fontSize: 12 }}
                          disabled={mutation.isPending}
                          onClick={() => mutation.mutate(p.id)}
                        >
                          Approve
                        </button>
                      )}
                    </td>
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
