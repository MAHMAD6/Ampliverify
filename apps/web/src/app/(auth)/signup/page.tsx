import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, FileSearch, RefreshCw, BarChart3 } from 'lucide-react';
import { SignupPlans, type SignupPlan } from '@/components/public/auth/SignupPlans';
import { apiList } from '@/lib/api';
import { enabledSocialProviders } from '@/lib/auth';
import { getPlatformInfo } from '@/lib/platform';
import { safeNext } from '@/lib/safe-next';
import type { PublicPlan } from '@/lib/types';
import a from '@/components/public/auth.module.css';

export const metadata: Metadata = { title: 'Create Your Account' };

function toCard(p: PublicPlan): SignupPlan {
  const price = (i: 'MONTHLY' | 'ANNUAL') => {
    const row = p.prices.find((x) => x.billingInterval === i);
    return row ? Number(row.amountMinor) / 100 : null;
  };
  const features = p.entitlements
    .filter((e) => e.enabled)
    .map((e) => (e.feature.valueType === 'LIMIT' && e.limitNumeric ? `${Number(e.limitNumeric).toLocaleString('en-US')} ${e.feature.name.toLowerCase()}` : e.feature.name));
  return { code: p.code, name: p.name, monthly: price('MONTHLY'), annual: price('ANNUAL'), currency: p.prices[0]?.currency ?? 'USD', features: features.length ? features : p.description ? [p.description] : [], featured: !!p.isFeatured };
}

/**
 * Sign Up (Public_Frontend/Signup_Login, identical to Pricing.png). Website
 * and plan prefill from Home, Pricing and the Website Value Calculator.
 */
export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ website?: string; plan?: string; interval?: string; next?: string }> }) {
  const [{ website, plan, interval, next }, plans, platform] = await Promise.all([searchParams, apiList<PublicPlan>('/public/plans'), getPlatformInfo()]);
  const cards = plans.map(toCard).sort((x, y) => (x.monthly ?? Infinity) - (y.monthly ?? Infinity));
  if (!cards.some((c) => c.monthly === 0)) cards.unshift({ code: 'free', name: 'Free', monthly: 0, annual: 0, currency: cards[0]?.currency ?? 'USD', features: ['Start your first SEO audit', 'Core SEO tools', 'Upgrade anytime'], featured: false });
  const free = cards.find((c) => c.monthly === 0);
  return (
    <div className={a.split}>
      <aside className={`${a.side} ${a.sideBlue}`}>
        <Link href="/" className={a.brand}>
          <Image src="/brand/mark-transparent.png" alt="" width={52} height={52} />
          <span>
            <b>
              Ampli<span style={{ color: '#5cc23a' }}>Verify</span>
            </b>
            <small>AUDIT · OPTIMIZE · VERIFY</small>
          </span>
        </Link>
        <div>
          <h1 className={a.sideTitle}>
            Create Your <span>AmpliVerify</span> Account
          </h1>
          <p className={a.sideLead}>Choose a plan and start your first SEO audit in under a minute.</p>
          <ul className={a.sidePoints}>
            <li>
              <span style={{ background: '#15803d' }}>
                <FileSearch size={26} />
              </span>
              <span>
                <b>{free?.name ?? 'Free'} plan to get started</b>
                <small>{free?.features[0] ?? 'Get detailed on-page analysis and actionable recommendations.'}</small>
              </span>
            </li>
            <li>
              <span style={{ background: '#2563eb' }}>
                <BarChart3 size={26} />
              </span>
              <span>
                <b>Prioritized recommendations ranked by impact</b>
                <small>Know what to fix first for better results.</small>
              </span>
            </li>
            <li>
              <span style={{ background: '#7c3aed' }}>
                <RefreshCw size={26} />
              </span>
              <span>
                <b>Upgrade, downgrade or cancel anytime</b>
                <small>Scale as your needs grow. No long-term commitment.</small>
              </span>
            </li>
          </ul>
        </div>
        <div className={a.scoreCard} aria-label="Example">
          <svg viewBox="0 0 64 64" width="72" height="72" aria-hidden>
            <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="7" />
            <circle cx="32" cy="32" r="26" fill="none" stroke="#5cc23a" strokeWidth="7" strokeDasharray="134 163" transform="rotate(-90 32 32)" strokeLinecap="round" />
            <text x="32" y="38" textAnchor="middle" fontSize="18" fontWeight="800" fill="#fff">
              82
            </text>
          </svg>
          <span>
            <b>Example site health score</b>
            <small>Your score appears after your first audit.</small>
          </span>
        </div>
      </aside>
      <main className={a.main} style={{ placeItems: 'start center', paddingTop: 28 }}>
        <div className={a.topRow}>
          <div className={a.tabs} role="tablist" style={{ margin: 0, width: 380 }}>
            <span role="tab" aria-selected="true" className={a.tabOn}>
              Create Account
            </span>
            <Link role="tab" aria-selected="false" href={`/login${next ? `?next=${encodeURIComponent(safeNext(next))}` : ''}`}>
              Log In
            </Link>
          </div>
          <Link href="/" className={a.backInline}>
            <ArrowLeft size={18} /> Back to Site
          </Link>
        </div>
        <SignupPlans
          plans={cards}
          website={website?.slice(0, 253)}
          defaultPlan={plan}
          defaultInterval={interval === 'annual' ? 'annual' : 'monthly'}
          providers={enabledSocialProviders}
          allowSignup={platform.allowSignup}
          next={next ? safeNext(next) : undefined}
        />
      </main>
    </div>
  );
}
