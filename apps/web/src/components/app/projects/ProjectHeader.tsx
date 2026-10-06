import Link from 'next/link';
import { ArrowLeft, BarChart3, ExternalLink, FileText, Globe, Home, Pencil, Search, Settings, Sparkles } from 'lucide-react';
import { TabNav } from '@/components/ui';
import type { Project } from '@/lib/types';
import { ManageProjectMenu, SelectProjectOnVisit, StatusMenu } from './ProjectControls';

export type ProjectTab = 'overview' | 'audit' | 'content' | 'geo' | 'reports' | 'settings';

export function projectTabs(projectId: string) {
  return [
    { key: 'overview', label: 'Overview', icon: <Home size={20} />, href: `/app/projects/${projectId}` },
    { key: 'audit', label: 'SEO Audit', icon: <Search size={20} />, href: '/app/audit' },
    { key: 'content', label: 'Content Strategy', icon: <FileText size={20} />, href: '/app/content' },
    { key: 'geo', label: 'AI Search (GEO)', icon: <Sparkles size={20} />, href: '/app/geo' },
    { key: 'reports', label: 'Reports', icon: <BarChart3 size={20} />, href: `/app/projects/${projectId}/reports` },
    { key: 'settings', label: 'Settings', icon: <Settings size={20} />, href: '/app/settings/project-defaults' },
  ];
}

/** Shared header for project-scoped pages: back link, name, status, domain, manage menu, tabs. */
export function ProjectHeader({ project, active, description, back }: { project: Project; active: ProjectTab; description: string; back?: { href: string; label: string } }) {
  const backLink = back ?? { href: '/app/projects', label: 'Back to My Projects' };
  return (
    <>
      <SelectProjectOnVisit projectId={project.id} />
      <Link href={backLink.href} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', color: 'var(--blue)', fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
        <ArrowLeft size={16} /> {backLink.label}
      </Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 34, fontWeight: 800, color: 'var(--ink)' }}>{project.name}</h1>
            <StatusMenu project={project} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, fontSize: 15 }}>
            <Globe size={18} color="var(--blue)" />
            {project.primaryDomain ? (
              <a href={`https://${project.primaryDomain}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>
                {project.primaryDomain} <ExternalLink size={14} style={{ verticalAlign: -2 }} />
              </a>
            ) : (
              <span style={{ color: 'var(--muted)' }}>No domain added yet</span>
            )}
            <span title="Domain management will be available soon" style={{ color: 'var(--subtle)' }}>
              <Pencil size={16} />
            </span>
          </div>
          <p style={{ color: 'var(--muted)', marginTop: 6 }}>{description}</p>
        </div>
        <ManageProjectMenu project={project} />
      </div>
      <TabNav tabs={projectTabs(project.id)} active={active} />
    </>
  );
}
