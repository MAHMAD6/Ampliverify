import Link from 'next/link';
import { Flag, Plus } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { AdminList, StatusPill } from '@/components/admin/AdminList';
import { dateTime, loadFeatureFlags, matchesQ } from '@/lib/admin-data';

export const metadata = { title: 'Feature Flags' };

/** Feature Flags (chat design 2026-10-06). Live from `GET /admin/feature-flags`; a flag with rules is a limited rollout. */
export default async function FeatureFlagsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q, status } = await searchParams;
  const flags = await loadFeatureFlags();
  const state = (f: { enabled: boolean; rules: unknown[] }) => (!f.enabled ? 'Disabled' : f.rules.length ? 'Limited Rollout' : 'Enabled');
  const rows = (flags ?? []).filter((f) => matchesQ(q, f.key, f.description) && (!status || state(f) === status));
  const create = (
    <ButtonLink href="/admin/flags/new" icon={<Plus size={18} />}>
      Create Feature Flag
    </ButtonLink>
  );
  return (
    <AdminList
      section="System Operations"
      title="Feature Flags"
      description="Enable, disable, or gradually roll out specific features within modules without changing module availability or plan entitlements."
      actions={create}
      about={{ title: 'About Feature Flags', text: 'Flags control specific capabilities within modules: test features, limit access, or roll out gradually. Module availability and plan access are managed separately.' }}
      metrics={[
        { label: 'Total Flags', icon: <Flag size={24} />, tone: 'blue', value: flags?.length },
        { label: 'Enabled', icon: <Flag size={24} />, tone: 'green', value: flags?.filter((f) => state(f) === 'Enabled').length },
        { label: 'Disabled', icon: <Flag size={24} />, tone: 'slate', value: flags?.filter((f) => !f.enabled).length },
        { label: 'Limited Rollout', icon: <Flag size={24} />, tone: 'amber', value: flags?.filter((f) => state(f) === 'Limited Rollout').length },
      ]}
      basePath="/admin/flags"
      search="Search flags by name or description..."
      liveFilters={{ q }}
      selects={[{ label: 'Status', name: 'status', value: status, options: ['All Statuses', 'Enabled', 'Disabled', 'Limited Rollout'] }]}
      columns={['Flag', 'Environment', 'Description', 'Status', 'Rollout / Audience', 'Last Updated']}
      rows={rows.map((f) => [
        <Link key="k" href={`/admin/flags/${f.id}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
          <code>{f.key}</code>
        </Link>,
        f.environment,
        f.description,
        <StatusPill key="s" tone={f.enabled ? (f.rules.length ? 'amber' : 'green') : 'slate'}>
          {state(f)}
        </StatusPill>,
        f.rules.length ? f.rules.map((r) => `${r.scopeType}: ${r.scopeValue}${r.percentage ? ` (${r.percentage}%)` : ''}`).join(', ') : f.enabled ? 'Everyone' : '—',
        dateTime(f.updatedAt),
      ])}
      empty={{ icon: <Flag size={40} />, title: flags?.length ? 'No flags match your filters' : 'No feature flags yet', text: 'Feature flags will appear here once they are created.', action: create }}
    />
  );
}
