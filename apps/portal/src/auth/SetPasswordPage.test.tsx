import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockUpdateUser = vi.fn();
const mockGetUser = vi.fn();

vi.mock('../api/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args)
    }
  }
}));

const mockRedirectTo = vi.fn();
vi.mock('../lib/navigation', () => ({
  redirectTo: (...args: unknown[]) => mockRedirectTo(...args)
}));

import { SetPasswordPage } from './SetPasswordPage';

describe('SetPasswordPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it('shows the form immediately when a session already exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: {} } } });
    render(
      <MemoryRouter>
        <SetPasswordPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByLabelText(/new password/i)).toBeInTheDocument());
  });

  it('shows an expired-link error when no session appears within the timeout', async () => {
    vi.useFakeTimers();
    mockGetSession.mockResolvedValue({ data: { session: null } });
    render(
      <MemoryRouter>
        <SetPasswordPage />
      </MemoryRouter>
    );
    await vi.advanceTimersByTimeAsync(3000);
    expect(screen.getByText(/link expired or invalid/i)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('rejects a password shorter than 8 characters', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: {} } } });
    render(
      <MemoryRouter>
        <SetPasswordPage />
      </MemoryRouter>
    );
    await waitFor(() => screen.getByLabelText(/new password/i));

    await userEvent.type(screen.getByLabelText(/new password/i), 'short');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'short');
    await userEvent.click(screen.getByRole('button', { name: /set password/i }));

    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: {} } } });
    render(
      <MemoryRouter>
        <SetPasswordPage />
      </MemoryRouter>
    );
    await waitFor(() => screen.getByLabelText(/new password/i));

    await userEvent.type(screen.getByLabelText(/new password/i), 'longenough1');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'longenough2');
    await userEvent.click(screen.getByRole('button', { name: /set password/i }));

    expect(screen.getByText(/do not match/i)).toBeInTheDocument();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('submits the new password and redirects a borrower to the portal dashboard', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: {} } } });
    mockUpdateUser.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({ data: { user: { app_metadata: { role: 'borrower' } } } });

    render(
      <MemoryRouter initialEntries={['/auth/set-password']}>
        <SetPasswordPage />
      </MemoryRouter>
    );
    await waitFor(() => screen.getByLabelText(/new password/i));

    await userEvent.type(screen.getByLabelText(/new password/i), 'longenough1');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'longenough1');
    await userEvent.click(screen.getByRole('button', { name: /set password/i }));

    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'longenough1' }));
    await waitFor(() => expect(screen.getByText(/password set/i)).toBeInTheDocument());
  });
});
