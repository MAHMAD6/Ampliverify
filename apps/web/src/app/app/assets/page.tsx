import Link from 'next/link';
import { BadgeCheck, Briefcase, ClipboardCheck, FolderKanban, PackagePlus, Search, TrendingUp, Wallet } from 'lucide-react';
import { ButtonLink, DataTable, Grid, Metric, PageHeader, Panel } from '@/components/ui';
import { AssetsError, assetLink, NoAssets, NoWorkspace, OwnershipBadge, RelationshipBadge } from '@/components/app/assets/parts';
import { apiGet } from '@/lib/api';
import { type Asset, type AssetSummary, range } from '@/lib/assets';
import { formatDate } from '@/lib/format';
import { appCrumbs } from '@/lib/nav';
import { getAppContext } from '@/lib/project';
import m from '@/components/market/market.module.css';

export const metadata = { title: 'Digital Assets Dashboard' };

/** Digital Assets Dashboard (V2 guide §2.1): portfolio totals from recorded data; values only from completed valuations. */
export default async function AssetsDashboard() {
  const { workspaceId } = await getAppContext();
  if (!workspaceId) return <NoWorkspace />;
  const [summary, list] = await Promise.all([apiGet<AssetSummary>(`/user/assets/summary?workspaceId=${workspaceId}`, { auth: true }), apiGet<Asset[]>(`/user/assets?workspaceId=${workspaceId}`, { auth: true })]);
  if (!summary.ok) return <AssetsError />;
  const s = summary.data;
  const recent = list.ok ? list.data.slice(0, 6) : [];
  return (
    <>
      <PageHeader title="Digital Assets Dashboard" description="Track, verify, value and improve the websites and online businesses you own or manage." crumbs={appCrumbs({ label: 'Digital Assets' })} actions={<ButtonLink href="/app/assets/new" icon={<PackagePlus size={16} />}>Add Digital Asset</ButtonLink>} />
      <Grid cols={4}>
        <Metric label="Total assets" value={s.totalAssets} note={`${s.owned} owned · ${s.managed} managed · ${s.authorized} authorized`} icon={<Briefcase size={22} />} tone="blue" />
        <Metric label="Verified ownership" value={s.verification.VERIFIED ?? 0} note={`${s.verification.PENDING ?? 0} pending review`} icon={<BadgeCheck size={22} />} tone="green" />
        <Metric label="Estimated portfolio value" value={s.estimatedValue ? range({ valueLow: s.estimatedValue.low, valueHigh: s.estimatedValue.high, currency: s.estimatedValue.currency }) : '—'} note={s.estimatedValue ? `From ${s.estimatedValue.assetsValued} completed valuation${s.estimatedValue.assetsValued === 1 ? '' : 's'}` : 'Run a valuation to see a range'} icon={<Wallet size={22} />} tone="purple" />
        <Metric label="Prospective acquisitions" value={s.prospective} note={`${s.analyses} analyses run`} icon={<ClipboardCheck size={22} />} tone="amber" />
      </Grid>
      <div className={m.two} style={{ marginTop: 16 }}>
        <Panel title="Recent assets" actions={<Link href="/app/assets/portfolio">View portfolio</Link>} bodyless={recent.length > 0}>
          {recent.length ? (
            <DataTable columns={['Asset', 'Relationship', 'Ownership', 'Project', 'Added']} rows={recent.map((a) => [assetLink(a), <RelationshipBadge key="r" r={a.relationship} />, <OwnershipBadge key="o" status={a.ownershipStatus} />, a.project?.name ?? '—', formatDate(a.createdAt)])} />
          ) : (
            <NoAssets />
          )}
        </Panel>
        <Panel title="Quick actions">
          <div className={m.quick}>
            <Link href="/app/assets/new">
              <PackagePlus size={22} aria-hidden />
              Add asset
            </Link>
            <Link href="/app/assets/acquisitions">
              <Search size={22} aria-hidden />
              Analyze an acquisition
            </Link>
            <Link href="/app/assets/improvement">
              <TrendingUp size={22} aria-hidden />
              Improvement workspace
            </Link>
            <Link href="/app/assets/projects">
              <FolderKanban size={22} aria-hidden />
              Asset projects
            </Link>
          </div>
          <p className={m.muted} style={{ marginBottom: 0 }}>
            {s.activeProjects} active linked project{s.activeProjects === 1 ? '' : 's'}. Ownership is never assumed from an analysis or a payment: verify each asset you own.
          </p>
        </Panel>
      </div>
    </>
  );
}
