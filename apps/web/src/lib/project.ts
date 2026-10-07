import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { apiGet } from './api';
import type { Me, Project } from './types';

export const PROJECT_COOKIE = 'av_project';

/** Current user + accessible projects + the selected one (cookie), for app pages. */
export const getAppContext = cache(async function getAppContext() {
  const [me, projects, workspaces] = await Promise.all([
    apiGet<Me>('/user/me', { auth: true }),
    apiGet<Project[]>('/user/projects', { auth: true }),
    apiGet<{ id: string; name: string; organizationId: string }[]>('/user/workspaces', { auth: true }),
  ]);
  const list = projects.ok ? projects.data : [];
  const selectedId = (await cookies()).get(PROJECT_COOKIE)?.value;
  // Without an explicit choice, the first active project is in context.
  const selected = list.find((p) => p.id === selectedId) ?? list.find((p) => p.status === 'ACTIVE') ?? list[0] ?? null;
  const wsList = workspaces.ok ? workspaces.data : [];
  return {
    me: me.ok ? me.data : null,
    signedIn: me.ok,
    projects: list,
    selectedProject: selected,
    workspaces: wsList,
    /** The workspace in context: the selected project's, else the first one. */
    workspaceId: selected?.workspaceId ?? wsList[0]?.id ?? null,
  };
});
