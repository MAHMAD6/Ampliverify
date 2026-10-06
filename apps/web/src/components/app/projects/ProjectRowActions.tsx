'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Archive, MoreHorizontal, Pause, Play, Settings, Trash2 } from 'lucide-react';
import { setProjectStatus } from '@/app/app/projects/actions';
import { ButtonLink, Button } from '@/components/ui';
import type { Project } from '@/lib/types';
import s from './projects.module.css';

export function ProjectRowActions({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const change = (status: Project['status']) =>
    start(async () => {
      const result = await setProjectStatus(project.id, status);
      if (!result.ok) setError(result.message);
      setOpen(false);
    });

  return (
    <div className={s.actions} ref={ref}>
      <ButtonLink href={`/app/projects/${project.id}`} variant="outline" size="sm">
        Open Project
      </ButtonLink>
      <Button variant="secondary" size="sm" aria-label={`More actions for ${project.name}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} disabled={pending}>
        <MoreHorizontal size={18} />
      </Button>
      {open && (
        <div className={s.menu} role="menu">
          <Link href={`/app/projects/${project.id}`} role="menuitem">
            <Settings size={18} /> Manage Project
          </Link>
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
      {error && (
        <span role="alert" style={{ position: 'absolute', top: '100%', right: 0, fontSize: 12, color: 'var(--red)', whiteSpace: 'nowrap' }}>
          {error}
        </span>
      )}
    </div>
  );
}
