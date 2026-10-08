import { BarChart3, Bot, Briefcase, BookOpen, FileSearch, KeyRound, LineChart, PenSquare, Plug, Sparkles, Lightbulb } from 'lucide-react';
import { ActionButton } from '@/components/ui/actions';
import { AdminList, StatusPill } from '@/components/admin/AdminList';
import { dateTime, loadModuleControls, matchesQ, userLabel } from '@/lib/admin-data';

export const metadata = { title: 'Module Controls' };

/** Platform modules from the design; `key` is the `module_controls.module_key`. */
const MODULES = [
  { key: 'seo_audit', name: 'On-Page SEO Audit', category: 'Core', text: 'Analyze website pages for SEO issues and improvement opportunities.', icon: <FileSearch size={18} /> },
  { key: 'optimization', name: 'Optimization Center', category: 'Core', text: 'Get prioritized recommendations to improve search visibility.', icon: <LineChart size={18} /> },
  { key: 'seo_editor', name: 'On-Page SEO Editor', category: 'Core', text: 'Create and optimize page content with SEO guidance.', icon: <PenSquare size={18} /> },
  { key: 'content', name: 'Content Strategy', category: 'Content', text: 'Generate content ideas and topic clusters.', icon: <Lightbulb size={18} /> },
  { key: 'keywords', name: 'Keyword Research', category: 'Core', text: 'Find and analyze keywords and search intent.', icon: <KeyRound size={18} /> },
  { key: 'geo', name: 'AI Search (GEO)', category: 'AI', text: 'Optimize content for AI search and generative engine visibility.', icon: <Sparkles size={18} /> },
  { key: 'reports', name: 'Reports', category: 'Analytics', text: 'Track performance and generate SEO reports.', icon: <BarChart3 size={18} /> },
  { key: 'ai', name: 'AI Assistance', category: 'AI', text: 'AI suggestions, briefs and generation across the product.', icon: <Bot size={18} /> },
  { key: 'integrations', name: 'Integrations', category: 'Workspace', text: 'WordPress publishing and Google Search Console / Analytics.', icon: <Plug size={18} /> },
  { key: 'blog', name: 'Blog & Resources', category: 'Content', text: 'Public blog, guides and resources.', icon: <BookOpen size={18} /> },
  { key: 'careers', name: 'Careers', category: 'Content', text: 'Public job openings and applications.', icon: <Briefcase size={18} /> },
];

/**
 * Module Controls (chat design 2026-10-06). Status is live from
 * `GET /admin/module-controls`; modules are enabled until an admin turns
 * them off. Changes are confirmed and audited, and never change plan
 * entitlements.
 */
export default async function ModuleControlsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; category?: string }> }) {
  const { q, status, category } = await searchParams;
  const controls = await loadModuleControls();
  const byKey = new Map((controls ?? []).map((c) => [c.moduleKey, c]));
  const statusOf = (k: string) => (!controls ? null : (byKey.get(k)?.enabled ?? true) ? 'Enabled' : 'Disabled');
  const rows = MODULES.filter((m) => matchesQ(q, m.name, m.text) && (!category || m.category === category) && (!status || statusOf(m.key) === status));
  return (
    <AdminList
      section="System Operations"
      title="Module Controls"
      description="Enable or disable platform modules for all users. Module availability does not affect plan entitlements."
      about={{ title: 'Module Controls', text: 'These settings enable or disable modules globally. Plan-based access is managed under Feature Entitlements.' }}
      basePath="/admin/modules"
      search="Search modules by name or description..."
      liveFilters={{ q }}
      selects={[
        { label: 'Status', name: 'status', value: status, options: ['All Statuses', 'Enabled', 'Disabled'] },
        { label: 'Category', name: 'category', value: category, options: ['All Categories', 'Core', 'Content', 'AI', 'Analytics', 'Workspace'] },
      ]}
      columns={['Module', 'Category', 'Description', 'Status', 'Last Updated', 'Updated By', 'Actions']}
      rows={rows.map((m) => {
        const c = byKey.get(m.key);
        const st = statusOf(m.key);
        return [
          <span key="m" style={{ display: 'inline-flex', gap: 10, alignItems: 'center', fontWeight: 600 }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 8, background: 'var(--blue-50)', color: 'var(--blue)' }}>{m.icon}</span>
            {m.name}
          </span>,
          <StatusPill key="c" tone="blue">
            {m.category}
          </StatusPill>,
          m.text,
          st ? (
            <span key="s" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <StatusPill tone={st === 'Enabled' ? 'green' : 'red'}>{st}</StatusPill>
            </span>
          ) : (
            '—'
          ),
          c?.updatedAt ? dateTime(c.updatedAt) : '—',
          c?.updater ? userLabel(c.updater) : '—',
          st ? (
            <ActionButton
              key="a"
              size="sm"
              variant={st === 'Enabled' ? 'outline' : 'primary'}
              method="PUT"
              path={`/admin/module-controls/${m.key}`}
              body={{ enabled: st !== 'Enabled' }}
              confirm={st === 'Enabled' ? `Disable ${m.name} for every user? Requests to this module will be refused until it is enabled again.` : `Enable ${m.name} for every user?`}
            >
              {st === 'Enabled' ? 'Disable' : 'Enable'}
            </ActionButton>
          ) : (
            '—'
          ),
        ];
      })}
      empty={{ icon: <FileSearch size={40} />, title: 'No modules match your filters', text: 'Clear the filters to see every platform module.' }}
      footnote={controls ? `Showing ${rows.length} of ${MODULES.length} modules. Changing a module requires confirmation and is audited.` : 'Module status will appear once it can be loaded with your admin permissions.'}
    />
  );
}
