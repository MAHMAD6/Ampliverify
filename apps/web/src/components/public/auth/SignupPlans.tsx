'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, Building2, CheckCircle2, Circle, Eye, EyeOff, Info, Rocket, Sprout, Users, BarChart3 } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { PASSWORD_RULES } from '@/lib/password-policy';
import s from '../site.module.css';
import a from '../auth.module.css';

export type SignupPlan = { code: string; name: string; monthly: number | null; annual: number | null; currency: string; features: string[]; featured: boolean };
type Provider = 'google' | 'microsoft';

const ICONS = [<Sprout key="0" size={26} />, <Rocket key="1" size={26} />, <BarChart3 key="2" size={26} />, <Users key="3" size={26} />];
const TONES = ['#e9f7ee', '#e8f0fe', '#e9f7ee', '#f1ecfe'];
const money = (n: number, c: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);

/**
 * Sign Up (Public_Frontend/Signup_Login). Plans come from the public plan
 * catalog; the chosen plan is subscribed to from Billing & Plan after the
 * email is verified (Stripe Checkout needs a workspace). The password rules
 * are also enforced by the auth server.
 */
export function SignupPlans({ plans, website, defaultPlan, defaultInterval, providers, allowSignup, next }: { plans: SignupPlan[]; website?: string; defaultPlan?: string; defaultInterval: 'monthly' | 'annual'; providers: Provider[]; allowSignup: boolean; next?: string }) {
  const router = useRouter();
  const [interval, setInterval] = useState<'monthly' | 'annual'>(defaultInterval);
  const [plan, setPlan] = useState(defaultPlan && plans.some((p) => p.code === defaultPlan) ? defaultPlan : (plans[0]?.code ?? 'free'));
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [social, setSocial] = useState(false);
  const save = useMemo(() => {
    const pct = plans.map((p) => (p.monthly && p.annual ? Math.round((1 - p.annual / (p.monthly * 12)) * 100) : 0)).filter((x) => x > 0);
    return pct.length ? Math.max(...pct) : 0;
  }, [plans]);
  const rulesOk = PASSWORD_RULES.every((r) => r.test(password));
  const chosen = plans.find((p) => p.code === plan);

  const continueTo = (websiteValue?: string) => {
    const q = new URLSearchParams();
    if (websiteValue) q.set('website', websiteValue);
    if (next) q.set('next', next);
    else if (chosen && (chosen.monthly ?? 0) > 0) q.set('next', `/app/billing?plan=${encodeURIComponent(chosen.code)}&interval=${interval}`);
    return `/auth/continue${q.size ? `?${q}` : ''}`;
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get('email')).trim();
    const site = String(f.get('website') ?? '').trim();
    if (!rulesOk) return setError('Choose a password that meets every rule below.');
    setPending(true);
    setError(null);
    try {
      const { error: err } = await authClient.signUp.email({ name: email.split('@')[0].slice(0, 160), email, password, callbackURL: continueTo(site || undefined) });
      if (!err) return router.push(`/verify-email?email=${encodeURIComponent(email)}`);
      if (err.status === 429) return setError('Too many attempts. Please wait a moment and try again.');
      if (err.status === 403) return setError(err.message ?? 'New sign-ups are currently closed.');
      if (err.code === 'PASSWORD_TOO_WEAK' || err.code === 'PASSWORD_TOO_SHORT') return setError(err.message ?? 'Choose a stronger password.');
      setError(err.status === 422 || err.status === 400 ? 'Please check your details and try again.' : 'Your account could not be created. Please try again.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={a.signup}>
      <div className={a.signupHead}>
        <div>
          <h1 className={s.h2} style={{ fontSize: 'clamp(28px,3vw,38px)', margin: 0 }}>
            Get Started with AmpliVerify
          </h1>
          <p className={s.cardText} style={{ fontSize: 17 }}>
            Choose a plan and create your account in under a minute.
          </p>
        </div>
        <div className={a.interval} role="radiogroup" aria-label="Billing interval">
          {(['monthly', 'annual'] as const).map((i) => (
            <button key={i} type="button" role="radio" aria-checked={interval === i} className={interval === i ? a.intervalOn : undefined} onClick={() => setInterval(i)}>
              {i === 'monthly' ? 'Monthly' : 'Annual'}
            </button>
          ))}
          {save > 0 && <span className={a.saveBadge}>Save {save}%</span>}
        </div>
      </div>

      <div className={a.planGrid} role="radiogroup" aria-label="Plan">
        {plans.map((p, i) => {
          const price = interval === 'annual' && p.annual !== null ? p.annual / 12 : p.monthly;
          const on = plan === p.code;
          return (
            <button key={p.code} type="button" role="radio" aria-checked={on} className={`${a.planCard} ${on ? a.planOn : ''} ${p.featured ? a.planFeatured : ''}`} onClick={() => setPlan(p.code)}>
              {p.featured && <span className={a.popular}>Most Popular</span>}
              <span className={a.planIcon} style={{ background: TONES[i % TONES.length] }}>
                {ICONS[i % ICONS.length]}
              </span>
              <b>{p.name}</b>
              <span className={a.planPrice}>{price === null ? 'Custom' : money(price, p.currency)}</span>
              <small>{price === null ? 'Contact for pricing.' : 'per month'}</small>
              {interval === 'annual' && p.annual !== null && p.monthly ? (
                <small>
                  {money(p.annual, p.currency)} billed annually
                  {p.monthly * 12 > p.annual && <em> Save {Math.round((1 - p.annual / (p.monthly * 12)) * 100)}%</em>}
                </small>
              ) : (
                <small>&nbsp;</small>
              )}
              <ul>
                {p.features.slice(0, 3).map((f) => (
                  <li key={f}>
                    <CheckCircle2 size={15} /> {f}
                  </li>
                ))}
              </ul>
              <span className={a.planPick}>{on ? <CheckCircle2 size={22} /> : <Circle size={22} />}</span>
              <span className={`${a.planCta} ${on ? a.planCtaOn : ''}`}>{on ? (i === 0 && !p.monthly ? 'Current Plan' : 'Selected') : `Choose ${p.name}`}</span>
            </button>
          );
        })}
        <Link href="/contact?topic=sales" className={a.planCard} style={{ background: '#fff8e8' }}>
          <span className={a.planIcon} style={{ background: '#fff1cc', color: '#b45309' }}>
            <Building2 size={26} />
          </span>
          <b>Enterprise</b>
          <span className={a.planPrice}>Custom</span>
          <small>Contact for pricing.</small>
          <small>&nbsp;</small>
          <ul>
            {['Custom limits', 'Dedicated support', 'Security review'].map((f) => (
              <li key={f}>
                <CheckCircle2 size={15} /> {f}
              </li>
            ))}
          </ul>
          <span className={a.planCta} style={{ borderColor: '#e0b84a', color: '#8a5a00' }}>
            Contact Sales
          </span>
        </Link>
      </div>
      <p style={{ textAlign: 'right', margin: '8px 0 18px' }}>
        <Link href="/pricing" className={s.learn} style={{ color: '#1d4ed8' }}>
          Compare all features <ArrowRight size={16} />
        </Link>
      </p>

      {!allowSignup && <p className={s.notice}>Sign-up is currently by invitation only. If you were invited, use the email address your invitation was sent to.</p>}

      {providers.includes('google') && (
        <button
          type="button"
          className={a.googleBtn}
          disabled={social}
          onClick={async () => {
            setSocial(true);
            await authClient.signIn.social({ provider: 'google', callbackURL: continueTo() }).catch(() => setSocial(false));
          }}
        >
          <span className={a.gMark}>G</span> Continue with Google
        </button>
      )}
      <div className={a.or}>or create with email</div>

      <form className={a.signupForm} onSubmit={submit}>
        {error && (
          <p role="alert" className={s.notice} style={{ gridColumn: '1 / -1', borderStyle: 'solid', borderColor: '#e6a3a3', background: '#fdf1f1', color: '#8a1f1f' }}>
            {error}
          </p>
        )}
        <div style={{ display: 'grid', gap: 8 }}>
          <label className={a.lbl} htmlFor="su-email">
            Email address <span className={s.req}>*</span>
          </label>
          <input id="su-email" className={s.input} type="email" name="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} />
          <small className={a.help}>Use any email (personal or business). We&apos;ll send a verification link.</small>
          <label className={a.lbl} htmlFor="su-pass" style={{ marginTop: 8 }}>
            Password <span className={s.req}>*</span>
          </label>
          <span className={a.pwWrap}>
            <input id="su-pass" className={s.input} type={show ? 'text' : 'password'} name="password" autoComplete="new-password" placeholder="Create a strong password" required maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)}>
              {show ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </span>
          <div className={a.rules} aria-live="polite">
            <b>Password must include:</b>
            {PASSWORD_RULES.map((r) => {
              const ok = r.test(password);
              return (
                <span key={r.key} className={ok ? a.ruleOk : undefined}>
                  {ok ? <CheckCircle2 size={16} /> : <Circle size={16} />} {r.label}
                </span>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
          <label className={a.lbl} htmlFor="su-site">
            Website to audit <span className={a.help}>(Optional)</span> <Info size={14} aria-hidden />
          </label>
          <input id="su-site" className={s.input} name="website" defaultValue={website} placeholder="https://yourwebsite.com" maxLength={253} />
          <small className={a.help}>You can add a website now or later.</small>
          <label className={a.lbl} htmlFor="su-plan" style={{ marginTop: 8 }}>
            Plan <span className={s.req}>*</span>
          </label>
          <select id="su-plan" className={s.input} value={plan} onChange={(e) => setPlan(e.target.value)}>
            {plans.map((p) => {
              const price = interval === 'annual' && p.annual !== null ? p.annual / 12 : p.monthly;
              return (
                <option key={p.code} value={p.code}>
                  {p.name} – {price === null ? 'Custom' : `${money(price, p.currency)}/month`}
                </option>
              );
            })}
          </select>
          <small className={a.help}>
            Need a custom plan?{' '}
            <Link href="/contact?topic=sales" style={{ color: '#15803d', fontWeight: 600 }}>
              Contact sales
            </Link>
            {chosen && (chosen.monthly ?? 0) > 0 && <> · You&apos;ll confirm payment for {chosen.name} after verifying your email.</>}
          </small>
        </div>
        <button type="submit" className={`${s.btn} ${a.submit}`} disabled={pending || !rulesOk}>
          {pending ? 'Creating account…' : 'Create Account & Run Audit'} <ArrowRight size={20} />
        </button>
        <p className={a.terms}>
          By creating an account, you agree to our <Link href="/legal#terms">Terms of Service</Link> and <Link href="/legal#privacy">Privacy Policy</Link>.
        </p>
      </form>
    </div>
  );
}
