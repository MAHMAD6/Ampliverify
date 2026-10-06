'use client';

import { useRouter } from 'next/navigation';
import { Folder } from 'lucide-react';
import type { Project } from '@/lib/types';
import ui from '../ui/ui.module.css';

/** Remembers the selected project in a cookie so project-scoped pages can read it server-side. */
export function ProjectPicker({ projects, selectedId, className }: { projects: Project[]; selectedId?: string; className?: string }) {
  const router = useRouter();
  return (
    <div className={`${ui.inputIconWrap} ${className ?? ''}`}>
      <Folder size={18} />
      <select
        className={ui.select}
        style={{ paddingLeft: 38 }}
        aria-label="Select a project"
        value={selectedId ?? ''}
        disabled={projects.length === 0}
        onChange={(e) => {
          const value = e.target.value;
          document.cookie = `av_project=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
          router.refresh();
        }}
      >
        <option value="">{projects.length ? 'Select a project' : 'No projects yet'}</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
