import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUsers, updateUserRole } from '../services/adminData';

const ROLES = ['borrower', 'base_admin', 'admin', 'super_admin', 'owner'];

const ROLE_BADGE: Record<string, string> = {
  borrower: 'badge-gray', base_admin: 'badge-blue', admin: 'badge-purple',
  super_admin: 'badge-green', owner: 'badge-yellow',
};

function getInitials(name: string) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function AvatarCircle({ name }: { name: string }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: 'rgba(124,58,237,0.12)',
      color: 'var(--color-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: 13, flexShrink: 0,
    }}>
      {getInitials(name)}
    </div>
  );
}

export function UsersPage({ embedded = false, title = 'Users' }: { embedded?: boolean; title?: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [editingUser, setEditingUser] = useState<{ id: string; role: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: fetchUsers,
    staleTime: 60_000,
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => updateUserRole(userId, role),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); setEditingUser(null); },
  });

  const users = data?.data ?? [];
  const filtered = users.filter((u: any) => {
    const matchSearch = !search ||
      (u.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (u.identity_number ?? '').includes(search);
    const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <>
      {!embedded && (
        <div className="page-header">
          <div>
            <h1 className="page-title">{title}</h1>
            <p className="page-subtitle">{users.length} registered users</p>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="admin-search">
          <i className="fa-solid fa-search admin-search-icon" />
          <input
            type="text" placeholder="Search name, email or ID…"
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="admin-select" style={{ width: 'auto' }} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="ALL">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
        </select>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="spinner" /></div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>ID Number</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Branch</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={7}><div className="empty-state"><i className="fa-solid fa-users" /><p>No users found</p></div></td></tr>
                : filtered.map((u: any) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <AvatarCircle name={u.full_name ?? ''} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{u.full_name ?? '—'}</div>
                          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{u.identity_number ?? '—'}</td>
                    <td style={{ fontSize: 12 }}>{u.cell_tel_no ?? '—'}</td>
                    <td>
                      {editingUser?.id === u.id ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <select
                            className="admin-select" style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}
                            value={editingUser!.role}
                            onChange={e => setEditingUser({ id: u.id, role: e.target.value })}
                          >
                            {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                          </select>
                          <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }}
                            disabled={roleMutation.isPending}
                            onClick={() => roleMutation.mutate({ userId: u.id, role: editingUser!.role })}>
                            Save
                          </button>
                          <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setEditingUser(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <span className={`badge ${ROLE_BADGE[u.role] ?? 'badge-gray'}`}>
                          {u.role?.replace(/_/g, ' ') ?? 'borrower'}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>{(u.branches as any)?.name ?? '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {new Date(u.created_at).toLocaleDateString('en-ZA')}
                    </td>
                    <td>
                      <button className="admin-icon-btn" title="Edit role"
                        onClick={() => setEditingUser({ id: u.id, role: u.role ?? 'borrower' })}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                      </button>
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
