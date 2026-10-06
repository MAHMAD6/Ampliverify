import { BarChart3, Box, Coins, DollarSign } from 'lucide-react';
import { AdminList } from '@/components/admin/AdminList';

export const metadata = { title: 'Usage & Costs' };

/** Usage & Costs (chat design 2026-10-06). `usage_events` + `provider_usage`; estimates only, not invoices. The admin usage API is not built. */
export default async function UsageCostsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = 'module' } = await searchParams;
  return (
    <AdminList
      section="System Operations"
      title="Usage & Costs"
      description="Monitor platform usage and estimated costs across modules, services, and providers."
      about={{ title: 'About Usage & Costs', text: 'Estimated infrastructure and third-party costs (AI, storage, email, etc.) for operational monitoring. These are not invoices. User credit balances are managed under Billing & Access.' }}
      metrics={[
        { label: 'Total Usage', icon: <BarChart3 size={24} />, tone: 'blue', note: 'No data yet' },
        { label: 'Estimated Cost', icon: <DollarSign size={24} />, tone: 'green', note: 'No data yet' },
        { label: 'Credits Consumed', icon: <Coins size={24} />, tone: 'purple', note: 'No data yet' },
        { label: 'Active Services', icon: <Box size={24} />, tone: 'amber', note: 'No data yet' },
      ]}
      tabs={[
        { key: 'module', label: 'By Module' },
        { key: 'service', label: 'By Service' },
        { key: 'credits', label: 'Credits' },
      ]}
      activeTab={tab}
      basePath="/admin/usage"
      search="Search usage..."
      selects={[
        { label: 'Module', options: ['All Modules'] },
        { label: 'Service / Provider', options: ['All Services'] },
        { label: 'Cost Type', options: ['All Types'] },
      ]}
      columns={['Module', 'Service', 'Usage Metric', 'Quantity', 'Estimated Cost', 'Period', 'Last Updated']}
      empty={{ icon: <BarChart3 size={40} />, title: 'No usage data yet', text: 'Usage and cost data will appear here when available.' }}
      footnote="Estimated costs are for operational monitoring and are not invoices or billing charges."
    />
  );
}
