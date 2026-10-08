import Link from 'next/link';
import { ArrowRight, BarChart3, CalendarDays, ChevronRight, FilePlus2, FileText, Folder, Lightbulb, Search, Sparkles } from 'lucide-react';
import { Badge, ButtonLink, DataTable, EmptyState, Field, Input, Notice, PageHeader, Panel, Select } from '@/components/ui';
import { ActionButton, ApiForm } from '@/components/ui/actions';
import { StateView } from '@/components/ui/StateView';
import { KeywordClusters } from '@/components/app/keywords/KeywordCollections';
import { ProjectContext } from '@/components/app/ModuleSetup';
import { apiGet, qs } from '@/lib/api';
import { formatDate, formatDateTime, humanize } from '@/lib/format';
import { getAppContext } from '@/lib/project';
import s from './content.module.css';

export type ContentTab = 'ideas' | 'clusters' | 'plan' | 'briefs' | 'optimized';

type Summary = { ideas: number; briefs: number; planned: number; published: number; optimized: number; clusters: number; aiAvailable: boolean };
type Idea = { id: string; title: string; status: string; source: string; createdAt: string; metadata: { targetKeyword?: string; intent?: string; format?: string; rationale?: string; priority?: string } | null };
type Brief = { id: string; title: string; status: string; updatedAt: string; primaryKeyword: { normalizedTerm: string } | null; briefJson: { generatedAt?: string } | null };
type Plan = { id: string; name: string; status: string; createdAt: string; items: { id: string; title: string; status: string; targetDate: string | null; brief: { id: string; title: string } | null }[] };
type OptimizedDoc = { id: string; title: string; status: string; updatedAt: string; page: { url: string } | null; versions: { versionNo: number; createdAt: string }[] };

/**
 * Tabs from the Content Strategy design, mapped onto the navigation page map:
 * Opportunities = Topic Ideas (/content/ideas, `content_ideas`), Drafts =
 * Content Briefs (/content/briefs, `content_briefs`), Content Plan
 * (/content/plan, `content_plans`). Topic Clusters are the project's keyword
 * clusters; Optimized Content is editor documents in review or published.
 */
const TABS: { key: ContentTab; label: string; href: string }[] = [
  { key: 'ideas', label: 'Opportunities', href: '/app/content/ideas' },
  { key: 'clusters', label: 'Topic Clusters', href: '/app/content/clusters' },
  { key: 'plan', label: 'Content Plan', href: '/app/content/plan' },
  { key: 'briefs', label: 'Drafts', href: '/app/content/briefs' },
  { key: 'optimized', label: 'Optimized Content', href: '/app/content/optimized' },
];

const FEATURES = [
  { title: 'Topic Opportunities', text: 'Find high-impact topics and content opportunities for your site.', href: '/app/content/ideas', icon: <Search size={30} />, tone: 'blue' },
  { title: 'Topic Clusters', text: 'Organize related topics into structured content groups.', href: '/app/content/clusters', icon: <FileText size={30} />, tone: 'green' },
  { title: 'Content Plan', text: 'Build and prioritize your content roadmap.', href: '/app/content/plan', icon: <CalendarDays size={30} />, tone: 'amber' },
  { title: 'Optimize Content', text: 'Use AI recommendations to improve existing content and track progress.', href: '/app/content/optimized', icon: <BarChart3 size={30} />, tone: 'purple' },
];

const NEXT = ['Run an SEO audit and research keywords', 'Generate topic opportunities from your data', 'Turn opportunities into briefs and a plan', 'Write, optimize, and publish in the editor'];
const NEXT_STATUS: Record<string, string> = { PLANNED: 'IN_PROGRESS', IN_PROGRESS: 'IN_REVIEW', IN_REVIEW: 'COMPLETED' };
const PRIORITY_TONE: Record<string, 'blue' | 'green' | 'amber'> = { HIGH: 'amber', MEDIUM: 'blue', LOW: 'green' };

