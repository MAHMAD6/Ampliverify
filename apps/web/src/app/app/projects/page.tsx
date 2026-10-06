import Link from 'next/link';
import {
  BarChart3,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  FileText,
  Globe,
  LayoutGrid,
  Layers,
  Link2,
  List,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import { AutoSubmitSelect } from '@/components/ui/AutoSubmitSelect';
import { DismissibleBanner } from '@/components/app/projects/DismissibleBanner';
import { ProjectRowActions } from '@/components/app/projects/ProjectRowActions';
import { Badge, Button, ButtonLink, EmptyState, IconCircle, Input, PageHeader, Panel, Select } from '@/components/ui';
import { formatDate, humanize } from '@/lib/format';
import { getAppContext } from '@/lib/project';
import type { Project } from '@/lib/types';
import s from '@/components/app/projects/projects.module.css';

export const metadata = { title: 'My Projects' };

const PAGE_SIZES = [10, 25, 50];
const TONES = [
  { bg: 'var(--blue-50)', fg: 'var(--blue)' },
  { bg: 'var(--green-50)', fg: 'var(--green)' },
  { bg: 'var(--purple-50)', fg: 'var(--purple)' },
  { bg: 'var(--amber-50)', fg: '#ea7a0b' },
];

type Params = { tab?: string; q?: string; sort?: string; view?: string; page?: string; size?: string };

function href(base: Params, patch: Params) {
  const merged = { ...base, ...patch };
  const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]).toString();
  return `/app/projects${qs ? `?${qs}` : ''}`;
}

function sortProjects(list: Project[], sort?: string) {
  const by = {
    updated: (a: Project, b: Project) => b.updatedAt.localeCompare(a.updatedAt),
    added: (a: Project, b: Project) => b.createdAt.localeCompare(a.createdAt),
    name: (a: Project, b: Project) => a.name.localeCompare(b.name),
  }[sort === 'added' || sort === 'name' ? sort : 'updated'];
  return [...list].sort(by);
}

function ModuleCell({ action, href: link }: { action: string; href: string }) {
  return (
    <div className={s.module}>
      <span>—</span>
      <Link href={link}>{action}</Link>
    </div>
  );
}

/**
 * Project list from the API. Per-module status, page and prompt counts need
 * the audit/content/GEO APIs, so those cells show "—" with the next action.
 */
