import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetSession = vi.fn();
const mockRefreshSession = vi.fn();

vi.mock('./supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args)
    }
  }
}));

const mockRedirectTo = vi.fn();
vi.mock('../lib/navigation', () => ({
  redirectTo: (...args: unknown[]) => mockRedirectTo(...args)
}));

import { apiFetch } from './apiClient';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('attaches the bearer token from the current session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'token-123' } } });
    const fetchMock = vi.fn().mockResolvedValue({ status: 200, ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/my-eligibility');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/my-eligibility',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-123' }) })
    );
    vi.unstubAllGlobals();
  });

  it('refreshes and retries once on a 401, then succeeds', async () => {
    mockGetSession
      .mockResolvedValueOnce({ data: { session: { access_token: 'expired-token' } } })
      .mockResolvedValueOnce({ data: { session: { access_token: 'fresh-token' } } });
    mockRefreshSession.mockResolvedValue({ data: { session: { access_token: 'fresh-token' } } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ status: 401, ok: false })
      .mockResolvedValueOnce({ status: 200, ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const response = await apiFetch('/api/my-eligibility');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/my-eligibility',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer fresh-token' }) })
    );
    expect(response.status).toBe(200);
    vi.unstubAllGlobals();
  });

  it('redirects to login when there is no session at all', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockRefreshSession.mockResolvedValue({ data: { session: null } });

    await expect(apiFetch('/api/my-eligibility')).rejects.toThrow('Session expired');
    expect(mockRedirectTo).toHaveBeenCalledWith('/auth/login');
  });

  it('redirects to login when refresh-after-401 also fails', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'expired-token' } } });
    mockRefreshSession.mockResolvedValue({ data: { session: null } });
    const fetchMock = vi.fn().mockResolvedValue({ status: 401, ok: false });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/api/my-eligibility')).rejects.toThrow('Session expired');
    expect(mockRedirectTo).toHaveBeenCalledWith('/auth/login');
    vi.unstubAllGlobals();
  });
});
