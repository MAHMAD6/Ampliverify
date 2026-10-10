'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Archive, MoreHorizontal, Pause, Play, Settings, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { setProjectStatus } from '@/app/app/projects/actions';
import { apiAction } from '@/lib/actions';
import { ButtonLink, Button } from '@/components/ui';
import type { Project } from '@/lib/types';
import s from './projects.module.css';

/** What deleting removes (shown in the confirmation). */
const DELETE_SCOPE = [
  'Project settings and domain configuration',
  'SEO audits and analysis results',
  'Content strategy and generated content',
  'GEO tracking and visibility data',
  'Reports and historical data',
];

export function ProjectRowActions({ project, openLabel = 'Open Project' }: { project: Project; openLabel?: string }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [confirmName, setConfirmName] = useState('');
  const remove = () =>
    start(async () => {
      const result = await apiAction('DELETE', `/user/projects/${project.id}`, undefined, ['/app/projects', '/app/dashboard']);
      if (!result.ok) return setError(result.message);
      dialog.current?.close();
      router.refresh();
    });

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
        {openLabel}
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
          <button
            role="menuitem"
            className={s.danger}
            onClick={() => {
              setOpen(false);
              dialog.current?.showModal();
            }}
          >
            <Trash2 size={18} /> Delete Project
          </button>
        </div>
      )}
      <dialog ref={dialog} className={s.confirm} aria-labelledby={`delete-${project.id}`}>
        <div className={s.confirmHead}>
          <span className={s.confirmIcon}>
            <Trash2 size={20} />
          </span>
          <div>
            <h2 id={`delete-${project.id}`}>Delete Project</h2>
            <p>This will permanently delete {project.name} and all its data, including:</p>
          </div>
          <button className={s.confirmClose} aria-label="Close" onClick={() => dialog.current?.close()}>
            <X size={18} />
          </button>
        </div>
        <ul className={s.confirmList}>
          {DELETE_SCOPE.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className={s.confirmNote}>
          The project disappears for everyone immediately and is permanently purged with all its files after 30 days. Archiving instead stops all activity and can be undone.
        </p>
        <label style={{ display: 'grid', gap: 6, fontSize: 14, margin: '0 20px 12px' }}>
          Type <b>{project.name}</b> to confirm
          <input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} aria-label="Project name" style={{ padding: '8px 10px', border: '1px solid var(--line-strong)', borderRadius: 8 }} />
        </label>
        <div className={s.confirmActions}>
          <Button variant="secondary" onClick={() => dialog.current?.close()}>
            Cancel
          </Button>
          {project.status !== 'ARCHIVED' && (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                dialog.current?.close();
                change('ARCHIVED');
              }}
            >
              Archive Instead
            </Button>
          )}
          <Button className={s.deleteBtn} disabled={pending || confirmName.trim() !== project.name.trim()} onClick={remove}>
            {pending ? 'Deleting…' : 'Delete Project'}
          </Button>
        </div>
      </dialog>
      {error && (
        <span role="alert" style={{ position: 'absolute', top: '100%', right: 0, fontSize: 12, color: 'var(--red)', whiteSpace: 'nowrap' }}>
          {error}
        </span>
      )}
    </div>
  );
}
