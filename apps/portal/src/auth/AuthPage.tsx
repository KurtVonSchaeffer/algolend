import { useState, type FormEvent } from 'react';
import { supabase } from '../api/supabaseClient';
import { redirectTo } from '../lib/navigation';
import { hasMinimumRole, type MinimalSession } from './roles';
import { useTheme } from '../theme/ThemeProvider';
import { DEFAULT_CAROUSEL_SLIDES } from '../theme/constants';
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
  login:  { heading: 'Welcome Back!',   sub: 'Sign in to your account',              button: 'Sign In' },
  signup: { heading: 'Create Account',  sub: 'Enter your details to get started',    button: 'Sign Up' },
  forgot: { heading: 'Forgot Password', sub: 'Enter your email to receive a reset link', button: 'Send Reset Link' }
};

// 4 slide photos matching the reference repo order
const SLIDE_PHOTOS = [
  '/photo-piggybank.jpg',
  '/photo-newhome.jpg',
  '/photo-family.jpg',
  '/photo-finance.jpg'
];

async function resolveRedirectPath(session: MinimalSession): Promise<string> {
  const role = session?.user?.app_metadata?.role || '';
  return hasMinimumRole(role, 'base_admin') ? '/admin-panel/dashboard' : '/user-portal/dashboard';
}

