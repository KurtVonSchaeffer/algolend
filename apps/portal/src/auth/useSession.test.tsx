import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockSignOut = vi.fn();

vi.mock('../api/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args)
    }
  }
}));

const mockRedirectTo = vi.fn();
vi.mock('../lib/navigation', () => ({
  redirectTo: (...args: unknown[]) => mockRedirectTo(...args)
}));

import { useSession } from './useSession';

describe('useSession', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it('redirects to login when there is no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(mockRedirectTo).toHaveBeenCalledWith('/auth/login');
  });

  it('signs out and redirects when the role is not an allowed portal role', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'u1', app_metadata: { role: 'unknown_role' } } } },
      error: null
    });
    mockSignOut.mockResolvedValue({});
    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockRedirectTo).toHaveBeenCalledWith('/auth/login');
  });

  it('exposes an authenticated status and session for an allowed role', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'u1', app_metadata: { role: 'borrower' } } } },
      error: null
    });
    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.session?.user.id).toBe('u1');
    expect(mockRedirectTo).not.toHaveBeenCalled();
  });

  it('redirects to login when SIGNED_OUT fires', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'u1', app_metadata: { role: 'borrower' } } } },
      error: null
    });
    let capturedCallback: ((event: string) => void) | undefined;
    mockOnAuthStateChange.mockImplementation((cb: (event: string) => void) => {
      capturedCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    capturedCallback?.('SIGNED_OUT');
    expect(mockRedirectTo).toHaveBeenCalledWith('/auth/login');
  });
});
