import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Globe, Info, Link2 } from 'lucide-react';
import { Button, Input, Textarea } from '@/components/ui';
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

function Shell({ title, text, children, action, note }: { title: string; text: string; children: ReactNode; action: string; note?: string }) {
  return (
    <section className={s.panel}>
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
      <Button block disabled title={note}>
        {action} <ArrowRight size={16} />
      </Button>
      {note && (
        <small className={s.unavailable}>
          <Info size={14} /> {note}
        </small>
      )}
    </section>
  );
}

function DomainField({ id, domain }: { id: string; domain: string | null | undefined }) {
  return <Input id={id} value={domain ?? 'No domain set for this project'} readOnly disabled icon={<Globe size={16} />} aria-label="Project domain" />;
}

/**
 * Module setup panels from the Add Project design (chat image 2026-10-06):
 * audits take a single page URL; content strategy and GEO always use the
 * project's domain. The actions are disabled until the audit, content and
 * GEO services exist; nothing is queued or simulated.
 */
export function AuditSetup({ project }: { project: Project }) {
  const host = project.primaryDomain ?? 'example.com';
  return (
    <Shell title="Page URL" text="Enter the full URL of the page you want to audit." action="Run Audit" note="Audits are not available for your account yet.">
      <Input type="url" name="url" placeholder={`https://${host}/page-url`} icon={<Link2 size={16} />} aria-label="Page URL" disabled />
      <small className={s.example}>Example: https://{host}/blog/seo-guide</small>
    </Shell>
  );
}

export function ContentSetup({ project }: { project: Project }) {
  return (
    <Shell title="Website Domain" text="We will use the project domain for content analysis." action="Generate Strategy" note="Strategy generation is not available for your account yet.">
      <DomainField id="cs-domain" domain={project.primaryDomain} />
      <small className={s.example}>This is the domain you set up for this project.</small>
      <p className={s.info}>
        <Info size={16} /> Content strategy analyzes your entire website domain, not a single page URL.
      </p>
    </Shell>
  );
}

export function GeoSetup({ project }: { project: Project }) {
  return (
    <Shell title="Tracked Domain" text="We will use the project domain for AI search analysis." action="Save & Continue" note="Prompt tracking is not available for your account yet.">
      <DomainField id="geo-domain" domain={project.primaryDomain} />
      <small className={s.example}>This is the domain you set up for this project.</small>
      <label htmlFor="geo-prompts" className={s.label}>
        Tracked Prompts <span>(Optional)</span>
      </label>
      <Textarea id="geo-prompts" rows={3} placeholder="Enter search prompts to track (one per line)" disabled />
      <small className={s.example}>Example: best project management tools, ai content strategy, seo audit tool</small>
    </Shell>
  );
}
