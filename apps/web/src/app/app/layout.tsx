import type { Metadata } from 'next';
import { Wrench } from 'lucide-react';
import { AppShell } from '@/components/app/AppShell';
import { EmptyState, Notice } from '@/components/ui';
import { getAppContext } from '@/lib/project';
import { apiGet } from '@/lib/api';
import { getPlatformInfo } from '@/lib/platform';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function UserAppLayout({ children }: { children: React.ReactNode }) {
  const [{ me, projects, selectedProject }, platform] = await Promise.all([getAppContext(), getPlatformInfo()]);
  const unread = me ? await apiGet<{ count: number }>('/user/notifications/unread-count', { auth: true }) : null;
  // In maintenance mode the API refuses product requests except from platform administrators.
  const operator = platform.maintenance.enabled && me ? (await apiGet<{ permissions: string[] }>('/admin/me', { auth: true })).ok : false;
  const message = platform.maintenance.message ?? 'AmpliVerify is undergoing scheduled maintenance. Please try again shortly.';
  return (
    <AppShell me={me} projects={projects} selectedId={selectedProject?.id} unread={unread?.ok ? unread.data.count : 0}>
      {platform.maintenance.enabled && operator && (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="neutral" title="Maintenance mode is on.">
            Customers cannot use the product until it is turned off in Super Admin → Settings.
          </Notice>
        </div>
      )}
      {platform.maintenance.enabled && !operator ? <EmptyState icon={<Wrench size={30} />} title="Scheduled maintenance" description={message} /> : children}
    </AppShell>
  );
}
