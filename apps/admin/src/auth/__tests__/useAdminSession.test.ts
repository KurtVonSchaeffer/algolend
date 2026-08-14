import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAdminSession } from '../useAdminSession';

vi.mock('../../api/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signOut: vi.fn().mockResolvedValue({}),
    },
  },
}));

describe('useAdminSession — demo mode', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
  afterEach(() => { localStorage.clear(); });

  it('returns authenticated immediately when demo flag is set', () => {
    localStorage.setItem('algolend_demo', '1');
    const { result } = renderHook(() => useAdminSession());
    expect(result.current.status).toBe('authenticated');
    expect(result.current.role).toBe('base_admin');
    expect(result.current.session).toBeNull();
  });

  it('returns loading initially without demo flag', () => {
    const { result } = renderHook(() => useAdminSession());
    expect(result.current.status).toBe('loading');
  });

  it('does not call supabase.auth.getSession in demo mode', async () => {
    const { supabase } = await import('../../api/supabaseClient');
    localStorage.setItem('algolend_demo', '1');
    renderHook(() => useAdminSession());
    expect(supabase.auth.getSession).not.toHaveBeenCalled();
  });
});
