import { PendingScreen } from '@/components/ui/PendingScreen';
import { ButtonLink } from '@/components/ui';

export const metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <PendingScreen
      title="Dashboard"
      description="An overview of your projects, audits, AI search visibility and usage."
      emptyTitle="Your dashboard is empty"
      emptyText="Add a project and run your first audit to see results here."
      action={<ButtonLink href="/app/getting-started">Get started</ButtonLink>}
    />
  );
}
