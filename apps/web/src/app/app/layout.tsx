import type { Metadata } from 'next';
import { AppShell } from '@/components/app/AppShell';
import { getAppContext } from '@/lib/project';
import { apiGet } from '@/lib/api';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function UserAppLayout({ children }: { children: React.ReactNode }) {
  const { me, projects, selectedProject } = await getAppContext();
  const unread = me ? await apiGet<{ count: number }>('/user/notifications/unread-count', { auth: true }) : null;
  return (
    <AppShell me={me} projects={projects} selectedId={selectedProject?.id} unread={unread?.ok ? unread.data.count : 0}>
      {children}
    </AppShell>
  );
}
