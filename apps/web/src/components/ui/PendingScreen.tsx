import type { ReactNode } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { EmptyState, PageHeader, Panel, type Crumb } from '.';

/**
 * Destination for navigation items whose screen design has not been supplied
 * yet. Shows the module title and a neutral empty state; it does not invent
 * metrics, rows or controls. Listed in docs/SCREENS.md as "awaiting design".
 */
export function PendingScreen({
  title,
  description,
  crumbs,
  icon = <LayoutDashboard size={28} />,
  emptyTitle = 'Nothing to show yet',
  emptyText,
  action,
}: {
  title: string;
  description: string;
  crumbs?: Crumb[];
  icon?: ReactNode;
  emptyTitle?: string;
  emptyText?: string;
  action?: ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} description={description} crumbs={crumbs} />
      <Panel>
        <EmptyState icon={icon} title={emptyTitle} description={emptyText ?? 'Data for this area will appear here once it is available for your account.'} action={action} />
      </Panel>
    </>
  );
}
