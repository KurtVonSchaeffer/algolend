import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPayouts, approvePayout } from '../services/adminData';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'badge-yellow', APPROVED: 'badge-green', REJECTED: 'badge-red', PAID: 'badge-blue',
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
  const pending      = payouts.filter((p: any) => p.status === 'PENDING').length;
  const totalApproved = payouts.filter((p: any) => p.status === 'APPROVED').reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
  const totalPaid    = payouts.filter((p: any) => p.status === 'PAID').reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Outgoing Payments</h1>
          <p className="page-subtitle">Disbursements awaiting approval</p>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        <div className="stat-card"><span className="stat-label">Total Payouts</span><div className="stat-value">{payouts.length}</div></div>
        <div className="stat-card"><span className="stat-label">Pending Approval</span><div className="stat-value" style={{ color: '#F59E0B' }}>{pending}</div></div>
        <div className="stat-card"><span className="stat-label">Total Approved</span><div className="stat-value" style={{ fontSize: 18 }}>{fmt(totalApproved)}</div></div>
        <div className="stat-card"><span className="stat-label">Total Paid Out</span><div className="stat-value" style={{ fontSize: 18, color: '#10B981' }}>{fmt(totalPaid)}</div></div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="spinner" /></div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Recipient</th>
                <th>Bank Account</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {payouts.length === 0
                ? <tr><td colSpan={6}><div className="empty-state"><i className="fa-solid fa-paper-plane" /><p>No payouts found</p></div></td></tr>
                : payouts.map((p: any) => {
                  const name = p.profile?.full_name ?? '—';
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <AvatarCircle name={name} />
                          <div>
                            <div style={{ fontWeight: 600 }}>{name}</div>
                            {p.profile?.email && (
                              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{p.profile.email}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {p.application?.bank_account
                          ? <>
                              <div>{p.application.bank_account.bank_name ?? '—'}</div>
                              <div style={{ color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                                ****{String(p.application.bank_account.account_number ?? '').slice(-4)}
                              </div>
                            </>
                          : '—'
                        }
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(Number(p.amount) || 0)}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[p.status] ?? 'badge-gray'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        {new Date(p.created_at).toLocaleDateString('en-ZA')}
                      </td>
                      <td>
                        {p.status === 'PENDING' && (
                          <button
                            className="btn btn-primary"
                            style={{ padding: '5px 14px', fontSize: 12 }}
                            disabled={mutation.isPending}
                            onClick={() => mutation.mutate(p.id)}
                          >
                            Approve
                          </button>
                        )}
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
