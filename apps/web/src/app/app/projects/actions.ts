'use server';

import { revalidatePath } from 'next/cache';
import { apiSend } from '@/lib/api';
import type { Project } from '@/lib/types';

export type ProjectActionResult = { ok: boolean; message?: string };

/** Pause, resume or archive. Projects are never hard-deleted from the app. */
export async function setProjectStatus(projectId: string, status: Project['status']): Promise<ProjectActionResult> {
  const result = await apiSend<Project>('PATCH', `/user/projects/${encodeURIComponent(projectId)}`, { status });
  if (!result.ok) return { ok: false, message: result.message ?? 'The project could not be updated.' };
  revalidatePath('/app/projects');
  return { ok: true };
}
