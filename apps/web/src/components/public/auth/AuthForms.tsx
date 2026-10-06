'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { safeNext } from '@/lib/safe-next';
import s from '../site.module.css';

type Provider = 'google' | 'microsoft';
const PROVIDER_LABEL: Record<Provider, string> = { google: 'Google', microsoft: 'Microsoft' };

const continueUrl = (params: Record<string, string | undefined>) => {
  const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1]));
  return `/auth/continue${q.size ? `?${q}` : ''}`;
};

function useSubmit() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  };
  return { pending, error, setError, notice, setNotice, run };
}

function Messages({ error, notice }: { error: string | null; notice: string | null }) {
  return (
    <>
      {error && (
        <p role="alert" className={s.notice} style={{ borderStyle: 'solid', borderColor: '#e6a3a3', background: '#fdf1f1', color: '#8a1f1f' }}>
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className={s.pending}>
          {notice}
        </p>
      )}
    </>
  );
}

function SocialButtons({ providers, callbackURL, label = 'Continue with' }: { providers: Provider[]; callbackURL: string; label?: string }) {
  const [busy, setBusy] = useState<Provider | null>(null);
  return (
    <>
      {(['google', 'microsoft'] as const).map((p) => {
        const on = providers.includes(p);
        return (
          <button
            key={p}
            type="button"
            className={s.btnOutline}
            disabled={!on || busy !== null}
            title={on ? undefined : `${PROVIDER_LABEL[p]} sign-in is not enabled`}
            onClick={async () => {
              setBusy(p);
              await authClient.signIn.social({ provider: p, callbackURL, errorCallbackURL: '/login?error=social' });
              setBusy(null);
            }}
          >
            {label} {PROVIDER_LABEL[p]}
          </button>
        );
      })}
    </>
  );
}

const LOGIN_ERRORS: Record<string, string> = {
  provisioning: 'Your account could not be set up. Please try again in a moment.',
  social: 'That sign-in could not be completed. Please try again.',
  INVALID_TOKEN: 'That link is invalid or has expired. Request a new one.',
  TOKEN_EXPIRED: 'That link has expired. Request a new one.',
};

export function LoginForm({ next, error: initialError, providers }: { next?: string; error?: string; providers: Provider[] }) {
  const router = useRouter();
  const { pending, error, setError, notice, setNotice, run } = useSubmit();
  const target = continueUrl({ next: safeNext(next) });
  const shownError = error ?? (initialError ? (LOGIN_ERRORS[initialError] ?? 'Sign-in failed. Please try again.') : null);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(async () => {
      const { error: err } = await authClient.signIn.email({
        email: String(f.get('email')),
        password: String(f.get('password')),
        rememberMe: f.get('remember') === 'on',
        callbackURL: target,
      });
      if (!err) return router.push(target);
      if (err.status === 403) return setNotice('Please verify your email address first. We have sent you a new verification link.');
      if (err.status === 429) return setError('Too many attempts. Please wait a moment and try again.');
      setError('Incorrect email or password.');
    });
  };

  return (
    <form className={s.form} style={{ gridTemplateColumns: '1fr' }} onSubmit={submit}>
      <Messages error={shownError} notice={notice} />
      <label>
        Email address
        <input className={s.input} type="email" name="email" autoComplete="email" placeholder="Enter your email" required />
      </label>
      <label>
        Password
        <input className={s.input} type="password" name="password" autoComplete="current-password" placeholder="Enter your password" required />
      </label>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
        <label style={{ display: 'flex', gap: 8, fontWeight: 400, alignItems: 'center' }}>
          <input type="checkbox" name="remember" defaultChecked /> Keep me signed in
        </label>
        <Link href="/forgot-password" style={{ fontWeight: 700 }}>
          Forgot password?
        </Link>
      </div>
      <button type="submit" className={s.btn} disabled={pending}>
        {pending ? 'Signing in…' : 'Sign In'}
      </button>
      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--mute)' }}>OR</div>
      <SocialButtons providers={providers} callbackURL={target} />
    </form>
  );
}

