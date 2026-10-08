import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Project } from '@/lib/types';
import s from './module-setup.module.css';

/** "← Back to Projects / {project}" line used on project-scoped module pages. */
export function ProjectContext({ project }: { project: Project }) {
  return (
    <div className={s.context}>
      <Link href="/app/projects">
        <ArrowLeft size={16} /> Back to Projects
      </Link>
      <span aria-hidden>/</span>
      <Link href={`/app/projects/${project.id}`}>{project.name}</Link>
    </div>
  );
}