export function AuthPage() {
  const { theme } = useTheme();
  const [view, setView]             = useState<ViewState>('login');
  const [message, setMessage]       = useState<FormMessage>({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  const slides = theme.carousel_slides.length > 0 ? theme.carousel_slides : DEFAULT_CAROUSEL_SLIDES;
  const logoUrl     = theme.company_logo_url || '/algolend-logo.png';
  const companyName = theme.company_name     || 'AlgoLend';
  const ncrNumber   = theme.ncr_number       ?? null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    const form  = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;

    try {
      if (view === 'login') {
        const password = (form.elements.namedItem('password') as HTMLInputElement).value;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        redirectTo(await resolveRedirectPath(data.session as unknown as MinimalSession));

      } else if (view === 'signup') {
        const password = (form.elements.namedItem('password') as HTMLInputElement).value;
        const fullName = (form.elements.namedItem('fullName') as HTMLInputElement).value;
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { data: { full_name: fullName } }
        });
        if (error) throw error;
        if (data.user) {
          await supabase.from('profiles').insert({
            id: data.user.id, full_name: fullName,
            email: data.user.email, role: 'borrower'
          });
          setView('login');
          setMessage({ type: 'success', text: 'Account created! Check your email to confirm. After confirming your email and logging in, you will be required to complete BOTH Financial Information and Declarations to unlock the user portal.' });
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/set-password`
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Password reset link sent to your email.' });
        setView('login');
      }
    } catch (err) {
      const text =
        err instanceof Error ? err.message
        : typeof err === 'object' && err !== null && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'Something went wrong.';
      setMessage({ type: 'error', text });
    } finally {
      setSubmitting(false);
    }
  }

  const copy = COPY[view];

  return (
    <>
      <style>{`
        @keyframes photoFade {
          0%   { opacity: 0; transform: scale(1.03); }
          5%   { opacity: 1; transform: scale(1.03); }
          22%  { opacity: 1; transform: scale(1.0);  }
          25%  { opacity: 0; transform: scale(1.0);  }
          100% { opacity: 0; transform: scale(1.0);  }
        }
        @keyframes textFade {
          0%   { opacity: 1; transform: translateY(0);    }
          27%  { opacity: 1; transform: translateY(0);    }
          33%  { opacity: 0; transform: translateY(-6px); }
          100% { opacity: 0; transform: translateY(0);    }
        }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh', background: '#FDF9F6' }}>

        {/* ── Left panel ── */}
        <div className="auth-left-panel" style={{ position: 'relative', width: '52%', flexShrink: 0, overflow: 'hidden' }}>

          {/* 4 cycling slide backgrounds — pure CSS, staggered 5s each */}
          {SLIDE_PHOTOS.map((src, i) => (
            <div
              key={src}
              style={{
                position: 'absolute', inset: 0,
                backgroundImage: `url('${src}')`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                animationName: 'photoFade',
                animationDuration: '20s',
                animationTimingFunction: 'linear',
                animationDelay: `${i * 5}s`,
                animationIterationCount: 'infinite',
                animationFillMode: 'both',
              }}
            />
          ))}

          {/* Gradient overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(15,23,42,0.60) 0%, rgba(43,21,81,0.40) 50%, rgba(15,23,42,0.55) 100%)'
          }} />

          {/* Content */}
          <div style={{
            position: 'relative', zIndex: 2,
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            height: '100%', padding: '48px'
          }}>
            {/* Logo */}
            <img
              src={logoUrl} alt={companyName}
              style={{ height: 70, width: 'auto', maxWidth: 320, objectFit: 'contain', objectPosition: 'left', filter: 'brightness(0) invert(1)' }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />

            {/* Carousel body */}
            <div style={{ maxWidth: 440 }}>
              {/* Badge */}
              <div style={{
                display: 'inline-block',
                background: 'rgba(91,33,182,0.30)',
                color: 'rgba(255,255,255,0.9)',
                border: '1px solid rgba(91,33,182,0.65)',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '5px 14px', borderRadius: 100,
                marginBottom: 20
              }}>
                Registered Credit Provider
              </div>

              {/* Slide titles — cycle with the same staggered animation */}
              <div style={{ position: 'relative', minHeight: 120 }}>
                {slides.map((slide, i) => (
                  <div
                    key={i}
                    style={{
                      position: i === 0 ? 'relative' : 'absolute',
                      top: 0, left: 0,
                      opacity: 0,
                      animation: `textFade ${slides.length * 5}s linear ${i * 5}s infinite`
                    }}
                  >
                    <h2 style={{ fontSize: 36, fontWeight: 700, color: '#fff', lineHeight: 1.2, margin: '0 0 16px', letterSpacing: '-0.5px' }}>
                      {slide.title}
                    </h2>
                    <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>
                      {slide.text}
                    </p>
                  </div>
                ))}
              </div>

              {/* Dots — static indicators, one per slide */}
              <div style={{ display: 'flex', gap: 6, marginTop: 32 }}>
                {slides.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      height: 4, width: 24, borderRadius: 2,
                      background: 'rgba(255,255,255,0.3)'
                    }}
                  />
                ))}
              </div>
            </div>

            {/* NCR footer */}
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
              NCR Registered{ncrNumber ? ` · ${ncrNumber}` : ''}
            </p>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', minHeight: '100vh' }}>
          <div className="w-full" style={{ maxWidth: 420 }}>

            {/* Mobile logo */}
            <div className="flex justify-center mb-8 md:hidden">
              <img src={logoUrl} alt={companyName} className="h-10 object-contain" />
            </div>

            {message.text && (
              <div className="mb-6">
                <Alert variant={message.type === 'success' ? 'success' : 'error'}>{message.text}</Alert>
              </div>
            )}

            <h2 className="mb-1 text-2xl font-black text-gray-900">{copy.heading}</h2>
            <p className="mb-8 text-sm text-gray-500">{copy.sub}</p>

            <form onSubmit={handleSubmit} className="space-y-5">
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
                    id="password" name="password" type="password"
                    autoComplete={view === 'signup' ? 'new-password' : 'current-password'}
                    required minLength={6} placeholder="••••••••"
                  />
                </div>
              )}

              {view === 'login' && (
                <div className="flex justify-end">
                  <button type="button" className="text-sm font-bold text-primary hover:underline" onClick={() => setView('forgot')}>
                    Forgot Password?
                  </button>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {copy.button}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400">or</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <p className="text-center text-sm text-gray-500">
              {view === 'login' && (
                <>Don&apos;t have an account?{' '}
                  <button type="button" className="font-bold text-primary hover:underline"
                    onClick={() => { setView('signup'); setMessage({ type: '', text: '' }); }}>
                    Register
                  </button>
                </>
              )}
              {view === 'signup' && (
                <>Already have an account?{' '}
                  <button type="button" className="font-bold text-primary hover:underline"
                    onClick={() => { setView('login'); setMessage({ type: '', text: '' }); }}>
                    Login
                  </button>
                </>
              )}
              {view === 'forgot' && (
                <>Remembered your password?{' '}
                  <button type="button" className="font-bold text-primary hover:underline"
                    onClick={() => { setView('login'); setMessage({ type: '', text: '' }); }}>
                    Login
                  </button>
                </>
              )}
            </p>

            <p className="mt-10 text-center text-[11px] leading-relaxed text-gray-400">
              {companyName} is an authorised financial services provider
              {ncrNumber ? ` · ${ncrNumber}` : ''}
              {' '}© {new Date().getFullYear()} {companyName}. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
