import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { TrendArt } from '@/components/public/Blocks';
import { apiList } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { PublicPlan } from '@/lib/types';
import s from '@/components/public/site.module.css';
import a from '@/components/public/auth.module.css';

export const metadata: Metadata = { title: 'Start Free' };

/**
 * Sign Up (public-website-v2/12). Website and plan prefill from the Home and
 * Pricing CTAs; plan options come from published plans. Account creation is
 * handled by Better Auth, which is not connected yet, so submit is disabled.
 */
export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ website?: string; plan?: string }> }) {
  const { website, plan } = await searchParams;
  const plans = await apiList<PublicPlan>('/public/plans');
  const priced = plans.filter((p) => p.prices.some((x) => x.billingInterval === 'MONTHLY'));
  return (
    <div className={a.split}>
      <aside className={a.side}>
        <Link href="/" className={a.brand}>
          <Image src="/brand/mark-transparent.png" alt="" width={44} height={44} />
          <span>
            <b>AMPLIVERIFY</b>
            <small>AUDIT · OPTIMIZE · VERIFY</small>
          </span>
        </Link>
        <div>
          <h1 className={s.h1} style={{ color: '#fff' }}>
            Start Free Today
          </h1>
          <ul className={a.points}>
            {['A prioritized plan, ranked by impact', 'Built for search engines and AI search', 'Upgrade, downgrade or cancel anytime'].map((x) => (
              <li key={x}>
                <Check size={16} /> {x}
              </li>
            ))}
          </ul>
        </div>
        <div className={a.art}>
          <TrendArt dark />
        </div>
      </aside>
      <main className={a.main}>
        <Link href="/" className={a.back}>
          Back to Site
        </Link>
        <div className={a.panel}>
          <div className={a.tabs} role="tablist">
            <span role="tab" aria-selected="true" className={a.tabOn}>
              Create Account
            </span>
            <Link role="tab" aria-selected="false" href="/login">
              Log In
            </Link>
          </div>
          <h2 className={s.h2} style={{ fontSize: 34 }}>
            Start Your Free Audit
          </h2>
          <p className={s.cardText}>Create your account in under a minute.</p>
          <button type="button" className={s.btnOutline} style={{ width: '100%', marginTop: 20 }} disabled>
            Continue with Google
          </button>
          <div className={a.or}>or with email</div>
          <form className={s.form} style={{ gridTemplateColumns: '1fr' }}>
            <label>
              Work email
              <input className={s.input} type="email" name="email" autoComplete="email" placeholder="you@company.com" required />
            </label>
            <label>
              Password
              <input className={s.input} type="password" name="password" autoComplete="new-password" minLength={8} placeholder="At least 8 characters" required />
            </label>
            <label>
              Website to audit
              <input className={s.input} name="website" defaultValue={website} placeholder="yourwebsite.com" />
            </label>
            {priced.length > 0 && (
              <label>
                Plan
                <select className={s.input} name="plan" defaultValue={plan ?? priced[0].code}>
                  {priced.map((p) => {
                    const m = p.prices.find((x) => x.billingInterval === 'MONTHLY')!;
                    return (
                      <option key={p.code} value={p.code}>
                        {p.name} — {formatMoney(m.amountMinor, m.currency)}/month
                      </option>
                    );
                  })}
                </select>
                <small style={{ fontWeight: 400, color: 'var(--mute)' }}>
                  Need Enterprise? <Link href="/contact?topic=sales">Contact sales</Link>
                </small>
              </label>
            )}
            <button type="submit" className={s.btn} disabled>
              Create Account &amp; Run Audit <ArrowRight size={18} />
            </button>
          </form>
          <p className={s.pending} style={{ marginTop: 14 }}>
            Account creation opens soon. Your website address is kept only in this page until then.
          </p>
          <p className={s.cardText} style={{ textAlign: 'center', marginTop: 14, fontSize: 13 }}>
            By continuing you agree to our <Link href="/legal#terms">Terms of Service</Link> and <Link href="/legal#privacy">Privacy Policy</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}