/** Content Strategy (chat design 2026-10-06; states from user-app-batch2a/06). */
export async function ContentStrategy({ tab, status }: { tab: ContentTab; status?: string }) {
  const { selectedProject: project } = await getAppContext();
  const summary = project ? await apiGet<Summary>(`/user/projects/${project.id}/content/summary`, { auth: true }) : null;
  const sum = summary?.ok ? summary.data : null;

  return (
    <>
      {project && <ProjectContext project={project} />}
      <PageHeader title="Content Strategy" description="Get AI-powered content recommendations to improve your SEO and AI search visibility." />

      <nav className={s.tabs} aria-label="Content Strategy">
        {TABS.map((t) => (
          <Link key={t.key} href={t.href} className={`${s.tab} ${t.key === tab ? s.tabActive : ''}`} aria-current={t.key === tab ? 'page' : undefined}>
            {t.label}
            {sum && <small className={s.count}>{{ ideas: sum.ideas, clusters: sum.clusters, plan: sum.planned, briefs: sum.briefs, optimized: sum.optimized }[t.key]}</small>}
          </Link>
        ))}
      </nav>

      {tab === 'ideas' && (
        <div className={s.features}>
          {FEATURES.map((f) => (
            <Link key={f.title} href={f.href} className={s.feature}>
              <span className={s.featureIcon} data-tone={f.tone}>
                {f.icon}
              </span>
              <span>
                <b>{f.title}</b>
                <small>{f.text}</small>
              </span>
            </Link>
          ))}
        </div>
      )}

      {!project ? (
        <section className={s.body}>
          <StateView
            kind="empty"
            icon={<Folder size={40} />}
            title="Select a project"
            description="Choose a project to see its content opportunities, clusters, plan, and drafts."
            action={
              <ButtonLink href="/app/projects" size="lg">
                Select a Project
              </ButtonLink>
            }
          />
        </section>
      ) : (
        <div className={s.stack}>
          {tab === 'ideas' && <Ideas projectId={project.id} aiAvailable={!!sum?.aiAvailable} status={status} />}
          {tab === 'clusters' && <KeywordClusters projectId={project.id} />}
          {tab === 'plan' && <Plans projectId={project.id} />}
          {tab === 'briefs' && <Briefs projectId={project.id} aiAvailable={!!sum?.aiAvailable} />}
          {tab === 'optimized' && <Optimized projectId={project.id} />}
        </div>
      )}

      {tab === 'ideas' && (
        <section className={s.next}>
          <span className={s.nextIcon}>
            <Lightbulb size={22} />
          </span>
          <div className={s.nextBody}>
            <div className={s.nextHead}>
              <h2>How it works</h2>
              <Link href="/help?q=content%20strategy" className={s.learn}>
                Learn more <ChevronRight size={16} />
              </Link>
            </div>
            <ol className={s.nextSteps}>
              {NEXT.map((step, i) => (
                <li key={step}>
                  <span className={s.nextNum}>{i + 1}</span>
                  <span>{step}</span>
                  {i < NEXT.length - 1 && <ArrowRight size={18} className={s.nextArrow} aria-hidden />}
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}
    </>
  );
}

const AI_OFF = 'AI generation is not configured on this server yet.';

async function Ideas({ projectId, aiAvailable, status }: { projectId: string; aiAvailable: boolean; status?: string }) {
  const filter = ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'].includes(status ?? '') ? status : undefined;
  const res = await apiGet<Idea[]>(`/user/projects/${projectId}/content/ideas${qs({ status: filter })}`, { auth: true });
  const ideas = res.ok ? res.data : [];
  return (
    <>
      <Panel title="Generate Topic Opportunities" description="Claude proposes ideas from this project's domain, saved keywords, audit findings and AI search gaps. Uses credits.">
        {!aiAvailable && <Notice tone="neutral">{AI_OFF}</Notice>}
        <ApiForm path={`/user/projects/${projectId}/content/ideas/generate`} submitLabel="Generate Ideas" successMessage="Ideas generated.">
          <div className={s.formRow}>
            <Field label="Focus topic (optional)" htmlFor="ci-topic">
              <Input id="ci-topic" name="topic" data-type="optional" maxLength={200} placeholder="e.g. technical SEO for online stores" disabled={!aiAvailable} />
            </Field>
            <Field label="Number of ideas" htmlFor="ci-count">
              <Select id="ci-count" name="count" data-type="number" defaultValue="8" disabled={!aiAvailable}>
                {[5, 8, 12, 20].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </ApiForm>
      </Panel>
      <Panel title={`Opportunities (${ideas.length})`} bodyless>
        <div className={s.toolbar}>
          <ApiForm path={`/user/projects/${projectId}/content/ideas`} submitLabel="Add Idea" resetOnSuccess successMessage="Idea added." className={s.inline}>
            <Input name="title" required minLength={3} maxLength={300} placeholder="Add your own topic idea" aria-label="Idea title" />
          </ApiForm>
          <form className={s.filter}>
            <Select name="status" defaultValue={filter ?? ''} aria-label="Status">
              <option value="">All open</option>
              <option value="DRAFT">New</option>
              <option value="IN_PROGRESS">In brief</option>
              <option value="COMPLETED">Completed</option>
              <option value="ARCHIVED">Archived</option>
            </Select>
            <button type="submit" className={s.apply}>
              Filter
            </button>
          </form>
        </div>
        <DataTable
          columns={['Topic', 'Target Keyword', 'Intent', 'Format', 'Priority', 'Status', 'Actions']}
          rows={ideas.map((i) => [
            <span key="t" style={{ display: 'block', maxWidth: 440 }}>
              <b>{i.title}</b>
              {i.metadata?.rationale && <small className={s.sub}>{i.metadata.rationale}</small>}
              <small className={s.sub}>{i.source === 'AI' ? 'AI suggestion' : 'Added manually'} · {formatDate(i.createdAt)}</small>
            </span>,
            i.metadata?.targetKeyword ?? '—',
            i.metadata?.intent ? humanize(i.metadata.intent) : '—',
            i.metadata?.format ? humanize(i.metadata.format) : '—',
            i.metadata?.priority ? <Badge tone={PRIORITY_TONE[i.metadata.priority]}>{humanize(i.metadata.priority)}</Badge> : '—',
            humanize(i.status === 'DRAFT' ? 'NEW' : i.status),
            <span key="a" className={s.actions}>
              <ActionButton size="sm" variant="outline" path={`/user/projects/${projectId}/content/briefs`} body={{ title: i.title, keyword: i.metadata?.targetKeyword || undefined, ideaId: i.id }} redirectTo="/app/content/briefs/{id}">
                Create Brief
              </ActionButton>
              {i.status === 'ARCHIVED' ? (
                <ActionButton size="sm" variant="ghost" method="PATCH" path={`/user/content/ideas/${i.id}`} body={{ status: 'DRAFT' }}>
                  Restore
                </ActionButton>
              ) : (
                <ActionButton size="sm" variant="ghost" method="PATCH" path={`/user/content/ideas/${i.id}`} body={{ status: 'ARCHIVED' }}>
                  Archive
                </ActionButton>
              )}
            </span>,
          ])}
          empty={<EmptyState icon={<FilePlus2 size={30} />} title="No content opportunities yet" description="Generate ideas from your project data, or add your own topics." />}
        />
      </Panel>
    </>
  );
}

async function Briefs({ projectId, aiAvailable }: { projectId: string; aiAvailable: boolean }) {
  const res = await apiGet<Brief[]>(`/user/projects/${projectId}/content/briefs`, { auth: true });
  const briefs = res.ok ? res.data : [];
  return (
    <>
      <Panel title="New Content Brief" description="A brief gives the writer the outline, questions to answer and keywords to cover.">
        <ApiForm path={`/user/projects/${projectId}/content/briefs`} submitLabel="Create Brief" redirectTo="/app/content/briefs/{id}">
          <div className={s.formRow}>
            <Field label="Working title" htmlFor="cb-title">
              <Input id="cb-title" name="title" required minLength={3} maxLength={300} placeholder="e.g. How to run a technical SEO audit" />
            </Field>
            <Field label="Primary keyword (optional)" htmlFor="cb-kw">
              <Input id="cb-kw" name="keyword" data-type="optional" maxLength={200} placeholder="technical seo audit" />
            </Field>
          </div>
          <label className={s.check}>
            <input type="checkbox" name="generate" disabled={!aiAvailable} defaultChecked={aiAvailable} /> Draft the brief with AI (uses credits)
            {!aiAvailable && <small className={s.sub}>{AI_OFF}</small>}
          </label>
        </ApiForm>
      </Panel>
      <Panel title={`Drafts (${briefs.length})`} bodyless>
        <DataTable
          columns={['Brief', 'Primary Keyword', 'Status', 'Updated', 'Actions']}
          rows={briefs.map((b) => [
            <Link key="t" href={`/app/content/briefs/${b.id}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
              {b.title}
            </Link>,
            b.primaryKeyword?.normalizedTerm ?? '—',
            <span key="s">
              {humanize(b.status)} {b.briefJson?.generatedAt && <Badge tone="blue">AI brief</Badge>}
            </span>,
            formatDateTime(b.updatedAt),
            <span key="a" className={s.actions}>
              <ButtonLink size="sm" variant="outline" href={`/app/content/briefs/${b.id}`}>
                Open
              </ButtonLink>
              <ActionButton size="sm" variant="ghost" method="PATCH" path={`/user/content/briefs/${b.id}`} body={{ status: 'ARCHIVED' }} confirm={`Archive “${b.title}”?`}>
                Archive
              </ActionButton>
            </span>,
          ])}
          empty={<EmptyState icon={<FileText size={30} />} title="No drafts yet" description="Create a brief above or from any opportunity." />}
        />
      </Panel>
    </>
  );
}

async function Plans({ projectId }: { projectId: string }) {
  const [res, briefs] = await Promise.all([apiGet<Plan[]>(`/user/projects/${projectId}/content/plans`, { auth: true }), apiGet<Brief[]>(`/user/projects/${projectId}/content/briefs`, { auth: true })]);
  const plans = res.ok ? res.data : [];
  const briefList = briefs.ok ? briefs.data : [];
  return (
    <>
      <Panel title="Create a Content Plan" description="Group the pieces you will publish, with target dates.">
        <ApiForm path={`/user/projects/${projectId}/content/plans`} submitLabel="Create Plan" resetOnSuccess successMessage="Plan created.">
          <Field label="Plan name" htmlFor="cp-name">
            <Input id="cp-name" name="name" required maxLength={160} placeholder="e.g. Q4 content calendar" />
          </Field>
        </ApiForm>
      </Panel>
      {plans.length === 0 && (
        <section className={s.body}>
          <StateView kind="empty" icon={<CalendarDays size={40} />} title="No content plan yet" description="Create a plan, then add briefs and topics with target dates." />
        </section>
      )}
      {plans.map((plan) => {
        const done = plan.items.filter((i) => i.status === 'COMPLETED').length;
        return (
          <Panel key={plan.id} title={plan.name} description={`${plan.items.length} item${plan.items.length === 1 ? '' : 's'} · ${done} published · created ${formatDate(plan.createdAt)}`} bodyless>
            <div className={s.toolbar}>
              <ApiForm path={`/user/content/plans/${plan.id}/items`} submitLabel="Add Item" resetOnSuccess successMessage="Item added." className={s.planForm}>
                <Input name="title" required maxLength={300} placeholder="Title" aria-label="Item title" />
                <Input name="targetDate" type="date" data-type="date" aria-label="Target date" />
                <Select name="briefId" data-type="nullable" defaultValue="" aria-label="Linked brief">
                  <option value="">No brief</option>
                  {briefList.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </Select>
              </ApiForm>
              <ActionButton size="sm" variant="ghost" method="PATCH" path={`/user/content/plans/${plan.id}`} body={{ status: 'ARCHIVED' }} confirm={`Archive the plan “${plan.name}”?`}>
                Archive Plan
              </ActionButton>
            </div>
            <DataTable
              columns={['Item', 'Target Date', 'Brief', 'Status', 'Actions']}
              rows={plan.items.map((i) => [
                <b key="t">{i.title}</b>,
                i.targetDate ? formatDate(i.targetDate) : '—',
                i.brief ? (
                  <Link key="b" href={`/app/content/briefs/${i.brief.id}`} style={{ color: 'var(--blue)' }}>
                    {i.brief.title}
                  </Link>
                ) : (
                  '—'
                ),
                humanize(i.status),
                <span key="a" className={s.actions}>
                  {NEXT_STATUS[i.status] && (
                    <ActionButton size="sm" variant="outline" method="PATCH" path={`/user/content/plan-items/${i.id}`} body={{ status: NEXT_STATUS[i.status] }}>
                      Move to {humanize(NEXT_STATUS[i.status])}
                    </ActionButton>
                  )}
                  <ActionButton size="sm" variant="ghost" method="DELETE" path={`/user/content/plan-items/${i.id}`} confirm={`Remove “${i.title}” from the plan?`}>
                    Remove
                  </ActionButton>
                </span>,
              ])}
              empty={<EmptyState compact icon={<CalendarDays size={26} />} title="No items yet" description="Add the first piece above." />}
            />
          </Panel>
        );
      })}
    </>
  );
}

async function Optimized({ projectId }: { projectId: string }) {
  const res = await apiGet<OptimizedDoc[]>(`/user/projects/${projectId}/content/optimized`, { auth: true });
  const docs = res.ok ? res.data : [];
  return (
    <Panel title="Optimized Content" description="Pages you improved in the On-Page SEO Editor that are in review or published." bodyless>
      <DataTable
        columns={['Document', 'Page', 'Status', 'Version', 'Updated', 'Actions']}
        rows={docs.map((d) => [
          <b key="t">{d.title}</b>,
          d.page ? (
            <a key="u" href={d.page.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)' }}>
              {d.page.url}
            </a>
          ) : (
            '—'
          ),
          humanize(d.status),
          d.versions[0] ? `v${d.versions[0].versionNo}` : '—',
          formatDateTime(d.updatedAt),
          <ButtonLink key="o" size="sm" variant="outline" href={`/app/editor/${d.id}`}>
            Open in Editor
          </ButtonLink>,
        ])}
        empty={
          <EmptyState
            icon={<Sparkles size={30} />}
            title="No optimized content yet"
            description="Open a page in the On-Page SEO Editor, apply AI recommendations, and send it for review or publish it."
            action={<ButtonLink href="/app/editor">Open the Editor</ButtonLink>}
          />
        }
      />
    </Panel>
  );
}
