import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { TrendArt } from '@/components/public/Blocks';
import { SignupForm } from '@/components/public/auth/AuthForms';
import { apiList } from '@/lib/api';
import { enabledSocialProviders } from '@/lib/auth';
import { getPlatformInfo } from '@/lib/platform';
import type { PublicPlan } from '@/lib/types';
import s from '@/components/public/site.module.css';
import a from '@/components/public/auth.module.css';

export const metadata: Metadata = { title: 'Start Free' };

/**
 * Sign Up (public-website-v2/12). Website and plan prefill from the Home and
 * Pricing CTAs. Better Auth creates the account and sends the verification
 * link; the website is carried through it to Add Project. A plan chosen on
 * Pricing is subscribed to from Billing & Plan after sign-in (Stripe
 * Checkout needs a workspace). When sign-up is closed, only invited people
 * can create an account (enforced by the auth server).
 */
export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ website?: string; plan?: string }> }) {
  const [{ website, plan }, plans, platform] = await Promise.all([searchParams, apiList<PublicPlan>('/public/plans'), getPlatformInfo()]);
  const selected = plan ? plans.find((p) => p.code === plan) : undefined;
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
          {!platform.allowSignup && (
            <p className={s.notice} style={{ marginTop: 12 }}>
              Sign-up is currently by invitation only. If you were invited, use the email address your invitation was sent to.
            </p>
          )}
          <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
            <SignupForm
              website={website}
              providers={enabledSocialProviders}
              footer={
                selected && (
                  <p className={s.pending}>
                    You chose the <b>{selected.name}</b> plan. After you sign in, subscribe to it from Billing &amp; Plan.
                  </p>
                )
              }
            />
          </div>
          <p className={s.cardText} style={{ textAlign: 'center', marginTop: 14, fontSize: 13 }}>
            By continuing you agree to our <Link href="/legal#terms">Terms of Service</Link> and <Link href="/legal#privacy">Privacy Policy</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}
