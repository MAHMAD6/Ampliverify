import Link from 'next/link';
import { BadgeCheck, Clock, DollarSign, Eye, FileText, Handshake, Inbox, Landmark, PackagePlus, Repeat, ShieldCheck, Tags } from 'lucide-react';
import { ButtonLink, Grid, Metric, Notice, PageHeader, Panel } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { LoadError, StatusBadge } from '@/components/market/parts';
import { SellerProfileForm } from '@/components/market/SellerProfileForm';
import { apiGet } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { type Balance, CHECK_STATUS, type InquiryRow, LISTING_STATUS, type MarketSummary, money, type OwnListing, type SellerProfile } from '@/lib/marketplace';
import m from '@/components/market/market.module.css';

export const metadata = { title: 'Seller Dashboard · Marketplace' };

/** Seller Dashboard, or onboarding when the user has not started selling (V2 guide §1.2). */
export default async function SellerDashboard() {
  const [summary, profile] = await Promise.all([apiGet<MarketSummary>('/user/marketplace/summary', { auth: true }), apiGet<SellerProfile | null>('/user/marketplace/seller', { auth: true })]);
  if (!summary.ok || !profile.ok) return <LoadError what="Your seller dashboard" />;
  const p = profile.data;
  if (!p) return <Onboarding />;
  const [listings, inquiries, balance] = await Promise.all([
    apiGet<OwnListing[]>('/user/marketplace/my/listings', { auth: true }),
    apiGet<InquiryRow[]>('/user/marketplace/my/inquiries?role=received', { auth: true }),
    apiGet<Balance>('/user/marketplace/finances/balance', { auth: true }),
  ]);
  const s = summary.data.seller;
  const usd = balance.ok ? balance.data.balances.find((b) => b.currency === 'USD') : undefined;
  const top = listings.ok ? [...listings.data].sort((a, b) => b.viewCount - a.viewCount).slice(0, 5) : [];
  const needsVerification = p.checks.identity !== 'APPROVED';
  return (
    <>
      <PageHeader title="Seller Dashboard" description="Manage your listings, track your activity, and monitor your account status — all in one place." actions={<ButtonLink href="/seller/listings/new" icon={<PackagePlus size={16} />}>Create Listing</ButtonLink>} />
      {p.status === 'SUSPENDED' && (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="amber" title="Your seller account is suspended.">
            Your listings are hidden. Contact support for details.
          </Notice>
        </div>
      )}
      <Grid cols={4}>
        <Metric label="Published Listings" value={s.byStatus.PUBLISHED ?? 0} note="Live on marketplace" icon={<Tags size={22} />} tone="green" />
        <Metric label="Under Review" value={s.byStatus.PENDING_REVIEW ?? 0} note="Awaiting approval" icon={<Clock size={22} />} tone="amber" />
        <Metric label="New Introductions" value={s.pendingIntroductions} note={<Link href="/seller/inquiries">Respond to buyers</Link>} icon={<Inbox size={22} />} tone="blue" />
        <Metric label="Active Offers" value={s.activeOffers} note={<Link href="/seller/offers">Requiring response</Link>} icon={<Handshake size={22} />} tone="purple" />
        <Metric label="Listing Views" value={s.listingViews.toLocaleString('en-US')} note="All time" icon={<Eye size={22} />} tone="blue" />
        <Metric label="Total Earnings" value={usd ? money(usd.grossSalesMinor, 'USD') : money(0, 'USD')} note="Gross digital-product sales" icon={<DollarSign size={22} />} tone="green" />
        <Metric label="Available Balance" value={usd ? money(usd.availableMinor, 'USD') : money(0, 'USD')} note={`Payouts from ${money(s.payoutThresholdMinor, 'USD')}`} icon={<Landmark size={22} />} tone="slate" />
        <Metric label="Identity Verification" value={CHECK_STATUS[p.checks.identity]?.label ?? p.checks.identity} note={<Link href="/seller/verification">Verification</Link>} icon={<ShieldCheck size={22} />} tone={needsVerification ? 'red' : 'green'} />
      </Grid>
      <div className={m.two} style={{ marginTop: 16 }}>
        <Panel title="Top listings" actions={<Link href="/seller/listings">View all</Link>}>
          {top.length ? (
            <ul className={m.list}>
              {top.map((l) => (
                <li key={l.id}>
                  <Link href={`/seller/listings/${l.id}`}>{l.title}</Link> · <StatusBadge map={LISTING_STATUS} value={l.status} /> · {l.viewCount} views · {l.inquiries ?? 0} inquiries
                </li>
              ))}
            </ul>
          ) : (
            <StateView kind="empty" icon={<FileText size={34} />} title="No listings yet" description="Create your first listing. Our team reviews every listing before it goes live." action={<ButtonLink href="/seller/listings/new" size="sm">Create Listing</ButtonLink>} />
          )}
        </Panel>
        <Panel title="Quick Actions">
          <div className={m.quick}>
            <Link href="/seller/listings/new">
              <PackagePlus size={22} aria-hidden />
              Create Listing
            </Link>
            <Link href="/seller/listings">
              <Tags size={22} aria-hidden />
              My Listings
            </Link>
            <Link href="/seller/inquiries">
              <Inbox size={22} aria-hidden />
              View Inquiries
            </Link>
            <Link href="/seller/transactions">
              <Repeat size={22} aria-hidden />
              Transactions
            </Link>
          </div>
          {needsVerification && (
            <div style={{ marginTop: 14 }}>
              <Notice tone="blue" title="Verify your identity">
                Listings are published only after your identity is approved. <Link href="/seller/verification">Get started</Link>
              </Notice>
            </div>
          )}
        </Panel>
      </div>
      <Panel title="Recent inquiries" actions={<Link href="/seller/inquiries">View all</Link>}>
        {inquiries.ok && inquiries.data.length ? (
          <ul className={m.list}>
            {inquiries.data.slice(0, 6).map((i) => (
              <li key={i.id}>
                <Link href={`/seller/inquiries/${i.id}`}>{i.listing.title}</Link> · {i.from} · {formatDateTime(i.createdAt)}
              </li>
            ))}
          </ul>
        ) : (
          <StateView kind="empty" icon={<BadgeCheck size={34} />} title="No activity yet" description="Introductions, questions and offers from buyers will appear here." />
        )}
      </Panel>
    </>
  );
}

function Onboarding() {
  return (
    <>
      <PageHeader title="Start Selling on AmpliVerify" description="List websites, online businesses and digital products. Every listing is reviewed by our team before buyers see it." />
      <div className={m.two}>
        <Panel title="1. Create your seller profile" description="Buyers see your display name and profile, never your email address.">
          <SellerProfileForm p={null} redirectTo="/seller/verification" />
        </Panel>
        <Panel title="How selling works">
          <ol className={m.list}>
            <li>Create your seller profile.</li>
            <li>Verify your identity (and your business, if you sell as a company). Each check is reviewed separately.</li>
            <li>Create a listing and submit it for review. Business listings with a website get an ownership check.</li>
            <li>Answer introductions, negotiate offers, or sell digital products at a fixed price.</li>
            <li>Connect a payout account. Earnings become payable from $50.</li>
          </ol>
          <p className={m.muted}>
            Read the <Link href="/seller-guidelines">Seller Guidelines</Link> before you list.
          </p>
        </Panel>
      </div>
    </>
  );
}
