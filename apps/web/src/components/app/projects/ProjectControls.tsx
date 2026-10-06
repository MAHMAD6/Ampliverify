'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Archive, ChevronDown, MoreVertical, Pause, Pencil, Play, Trash2 } from 'lucide-react';
import { setProjectStatus } from '@/app/app/projects/actions';
import { Button } from '@/components/ui';
import { humanize } from '@/lib/format';
import type { Project } from '@/lib/types';
import s from './projects.module.css';

function useMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return { open, setOpen, ref };
}

/** Status pill with a dropdown to change status (Active / Paused / Archived). */
export function StatusMenu({ project }: { project: Project }) {
  const { open, setOpen, ref } = useMenu();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const change = (status: Project['status']) =>
    start(async () => {
      const r = await setProjectStatus(project.id, status);
      if (!r.ok) setError(r.message);
      setOpen(false);
    });
  return (
    <div className={s.actions} ref={ref} style={{ display: 'inline-flex' }}>
      <button className={`${s.status} ${s[project.status]}`} style={{ border: 0, cursor: 'pointer', fontSize: 15 }} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} disabled={pending}>
        {humanize(project.status)} <ChevronDown size={16} />
      </button>
      {open && (
        <div className={s.menu} role="menu" style={{ left: 0, right: 'auto' }}>
          {(['ACTIVE', 'PAUSED', 'ARCHIVED'] as const).map((st) => (
            <button key={st} role="menuitemradio" aria-checked={project.status === st} onClick={() => change(st)} disabled={project.status === st}>
              {humanize(st)}
            </button>
          ))}
        </div>
      )}
      {error && <span role="alert" style={{ marginLeft: 8, fontSize: 12, color: 'var(--red)' }}>{error}</span>}
    </div>
  );
}

/** "Manage Project" dropdown and overflow menu. Delete is intentionally unavailable (archive instead). */
export function ManageProjectMenu({ project }: { project: Project }) {
  const { open, setOpen, ref } = useMenu();
  const [pending, start] = useTransition();
  const change = (status: Project['status']) =>
    start(async () => {
      await setProjectStatus(project.id, status);
      setOpen(false);
    });
  return (
    <div className={s.actions} ref={ref}>
      <Button aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} disabled={pending}>
        Manage Project <ChevronDown size={16} />
      </Button>
      <Button variant="secondary" aria-label="More project actions" onClick={() => setOpen((o) => !o)}>
        <MoreVertical size={18} />
      </Button>
      {open && (
        <div className={s.menu} role="menu">
          <button role="menuitem" disabled title="Project editing will be available soon">
            <Pencil size={18} /> Edit Project
          </button>
          {project.status === 'PAUSED' ? (
            <button role="menuitem" onClick={() => change('ACTIVE')}>
              <Play size={18} /> Resume Project
            </button>
          ) : (
            <button role="menuitem" onClick={() => change('PAUSED')} disabled={project.status === 'ARCHIVED'}>
              <Pause size={18} /> Pause Project
            </button>
          )}
          {project.status === 'ARCHIVED' ? (
            <button role="menuitem" onClick={() => change('ACTIVE')}>
              <Play size={18} /> Restore Project
            </button>
          ) : (
            <button role="menuitem" onClick={() => change('ARCHIVED')}>
              <Archive size={18} /> Archive Project
            </button>
          )}
          <button role="menuitem" className={s.danger} disabled title="Projects are archived rather than deleted. Contact support to delete a project.">
            <Trash2 size={18} /> Delete Project
          </button>
        </div>
      )}
    </div>
  );
}

/** Makes the opened project the current one for project-scoped modules. */
export function SelectProjectOnVisit({ projectId }: { projectId: string }) {
  useEffect(() => {
    if (!document.cookie.split('; ').includes(`av_project=${projectId}`)) {
      document.cookie = `av_project=${encodeURIComponent(projectId)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    }
  }, [projectId]);
  return null;
}
