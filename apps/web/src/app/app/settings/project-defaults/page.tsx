import { BarChart3, ChevronUp, FileText, Folder, Info, Search, Sparkles } from 'lucide-react';
import { Button, IconCircle, Notice } from '@/components/ui';
import p from '@/components/app/pages.module.css';

export const metadata = { title: 'Project Defaults · Settings' };

const SECTIONS = [
  { icon: <Search size={26} />, tone: 'purple' as const, title: 'Audit Settings', text: 'Set default audit options for new projects.', emptyTitle: 'No default audit settings yet', emptyText: 'Choose your preferred audit options to save time on future projects.' },
  { icon: <FileText size={26} />, tone: 'blue' as const, title: 'Content Strategy Settings', text: 'Set default content strategy options for new projects.', emptyTitle: 'No default content strategy settings yet', emptyText: 'Choose your preferred options for content planning and recommendations.' },
  { icon: <Sparkles size={26} />, tone: 'purple' as const, title: 'GEO Monitoring Settings', text: 'Set default GEO monitoring options for new projects.', emptyTitle: 'No default GEO monitoring settings yet', emptyText: 'Choose your preferred monitoring frequency and search sources.' },
  { icon: <BarChart3 size={26} />, tone: 'blue' as const, title: 'Report Settings', text: 'Set default report options and format for new projects.', emptyTitle: 'No default report settings yet', emptyText: 'Choose your preferred report format and content sections.' },
];

/** Workspace-level defaults for new projects. Configuring them needs the settings API (not built yet). */
export default function ProjectDefaultsPage() {
  return (
    <>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
        <IconCircle tone="blue" size={56}>
          <Folder size={26} />
        </IconCircle>
        <div>
          <h2 style={{ fontSize: 28 }}>Project Defaults</h2>
          <p style={{ color: 'var(--muted)', marginTop: 4 }}>
            Set default settings for new projects. These preferences are applied automatically when you create a new project, and you can always change them later.{' '}
            <strong style={{ color: 'var(--heading)' }}>Existing projects will not be affected.</strong>
          </p>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 14 }}>
        {SECTIONS.map((s) => (
          <details key={s.title} open style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
            <summary style={{ listStyle: 'none', display: 'flex', gap: 16, alignItems: 'center', cursor: 'pointer' }}>
              <IconCircle tone={s.tone} size={60}>
                {s.icon}
              </IconCircle>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 18 }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--muted)' }}>{s.text}</p>
              </div>
              <Button variant="outline" disabled title="Defaults can be configured soon">
                Configure Defaults
              </Button>
              <ChevronUp size={20} color="var(--muted)" aria-hidden />
            </summary>
            <div className={p.notifCard} style={{ marginTop: 12, marginLeft: 76, background: 'var(--surface-alt)' }}>
              <FileText size={28} color="var(--muted)" />
              <div>
                <h4>{s.emptyTitle}</h4>
                <p>{s.emptyText}</p>
              </div>
              <Button variant="outline" disabled>
                Configure Defaults
              </Button>
            </div>
          </details>
        ))}
        <Notice icon={<Info size={20} />} title="These are defaults for new projects only.">
          Existing projects will not be affected. You can always customize settings for each project individually.
        </Notice>
      </div>
    </>
  );
}
