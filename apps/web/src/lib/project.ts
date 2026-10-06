import 'server-only';
import { cookies } from 'next/headers';
import { apiGet } from './api';
import type { Me, Project } from './types';

export const PROJECT_COOKIE = 'av_project';

/** Current user + accessible projects + the selected one (cookie), for app pages. */
export async function getAppContext() {
  const [me, projects] = await Promise.all([
    apiGet<Me>('/user/me', { auth: true }),
    apiGet<Project[]>('/user/projects', { auth: true }),
  ]);
  const list = projects.ok ? projects.data : [];
  const selectedId = (await cookies()).get(PROJECT_COOKIE)?.value;
  const selected = list.find((p) => p.id === selectedId) ?? null;
  return {
    me: me.ok ? me.data : null,
    signedIn: me.ok,
    projects: list,
    selectedProject: selected,
  };
}
