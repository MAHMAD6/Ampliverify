import { TabNav } from '@/components/ui';

/** Reports sub-pages from the navigation page map. */
export function ReportsTabs({ active }: { active: 'all' | 'scheduled' | 'shared' }) {
  return (
    <TabNav
      active={active}
      tabs={[
        { key: 'all', label: 'All Reports', href: '/app/reports' },
        { key: 'scheduled', label: 'Scheduled', href: '/app/reports/scheduled' },
        { key: 'shared', label: 'Shared', href: '/app/reports/shared' },
      ]}
    />
  );
}
