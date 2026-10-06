import type { Metadata } from 'next';
import { AppShell } from '@/components/app/AppShell';
import { getAppContext } from '@/lib/project';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function UserAppLayout({ children }: { children: React.ReactNode }) {
  const { me, projects, selectedProject } = await getAppContext();
  return (
    <AppShell me={me} projects={projects} selectedId={selectedProject?.id}>
      {children}
    </AppShell>
  );
}
