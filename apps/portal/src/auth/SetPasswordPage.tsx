import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { redirectTo } from '../lib/navigation';
import { hasMinimumRole } from './roles';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert } from '../components/ui/alert';

type State = 'loading' | 'form' | 'success' | 'error';

export function SetPasswordPage() {
  const [state, setState] = useState<State>('loading');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    let settled = false;

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
        settled = true;
        setState('form');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        settled = true;
        setState('form');
      }
    });

    const timeout = setTimeout(() => {
      if (!settled) setState('error');
    }, 3000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError('');

    const form = e.currentTarget;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    const confirm = (form.elements.namedItem('confirm') as HTMLInputElement).value;

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setFormError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setFormError(error.message);
      setSubmitting(false);
      return;
    }

    setState('success');
    const {
      data: { user }
    } = await supabase.auth.getUser();
    const role = user?.app_metadata?.role || user?.user_metadata?.role || 'borrower';
    const nextParam = searchParams.get('next');
    const destination = nextParam
      ? decodeURIComponent(nextParam)
      : hasMinimumRole(role, 'base_admin')
        ? '/admin/dashboard'
        : '/user-portal/dashboard';

    setTimeout(() => redirectTo(destination), 1500);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <img src="/algolend-logo.png" alt="AlgoLend" className="h-14 object-contain" />
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
          {state === 'loading' && (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-purple-500" />
              <p className="text-sm text-gray-500">Verifying your invite link…</p>
            </div>
          )}

          {state === 'form' && (
            <>
              <h1 className="mb-1 text-xl font-black text-gray-900">Welcome to AlgoLend</h1>
              <p className="mb-6 text-sm text-gray-500">Set a password to secure your account.</p>
              {formError && <Alert variant="error">{formError}</Alert>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="password">New Password</Label>
                  <Input id="password" name="password" type="password" required minLength={8} placeholder="Min 8 characters" />
                </div>
                <div>
                  <Label htmlFor="confirm">Confirm Password</Label>
                  <Input id="confirm" name="confirm" type="password" required minLength={8} placeholder="Repeat password" />
                </div>
                <Button type="submit" className="mt-2 w-full" disabled={submitting}>
                  Set Password & Continue
                </Button>
              </form>
            </>
          )}

          {state === 'success' && (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
                <svg className="h-7 w-7 text-green-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mb-1 text-lg font-black text-gray-900">Password set!</h2>
              <p className="text-sm text-gray-500">Redirecting you to the dashboard…</p>
            </div>
          )}

          {state === 'error' && (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                <svg className="h-7 w-7 text-red-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="mb-1 text-lg font-black text-gray-900">Link expired or invalid</h2>
              <p className="mb-4 text-sm text-gray-500">Ask your administrator to resend the invite.</p>
              <a href="/auth/login" className="text-sm font-bold text-primary hover:underline">
                Go to Login
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
