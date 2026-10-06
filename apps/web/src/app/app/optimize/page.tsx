import Link from 'next/link';
import { BarChart3, CalendarDays, CircleAlert, CircleCheck, Download, ExternalLink, FileSearch, Info, RefreshCw, Search, Settings2, TriangleAlert } from 'lucide-react';
import { Button, ButtonLink, Card, DataTable, EmptyState, Grid, IconCircle, Input, PageHeader, Panel, Select } from '@/components/ui';
import { getAppContext } from '@/lib/project';
import p from '@/components/app/pages.module.css';
import { appCrumbs } from '@/lib/nav';

export const metadata = { title: 'Optimization Center' };

const CATEGORIES = ['All', 'SEO', 'Content', 'AI Search (GEO)', 'Technical'];

/**
 * Recommendations are generated from audit findings (guide §6). Until the
 * audit API exists there are none, so the table is empty and re-analysis is
 * disabled ("Run an SEO audit to enable this").
 */
export default async function OptimizationCenterPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { selectedProject } = await getAppContext();
  const requested = (await searchParams).category;
  const category = CATEGORIES.find((c) => c === requested) ?? 'All';
  const crumbs = appCrumbs(
    { label: 'My Projects', href: '/app/projects' },
    ...(selectedProject ? [{ label: selectedProject.name, href: `/app/projects/${selectedProject.id}` }] : []),
    { label: 'Optimization Center' },
  );

  return (
    <>
      <PageHeader
        title="Optimization Center"
        description="Manage and track all SEO, content, and AI search recommendations in one place."
        crumbs={crumbs}
        actions={
          <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', color: 'var(--muted)', fontSize: 14 }}>
                <CalendarDays size={18} color="var(--blue)" /> Last analyzed: —
              </span>
              <Button variant="muted" icon={<RefreshCw size={16} />} disabled>
                Re-analyze Site
              </Button>
            </div>
            <span style={{ fontSize: 12, color: 'var(--muted)', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              <Info size={12} /> Run an SEO audit to enable this.
            </span>
          </div>
        }
      />

      <Grid cols={4} style={{ marginBottom: 18 }}>
        {[
          { icon: <CircleAlert size={26} />, tone: 'red' as const, title: 'High Priority', text: 'Fix these first for the biggest impact.', color: 'var(--red)' },
          { icon: <TriangleAlert size={26} />, tone: 'amber' as const, title: 'Medium Priority', text: 'Improve to strengthen performance.', color: '#ea7a0b' },
          { icon: <BarChart3 size={26} />, tone: 'blue' as const, title: 'Low Priority', text: 'Additional opportunities.', color: 'var(--blue)' },
          { icon: <CircleCheck size={26} />, tone: 'green' as const, title: 'Verified', text: 'Fixes confirmed and completed.', color: 'var(--green)' },
        ].map((m) => (
          <Card key={m.title} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <IconCircle tone={m.tone} size={56}>
              {m.icon}
            </IconCircle>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>—</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: m.color }}>{m.title}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{m.text}</div>
            </div>
          </Card>
        ))}
      </Grid>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        {CATEGORIES.map((c) => (
          <ButtonLink key={c} href={c === 'All' ? '/app/optimize' : `/app/optimize?category=${encodeURIComponent(c)}`} variant={c === category ? 'primary' : 'secondary'}>
            {c}
          </ButtonLink>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Input placeholder="Search recommendations..." icon={<Search size={18} />} aria-label="Search recommendations" style={{ width: 260 }} disabled />
          {['Priority', 'Status', 'Page'].map((f) => (
            <Select key={f} aria-label={f} disabled style={{ width: 120 }}>
              <option>{f}</option>
            </Select>
          ))}
        </div>
      </div>

      <Panel bodyless>
        <div style={{ display: 'flex', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
          <Select aria-label="Bulk actions" disabled style={{ width: 160 }}>
            <option>Bulk Actions</option>
          </Select>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <Button variant="secondary" icon={<Download size={16} />} disabled>
              Export
            </Button>
            <Button variant="secondary" icon={<Settings2 size={16} />} disabled>
              Columns
            </Button>
          </div>
        </div>
        <DataTable
          selectable
          columns={['Recommendation', 'Affected Page', 'Category', 'Priority', 'Status', 'Impact', 'Actions']}
          empty={
            <EmptyState
              icon={<FileSearch size={32} />}
              title="No recommendations yet"
              description="Run an SEO audit to generate personalized recommendations for your website. You’ll see actionable fixes here to improve your SEO, content, and AI search visibility."
              action={
                <>
                  <ButtonLink href="/app/audit" icon={<ExternalLink size={18} />} size="lg">
                    Run SEO Audit
                  </ButtonLink>
                  <Link href="/help?q=optimization" style={{ color: 'var(--blue)', textDecoration: 'underline', fontSize: 14 }}>
                    Learn more about the Optimization Center
                  </Link>
                </>
              }
            />
          }
        />
      </Panel>

      <div style={{ height: 16 }} />
      <Panel title="How it works" flushHead>
        <div className={p.steps} style={{ textAlign: 'left', alignItems: 'stretch' }}>
          {[
            ['Analyze Your Site', 'Run an SEO audit to find opportunities across SEO, content, AI search (GEO), and technical areas.'],
            ['Review Recommendations', 'See prioritized recommendations with clear impact and guidance.'],
            ['Take Action', 'Open pages in the editor, make improvements, and mark progress as you go.'],
            ['Verify Fixes', 'Re-analyze your site to confirm completed fixes and track your improvement over time.'],
          ].map(([title, text], i) => (
            <div key={title} style={{ flex: 1, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span className={p.stepNum} style={{ background: 'var(--blue)', flexShrink: 0 }}>
                {i + 1}
              </span>
              <div>
                <h4 style={{ fontSize: 16 }}>{title}</h4>
                <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>{text}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
