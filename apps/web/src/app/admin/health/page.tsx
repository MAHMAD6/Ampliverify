import { AlertTriangle, CheckCircle2, Clock3, Server } from 'lucide-react';
import { AdminList } from '@/components/admin/AdminList';

export const metadata = { title: 'System Health' };

/** System Health (chat design 2026-10-06). Needs a monitoring source; the API `/health` endpoint reports process liveness only. */
export default async function SystemHealthPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = 'services' } = await searchParams;
  return (
    <AdminList
      section="System Operations"
      title="System Health"
      description="Current status and performance data for key platform services and infrastructure components, when available."
      about={{ title: 'About System Health', text: 'Status and performance data for platform components and services when monitoring data is available: availability, response times, and overall performance.' }}
      metrics={[
        { label: 'Overall Status', icon: <CheckCircle2 size={24} />, tone: 'green', note: 'No data available yet' },
        { label: 'Total Services', icon: <Server size={24} />, tone: 'blue', note: 'No data available yet' },
        { label: 'Active Issues', icon: <AlertTriangle size={24} />, tone: 'amber', note: 'No data available yet' },
        { label: 'Uptime (Last 30 Days)', icon: <Clock3 size={24} />, tone: 'purple', note: 'No data available yet' },
      ]}
      tabs={[
        { key: 'services', label: 'Services' },
        { key: 'performance', label: 'Performance' },
        { key: 'incidents', label: 'Incidents' },
        { key: 'maintenance', label: 'Maintenance' },
      ]}
      activeTab={tab}
      basePath="/admin/health"
      search="Search services by name or description..."
      selects={[
        { label: 'Service Type', options: ['All Types'] },
        { label: 'Status', options: ['All Statuses'] },
      ]}
      columns={['Service Name', 'Type', 'Status', 'Response Time', 'Last Checked', 'Notes']}
      empty={{ icon: <Server size={40} />, title: 'No system health data yet', text: 'Service status and performance details will appear here when monitoring data is available.' }}
      footnote="System health data is shown when monitoring data is available."
    />
  );
}
