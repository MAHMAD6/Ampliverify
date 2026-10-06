import Link from 'next/link';
import { BarChart3, ChevronRight, Coins, Eye, Folder, Lightbulb, Link2, Plus, Search } from 'lucide-react';
import { Button, ButtonLink, Input, Select } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { GeoShell, GeoTable } from '@/components/app/geo/GeoShell';
import { GeoSetup } from '@/components/app/ModuleSetup';
import { apiList } from '@/lib/api';
import { getAppContext } from '@/lib/project';
import s from '@/components/app/geo/geo.module.css';

export const metadata = { title: 'AI Search (GEO)' };

const FEATURES = [
  { title: 'Track your brand visibility', text: 'See if and how your content appears in AI search results.', icon: <Eye size={26} /> },
  { title: 'Monitor citations', text: 'Find out which sources are citing your brand and content.', icon: <Link2 size={26} /> },
  { title: 'Compare platforms', text: 'Track visibility across the AI search platforms you select.', icon: <BarChart3 size={26} /> },
  { title: 'Find new opportunities', text: 'Discover relevant topics and content gaps to improve visibility.', icon: <Lightbulb size={26} /> },
];

/**
 * AI Search (GEO) Overview = Prompt Tracking tab (chat design 2026-10-06).
 * Platform filter options come from the GEO platform registry; the prompt
 * list needs the GEO API, so the table is empty and filters stay disabled
 * until there are prompts to filter.
 */
export default async function GeoOverviewPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const [{ period = '30d' }, { selectedProject }, platforms] = await Promise.all([searchParams, getAppContext(), apiList<{ key: string; name: string }>('/public/geo-platforms')]);

  return (
    <GeoShell tab="prompts" period={period}>
      {selectedProject && <GeoSetup project={selectedProject} />}
      <div className={s.filters}>
        <Input placeholder="Search prompts (e.g. “best dog food brands”)" icon={<Search size={18} />} aria-label="Search prompts" disabled />
        <Select aria-label="Platform" disabled defaultValue="">
          <option value="">All Platforms</option>
          {platforms.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select aria-label="Status" disabled defaultValue="">
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
        </Select>
        <Select aria-label="Sort" disabled defaultValue="updated">
          <option value="updated">Last Updated</option>
          <option value="visibility">Visibility Score</option>
          <option value="citations">Citations</option>
        </Select>
      </div>
      <GeoTable columns={['Prompt', 'Platform', 'Visibility Score', 'Citations', 'Top Source', 'Last Updated', 'Actions']}>
        {selectedProject ? (
          <StateView
            kind="empty"
            icon={<Search size={40} />}
            title="Start tracking your AI search visibility"
            description="Add a prompt or question to see how your brand and content appear in AI-generated search results across different platforms."
            action={
              <Button size="lg" icon={<Plus size={18} />} disabled title="Prompt tracking is not available for your account yet.">
                Add Your First Prompt
              </Button>
            }
          />
        ) : (
          <StateView
            kind="empty"
            icon={<Folder size={40} />}
            title="Select a project"
            description="AI search visibility is tracked per project. Choose a project to add prompts."
            action={<ButtonLink href="/app/projects">Select a Project</ButtonLink>}
          />
        )}
        <div style={{ padding: '0 14px 14px' }}>
          <div className={s.credits}>
            <Coins size={30} />
            <span>
              <b>This feature uses credits.</b>
              <small>Each prompt check consumes credits based on the selected platforms.</small>
            </span>
            <Link href="/help?q=credits">
              Learn more <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </GeoTable>
      <div className={s.features}>
        {FEATURES.map((f) => (
          <div key={f.title} className={s.feature}>
            <span className={s.featureIcon}>{f.icon}</span>
            <span>
              <b>{f.title}</b>
              <small>{f.text}</small>
            </span>
          </div>
        ))}
      </div>
    </GeoShell>
  );
}
