'use server';

import { redirect } from 'next/navigation';
import { apiSend } from '@/lib/api';
import type { Project } from '@/lib/types';

export type CreateProjectState = { error?: string };

export async function createProject(_prev: CreateProjectState, form: FormData): Promise<CreateProjectState> {
  const workspaceId = String(form.get('workspaceId') ?? '');
  const name = String(form.get('name') ?? '').trim();
  if (!workspaceId) return { error: 'Choose a workspace.' };
  if (!name) return { error: 'Enter a project name.' };

  const result = await apiSend<Project>('POST', '/user/projects', { workspaceId, name });
  if (!result.ok) return { error: result.message ?? 'The project could not be created.' };
  redirect('/app/projects');
}