export function SignupForm({ website, providers, footer }: { website?: string; providers: Provider[]; footer?: ReactNode }) {
  const router = useRouter();
  const { pending, error, setError, run } = useSubmit();

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get('email'));
    run(async () => {
      const { error: err } = await authClient.signUp.email({
        name: String(f.get('name')).trim(),
        email,
        password: String(f.get('password')),
        callbackURL: continueUrl({ website: String(f.get('website') ?? '').trim() || undefined }),
      });
      if (!err) return router.push(`/verify-email?email=${encodeURIComponent(email)}`);
      if (err.status === 429) return setError('Too many attempts. Please wait a moment and try again.');
      if (err.code === 'PASSWORD_TOO_SHORT') return setError('Use at least 8 characters for your password.');
      setError(err.status === 422 || err.status === 400 ? 'Please check your details and try again.' : 'Your account could not be created. Please try again.');
    });
  };

  return (
    <>
      <SocialButtons providers={providers} callbackURL={continueUrl({})} />
      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--mute)', margin: '14px 0' }}>or with email</div>
      <form className={s.form} style={{ gridTemplateColumns: '1fr' }} onSubmit={submit}>
        <Messages error={error} notice={null} />
        <label>
          Full name
          <input className={s.input} name="name" autoComplete="name" placeholder="Your name" maxLength={160} required />
        </label>
        <label>
          Work email
          <input className={s.input} type="email" name="email" autoComplete="email" placeholder="you@company.com" required />
        </label>
        <label>
          Password
          <input className={s.input} type="password" name="password" autoComplete="new-password" minLength={8} maxLength={128} placeholder="At least 8 characters" required />
        </label>
        <label>
          Website to audit
          <input className={s.input} name="website" defaultValue={website} placeholder="yourwebsite.com" />
        </label>
        {footer}
        <button type="submit" className={s.btn} disabled={pending}>
          {pending ? 'Creating account…' : 'Create Account'} <ArrowRight size={18} />
        </button>
      </form>
    </>
  );
}

export function ForgotPasswordForm() {
  const { pending, error, notice, setNotice, run } = useSubmit();
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email'));
    run(async () => {
      // The response is identical whether or not the address has an account.
      await authClient.requestPasswordReset({ email, redirectTo: '/reset-password' });
      setNotice('If that email matches an account, a reset link is on its way. Check your inbox.');
    });
  };
  return (
    <form className={s.form} style={{ gridTemplateColumns: '1fr' }} onSubmit={submit}>
      <Messages error={error} notice={notice} />
      <label>
        Email address
        <input className={s.input} type="email" name="email" autoComplete="email" placeholder="Enter your email" required />
      </label>
      <button type="submit" className={s.btn} disabled={pending}>
        {pending ? 'Sending…' : 'Send Reset Link'}
      </button>
    </form>
  );
}

export function ResetPasswordForm({ token, error: linkError }: { token?: string; error?: string }) {
  const router = useRouter();
  const { pending, error, setError, run } = useSubmit();
  if (!token || linkError) {
    return (
      <>
        <Messages error="This reset link is invalid or has expired." notice={null} />
        <Link href="/forgot-password" className={s.btn} style={{ marginTop: 14, width: '100%' }}>
          Request a new link
        </Link>
      </>
    );
  }
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const newPassword = String(f.get('password'));
    if (newPassword !== String(f.get('confirm'))) return setError('The passwords do not match.');
    run(async () => {
      const { error: err } = await authClient.resetPassword({ newPassword, token });
      if (!err) return router.push('/login?reset=1');
      setError(err.code === 'INVALID_TOKEN' ? 'This reset link is invalid or has expired.' : 'Your password could not be updated. Please try again.');
    });
  };
  return (
    <form className={s.form} style={{ gridTemplateColumns: '1fr' }} onSubmit={submit}>
      <Messages error={error} notice={null} />
      <label>
        New password
        <input className={s.input} type="password" name="password" autoComplete="new-password" minLength={8} maxLength={128} placeholder="At least 8 characters" required />
      </label>
      <label>
        Confirm new password
        <input className={s.input} type="password" name="confirm" autoComplete="new-password" minLength={8} maxLength={128} placeholder="Re-enter your new password" required />
      </label>
      <button type="submit" className={s.btn} disabled={pending}>
        {pending ? 'Updating…' : 'Update Password'}
      </button>
    </form>
  );
}

export function ResendVerification({ email }: { email?: string }) {
  const { pending, error, notice, setNotice, run } = useSubmit();
  if (!email) return null;
  return (
    <>
      <button
        type="button"
        className={s.btnOutline}
        disabled={pending}
        onClick={() =>
          run(async () => {
            await authClient.sendVerificationEmail({ email, callbackURL: continueUrl({}) });
            setNotice('If this address is waiting for verification, a new link is on its way.');
          })
        }
      >
        {pending ? 'Sending…' : 'Resend Verification Email'}
      </button>
      <Messages error={error} notice={notice} />
    </>
  );
}

export function SignOutButton({ className, children }: { className?: string; children: ReactNode }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      role="menuitem"
      className={className}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        router.push('/login');
        router.refresh();
      }}
    >
      {children}
    </button>
  );
}
