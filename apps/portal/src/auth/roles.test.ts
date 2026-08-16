import { describe, it, expect, vi } from 'vitest';
import { hasMinimumRole, resolveAdminAccess, type MinimalSession } from './roles';

describe('hasMinimumRole', () => {
  it('returns true when the role level meets the minimum', () => {
    expect(hasMinimumRole('super_admin', 'base_admin')).toBe(true);
    expect(hasMinimumRole('admin', 'admin')).toBe(true);
  });

  it('returns false when the role level is below the minimum', () => {
    expect(hasMinimumRole('borrower', 'base_admin')).toBe(false);
    expect(hasMinimumRole('support', 'admin')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(hasMinimumRole('SUPER_ADMIN', 'base_admin')).toBe(true);
  });

  it('treats an unknown or missing role as level 0', () => {
    expect(hasMinimumRole('', 'base_admin')).toBe(false);
    expect(hasMinimumRole('made_up_role', 'base_admin')).toBe(false);
  });
});

describe('resolveAdminAccess', () => {
  it('grants access from the JWT app_metadata role without calling the RPC', async () => {
    const rpc = vi.fn();
    const session = { user: { app_metadata: { role: 'super_admin' }, user_metadata: {} } } as MinimalSession;

    const result = await resolveAdminAccess(session, { rpc }, 'base_admin');

    expect(result).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('does NOT fall back to user_metadata role when app_metadata has none', async () => {
    // user_metadata is user-writable; role elevation via user_metadata must not be honoured.
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    const session = { user: { app_metadata: {}, user_metadata: { role: 'admin' } } } as MinimalSession;

    const result = await resolveAdminAccess(session, { rpc }, 'base_admin');

    expect(result).toBe(false);
  });

  it('falls back to the RPC when the JWT role is insufficient', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const session = { user: { app_metadata: { role: 'borrower' }, user_metadata: {} } } as MinimalSession;

    const result = await resolveAdminAccess(session, { rpc }, 'base_admin');

    expect(rpc).toHaveBeenCalledWith('is_role_or_higher', { p_min_role: 'base_admin' });
    expect(result).toBe(true);
  });

  it('returns false when both the JWT role and the RPC deny access', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    const session = { user: { app_metadata: { role: 'borrower' }, user_metadata: {} } } as MinimalSession;

    const result = await resolveAdminAccess(session, { rpc }, 'base_admin');

    expect(result).toBe(false);
  });

  it('returns false when there is no session at all', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });

    const result = await resolveAdminAccess(null, { rpc }, 'base_admin');

    expect(result).toBe(false);
  });

  it('returns false when the RPC errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('rpc down') });
    const session = { user: { app_metadata: { role: 'borrower' }, user_metadata: {} } } as MinimalSession;

    const result = await resolveAdminAccess(session, { rpc }, 'base_admin');

    expect(result).toBe(false);
  });
});
