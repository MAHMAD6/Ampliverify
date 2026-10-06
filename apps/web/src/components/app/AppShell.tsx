import type { ReactNode } from 'react';
import { APP_NAV } from '@/lib/nav';
import type { Me, Project } from '@/lib/types';
import { Notice } from '../ui';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import s from './shell.module.css';

export function AppShell({ me, projects, selectedId, children }: { me: Me | null; projects: Project[]; selectedId?: string; children: ReactNode }) {
  return (
    <div className={s.app}>
      <Sidebar items={APP_NAV} />
      <div className={s.main}>
        <Topbar me={me} projects={projects} selectedId={selectedId} />
        <main className={s.content}>
          {!me && (
            <div style={{ marginBottom: 20 }}>
              <Notice tone="neutral" title="You are not signed in.">
                Your projects, usage and settings will appear here once you sign in.
              </Notice>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