export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { signedIn, projects } = await getAppContext();
  const tab = (['ACTIVE', 'PAUSED', 'ARCHIVED'] as const).find((t) => t.toLowerCase() === params.tab) ?? null;
  const view = params.view === 'grid' ? 'grid' : 'list';
  const size = PAGE_SIZES.includes(Number(params.size)) ? Number(params.size) : 10;

  const counts = {
    all: projects.length,
    ACTIVE: projects.filter((p) => p.status === 'ACTIVE').length,
    PAUSED: projects.filter((p) => p.status === 'PAUSED').length,
    ARCHIVED: projects.filter((p) => p.status === 'ARCHIVED').length,
  };
  const term = params.q?.trim().toLowerCase();
  const filtered = sortProjects(
    projects.filter((p) => (!tab || p.status === tab) && (!term || p.name.toLowerCase().includes(term) || p.primaryDomain?.toLowerCase().includes(term))),
    params.sort,
  );
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const page = Math.min(Math.max(Number(params.page) || 1, 1), pages);
  const visible = filtered.slice((page - 1) * size, page * size);
  const count = (n: number) => <span className={s.count}>{signedIn ? n : '—'}</span>;

  return (
    <>
      <PageHeader
        title="My Projects"
        description="Manage your websites and domains. Each project includes SEO audits, content strategy, AI search tracking, and reports — all in one place."
        actions={
          <ButtonLink href="/app/projects/new" icon={<Plus size={18} />}>
            Add Project
          </ButtonLink>
        }
      />

      <div className={s.toolbar}>
        <nav className={s.tabs} aria-label="Project status">
          {[
            { key: undefined, label: 'All Projects', n: counts.all },
            { key: 'active', label: 'Active', n: counts.ACTIVE },
            { key: 'paused', label: 'Paused', n: counts.PAUSED },
            { key: 'archived', label: 'Archived', n: counts.ARCHIVED },
          ].map((t) => {
            const active = (params.tab ?? undefined) === t.key || (!params.tab && !t.key);
            return (
              <Link key={t.label} href={href(params, { tab: t.key, page: undefined })} className={`${s.tab} ${active ? s.tabActive : ''}`} aria-current={active ? 'page' : undefined}>
                {t.label} {count(t.n)}
              </Link>
            );
          })}
        </nav>
        <div className={s.right}>
          <form className={s.sort}>
            {Object.entries(params)
              .filter(([k, v]) => k !== 'sort' && v)
              .map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
            <label htmlFor="p-sort">Sort by</label>
            <AutoSubmitSelect id="p-sort" name="sort" defaultValue={params.sort ?? 'updated'}>
              <option value="updated">Recently Updated</option>
              <option value="added">Recently Added</option>
              <option value="name">Name</option>
            </AutoSubmitSelect>
            <button type="submit" className="visually-hidden">
              Apply sort
            </button>
          </form>
          <div className={s.viewToggle} role="group" aria-label="View">
            <Link href={href(params, { view: 'grid' })} aria-current={view === 'grid'} aria-label="Grid view">
              <LayoutGrid size={20} />
            </Link>
            <Link href={href(params, { view: undefined })} aria-current={view === 'list'} aria-label="List view">
              <List size={20} />
            </Link>
          </div>
        </div>
      </div>

      {projects.length === 0 ? (
        <>
          <DismissibleBanner id="what-is-a-project">
            <IconCircle tone="blue" size={48}>
              <Layers size={24} />
            </IconCircle>
            <div>
              <h3>What is a Project?</h3>
              <p>
                A project represents one website or domain and its associated SEO audits, content strategy, AI search tracking, and reports. Add a project to get personalized recommendations and track your progress over time.
              </p>
            </div>
            <Link href="/help?q=project" style={{ color: 'var(--blue)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              Learn more
            </Link>
          </DismissibleBanner>
          <Panel bodyless>
            <div className={s.emptyHero}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <IconCircle tone="blue" size={96}>
                  <Globe size={44} />
                </IconCircle>
              </div>
              <h2>Add your first project</h2>
              <p>
                Start by adding a website or domain to analyze, optimize, and monitor. You’ll get personalized recommendations and be able to track your progress in search and supported AI search experiences.
              </p>
              <div style={{ marginTop: 20 }}>
                <ButtonLink href="/app/projects/new" icon={<Plus size={18} />} size="lg">
                  Add Project
                </ButtonLink>
              </div>
              <div className={s.or}>or</div>
              <Button variant="secondary" disabled icon={<Link2 size={18} />}>
                Import from Google Search Console <Badge tone="blue">Coming Soon</Badge>
              </Button>
              <p style={{ fontSize: 13, marginTop: 10 }}>Manual add is available now. Search Console import will be available in a future release.</p>
            </div>
            <div className={s.capabilities}>
              <h3>What you can do with a project</h3>
              <div className={s.capGrid}>
                {[
                  { icon: <Search size={22} />, tone: 'blue' as const, title: 'Run SEO Audits', text: 'Find and fix on-page issues across your site.', href: '/app/audit' },
                  { icon: <FileText size={22} />, tone: 'green' as const, title: 'Build Content Strategy', text: 'Discover new opportunities and improve existing content.', href: '/app/content-strategy' },
                  { icon: <Sparkles size={22} />, tone: 'purple' as const, title: 'Track AI Search (GEO)', text: 'Monitor visibility across supported AI search experiences.', href: '/app/geo' },
                  { icon: <BarChart3 size={22} />, tone: 'amber' as const, title: 'View Reports', text: 'See your project activity and progress.', href: '/app/reports' },
                ].map((c) => (
                  <Link key={c.title} href={c.href} className={s.cap}>
                    <IconCircle tone={c.tone} size={52}>
                      {c.icon}
                    </IconCircle>
                    <div>
                      <h4>{c.title}</h4>
                      <p>{c.text}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </Panel>
          <Link href="/app/help" className={s.help}>
            <CircleHelp size={20} color="var(--blue)" /> Need help?
          </Link>
        </>
      ) : (
        <>
          <Panel bodyless>
            <form className={s.filters} role="search">
              {params.tab && <input type="hidden" name="tab" value={params.tab} />}
              {params.view && <input type="hidden" name="view" value={params.view} />}
              <Input name="q" defaultValue={params.q} placeholder="Search projects..." icon={<Search size={18} />} aria-label="Search projects" />
              <Select name="tab" defaultValue={params.tab ?? ''} aria-label="Status">
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </Select>
              <Button type="submit" variant="secondary">
                Apply
              </Button>
              <Link href="/app/projects" className={s.clear}>
                Clear filters
              </Link>
            </form>
            {visible.length === 0 ? (
              <EmptyState icon={<Search size={26} />} title="No projects match your filters" description="Try a different search term or status." />
            ) : view === 'list' ? (
              <div style={{ overflowX: 'auto' }}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Status</th>
                      <th>SEO Audit</th>
                      <th>Content Strategy</th>
                      <th>AI Search (GEO)</th>
                      <th>Pages</th>
                      <th>GEO Prompts</th>
                      <th>Last Analyzed</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((p, i) => {
                      const tone = TONES[i % TONES.length];
                      return (
                        <tr key={p.id}>
                          <td>
                            <div className={s.projectCell}>
                              <span className={s.letter} style={{ background: tone.bg, color: tone.fg }}>
                                {p.name.trim()[0]?.toUpperCase() ?? '?'}
                              </span>
                              <div>
                                <div className={s.projectName}>{p.name}</div>
                                {p.primaryDomain ? (
                                  <a className={s.domain} href={`https://${p.primaryDomain}`} target="_blank" rel="noopener noreferrer">
                                    {p.primaryDomain} <ExternalLink size={14} />
                                  </a>
                                ) : (
                                  <span className={s.dash}>No domain added</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`${s.status} ${s[p.status]}`}>{humanize(p.status)}</span>
                          </td>
                          <td>
                            <ModuleCell action="Run Audit" href="/app/audit" />
                          </td>
                          <td>
                            <ModuleCell action="Get Started" href="/app/content-strategy" />
                          </td>
                          <td>
                            <ModuleCell action="Set Up" href="/app/geo" />
                          </td>
                          <td className={s.dash}>—</td>
                          <td className={s.dash}>—</td>
                          <td className={s.dash}>—</td>
                          <td>
                            <ProjectRowActions project={p} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={s.grid} style={{ padding: 16 }}>
                {visible.map((p, i) => {
                  const tone = TONES[i % TONES.length];
                  return (
                    <div key={p.id} className={s.card}>
                      <div className={s.projectCell}>
                        <span className={s.letter} style={{ background: tone.bg, color: tone.fg }}>
                          {p.name.trim()[0]?.toUpperCase() ?? '?'}
                        </span>
                        <div>
                          <div className={s.projectName}>{p.name}</div>
                          <span className={s.dash}>{p.primaryDomain ?? 'No domain added'}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className={`${s.status} ${s[p.status]}`}>{humanize(p.status)}</span>
                        <span className={s.dash}>Updated {formatDate(p.updatedAt)}</span>
                      </div>
                      <ProjectRowActions project={p} />
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <div className={s.footer}>
            <span>
              Showing {filtered.length === 0 ? 0 : (page - 1) * size + 1}–{Math.min(page * size, filtered.length)} of {filtered.length}
            </span>
            <div className={s.pager}>
              {page > 1 ? (
                <Link href={href(params, { page: String(page - 1) })} aria-label="Previous page">
                  <ChevronLeft size={18} />
                </Link>
              ) : (
                <span aria-disabled="true">
                  <ChevronLeft size={18} />
                </span>
              )}
              {Array.from({ length: pages }, (_, n) => n + 1).map((n) => (
                <Link key={n} href={href(params, { page: String(n) })} aria-current={n === page ? 'page' : undefined}>
                  {n}
                </Link>
              ))}
              {page < pages ? (
                <Link href={href(params, { page: String(page + 1) })} aria-label="Next page">
                  <ChevronRight size={18} />
                </Link>
              ) : (
                <span aria-disabled="true">
                  <ChevronRight size={18} />
                </span>
              )}
              <form>
                {Object.entries(params)
                  .filter(([k, v]) => k !== 'size' && k !== 'page' && v)
                  .map(([k, v]) => (
                    <input key={k} type="hidden" name={k} value={v} />
                  ))}
                <AutoSubmitSelect name="size" defaultValue={String(size)} aria-label="Projects per page" style={{ width: 140 }}>
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n} per page
                    </option>
                  ))}
                </AutoSubmitSelect>
                <button type="submit" className="visually-hidden">
                  Apply page size
                </button>
              </form>
            </div>
          </div>

          <DismissibleBanner id="learn-projects">
            <IconCircle tone="blue" size={48}>
              <BookOpen size={22} />
            </IconCircle>
            <div>
              <h3>Learn more about projects</h3>
              <p>See how to add a project, run your first SEO audit, and make the most of AmpliVerify.</p>
            </div>
            <ButtonLink href="/help?q=project" variant="outline">
              View Help Center
            </ButtonLink>
          </DismissibleBanner>
        </>
      )}
    </>
  );
}
