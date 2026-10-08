import { History } from 'lucide-react';
import { DataTable, Panel } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { UsageHeader } from '@/components/app/usage/UsageHeader';
import { appCrumbs } from '@/lib/nav';
import { getAppContext } from '@/lib/project';
import { apiGet } from '@/lib/api';
import type { LedgerEntry } from '@/lib/app-types';
import { formatDateTime, formatNumber, humanize } from '@/lib/format';

export const metadata = { title: 'Credit History · Usage & Credits' };

const DESCRIBE: Record<string, string> = {
  audit_run: 'SEO audit',
  geo_run: 'AI search check',
  geo_platform_result: 'AI search check (platform refund)',
  keyword_query: 'Keyword research',
  credit_purchase: 'Credit purchase',
  credit_adjustment: 'Adjustment by support',
  invoice: 'Monthly plan credits',
  workspace: 'Welcome credits',
  content_ideas: 'AI content ideas',
  content_brief: 'AI content brief',
  editor_document: 'AI editor suggestions',
};

/** Credit ledger (`credit_ledger`): every grant, purchase, use, refund and adjustment with running balance. */
export default async function CreditHistoryPage() {
  const { workspaceId } = await getAppContext();
  const res = workspaceId ? await apiGet<LedgerEntry[]>(`/user/workspaces/${workspaceId}/credits/ledger?limit=500`, { auth: true }) : null;
  const entries = res?.ok ? res.data : [];
  // Running balance: entries are newest first; walk from the oldest.
  const total = entries.reduce((n, e) => n + Number(e.delta), 0);
  let running = total;
  const rows = entries.map((e) => {
    const after = running;
    running -= Number(e.delta);
    return [
      formatDateTime(e.createdAt),
      humanize(e.reason),
      e.referenceType ? DESCRIBE[e.referenceType] ?? humanize(e.referenceType) : '—',
      <span key="d" style={{ color: Number(e.delta) < 0 ? 'var(--red)' : 'var(--green)' }}>
        {Number(e.delta) > 0 ? '+' : ''}
        {formatNumber(e.delta, 2)}
      </span>,
      formatNumber(after, 2),
    ];
  });
  return (
    <>
      <UsageHeader active="history" crumbs={appCrumbs({ label: 'Usage & Credits', href: '/app/usage' }, { label: 'Credit History' })} />
      <Panel title="Credit Activity" bodyless>
        <DataTable
          columns={['Date & Time', 'Type', 'Description', 'Credits', 'Balance After']}
          rows={rows}
          empty={<StateView kind="empty" compact icon={<History size={28} />} title="No credit activity yet" description="Credit grants, purchases, usage and adjustments will appear here." />}
        />
      </Panel>
    </>
  );
}
