import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn((..._args: unknown[]) => ({ insert: vi.fn().mockResolvedValue({}) }));

vi.mock('../api/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args)
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args)
  }
}));

const mockRedirectTo = vi.fn();
vi.mock('../lib/navigation', () => ({
  redirectTo: (...args: unknown[]) => mockRedirectTo(...args)
}));

import { AuthPage } from './AuthPage';

function renderAuthPage() {
  return render(
    <MemoryRouter>
      <AuthPage />
    </MemoryRouter>
  );
}

describe('AuthPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders the login form by default', () => {
    renderAuthPage();
    expect(screen.getByRole('heading', { name: 'Welcome Back!' })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it('logs in a borrower and redirects to the portal dashboard', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: { user: { app_metadata: { role: 'borrower' }, user_metadata: {} } } },
      error: null
    });

    renderAuthPage();
    await userEvent.type(screen.getByLabelText(/email address/i), 'jane@example.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'sup3rSecret');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => expect(mockRedirectTo).toHaveBeenCalledWith('/user-portal/dashboard'));
  });

  it('logs in an admin and redirects to the admin dashboard', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: { user: { app_metadata: { role: 'super_admin' }, user_metadata: {} } } },
      error: null
    });

    renderAuthPage();
    await userEvent.type(screen.getByLabelText(/email address/i), 'admin@example.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'sup3rSecret');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => expect(mockRedirectTo).toHaveBeenCalledWith('/admin/dashboard'));
  });

  it('shows an error message when login fails', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } });

    renderAuthPage();
    await userEvent.type(screen.getByLabelText(/email address/i), 'jane@example.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'wrongpassword');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => expect(screen.getByText('Invalid login credentials')).toBeInTheDocument());
  });

  it('switches to the signup view and creates a profile row on success', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: 'user-1', email: 'new@example.com' } }, error: null });

    renderAuthPage();
    await userEvent.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByRole('heading', { name: 'Create Account' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/full name/i), 'Jane Doe');
    await userEvent.type(screen.getByLabelText(/email address/i), 'new@example.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'sup3rSecret');
    await userEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

    await waitFor(() =>
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'sup3rSecret',
        options: { data: { full_name: 'Jane Doe' } }
      })
    );
    expect(mockFrom).toHaveBeenCalledWith('profiles');
  });

  it('switches to forgot-password and redirects the reset link to set-password (bug fix)', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    renderAuthPage();
    await userEvent.click(screen.getByRole('button', { name: 'Forgot Password?' }));
    expect(screen.getByRole('heading', { name: 'Forgot Password' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/email address/i), 'jane@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    await waitFor(() =>
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('jane@example.com', {
        redirectTo: expect.stringContaining('/auth/set-password')
      })
    );
  });
});
