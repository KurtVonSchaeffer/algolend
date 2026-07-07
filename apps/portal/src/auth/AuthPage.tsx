import { useState, type FormEvent } from 'react';
import { supabase } from '../api/supabaseClient';
import { redirectTo } from '../lib/navigation';
import { hasMinimumRole, type MinimalSession } from './roles';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert } from '../components/ui/alert';

type ViewState = 'login' | 'signup' | 'forgot';

interface FormMessage {
  type: 'success' | 'error' | '';
  text: string;
}

const COPY: Record<ViewState, { heading: string; sub: string; button: string }> = {
  login: { heading: 'Welcome Back!', sub: 'Sign in to your account', button: 'Sign In' },
  signup: { heading: 'Create Account', sub: 'Enter your details to get started', button: 'Sign Up' },
  forgot: { heading: 'Forgot Password', sub: 'Enter your email to receive a reset link', button: 'Send Reset Link' }
};

async function resolveRedirectPath(session: MinimalSession): Promise<string> {
  const role = session?.user?.app_metadata?.role || session?.user?.user_metadata?.role || '';
  return hasMinimumRole(role, 'base_admin') ? '/admin/dashboard' : '/user-portal/dashboard';
}

export function AuthPage() {
  const [view, setView] = useState<ViewState>('login');
  const [message, setMessage] = useState<FormMessage>({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;

    try {
      if (view === 'login') {
        const password = (form.elements.namedItem('password') as HTMLInputElement).value;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const redirectPath = await resolveRedirectPath(data.session as unknown as MinimalSession);
        redirectTo(redirectPath);
      } else if (view === 'signup') {
        const password = (form.elements.namedItem('password') as HTMLInputElement).value;
        const fullName = (form.elements.namedItem('fullName') as HTMLInputElement).value;

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } }
        });
        if (error) throw error;

        if (data.user) {
          await supabase.from('profiles').insert({
            id: data.user.id,
            full_name: fullName,
            email: data.user.email,
            role: 'borrower'
          });
          setView('login');
          setMessage({
            type: 'success',
            text: 'Account created! Check your email to confirm. After confirming your email and logging in, you will be required to complete BOTH Financial Information and Declarations to unlock the user portal.'
          });
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/set-password`
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Password reset link sent to your email.' });
        setView('login');
      }
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string'
            ? (error as { message: string }).message
            : 'Something went wrong.';
      setMessage({ type: 'error', text });
    } finally {
      setSubmitting(false);
    }
  }

  const copy = COPY[view];

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FDF9F6] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <img src="/algolend-logo.png" alt="AlgoLend" className="h-14 object-contain" />
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
          <h2 className="mb-1 text-2xl font-black text-gray-900">{copy.heading}</h2>
          <p className="mb-6 text-sm text-gray-500">{copy.sub}</p>

          {message.text && <Alert variant={message.type === 'success' ? 'success' : 'error'}>{message.text}</Alert>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {view === 'signup' && (
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" name="fullName" type="text" required placeholder="John Smith" />
              </div>
            )}

            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required placeholder="info@example.com" />
            </div>

            {view !== 'forgot' && (
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={view === 'signup' ? 'new-password' : 'current-password'}
                  required
                  minLength={6}
                  placeholder="••••••••"
                />
              </div>
            )}

            {view === 'login' && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-gray-600">
                  <input type="checkbox" defaultChecked /> Remember me
                </label>
                <button type="button" className="font-bold text-primary" onClick={() => setView('forgot')}>
                  Forgot Password?
                </button>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {copy.button}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            {view === 'login' && (
              <>
                Don&apos;t have an account?{' '}
                <button type="button" className="font-bold text-primary" onClick={() => setView('signup')}>
                  Register
                </button>
              </>
            )}
            {view === 'signup' && (
              <>
                Already have an account?{' '}
                <button type="button" className="font-bold text-primary" onClick={() => setView('login')}>
                  Login
                </button>
              </>
            )}
            {view === 'forgot' && (
              <>
                Remembered your password?{' '}
                <button type="button" className="font-bold text-primary" onClick={() => setView('login')}>
                  Login
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
