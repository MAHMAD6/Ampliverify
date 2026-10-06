import Link from 'next/link';
import { ArrowRight, CalendarDays, ChevronRight, FilePlus2, FileText, Folder, Lightbulb, Search, BarChart3 } from 'lucide-react';
import { ButtonLink, PageHeader } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { getAppContext } from '@/lib/project';
import s from './content.module.css';

export type ContentTab = 'ideas' | 'clusters' | 'plan' | 'briefs' | 'optimized';

/**
 * Tabs from the Content Strategy design, mapped onto the navigation page map:
 * Opportunities = Topic Ideas (/content/ideas, `content_ideas`), Drafts =
 * Content Briefs (/content/briefs, `content_briefs`), Content Plan
 * (/content/plan, `content_plans`). Topic Clusters and Optimized Content are
 * design tabs the page map does not list.
 */
const TABS: { key: ContentTab; label: string; href: string; empty: { title: string; text: string } }[] = [
  {
    key: 'ideas',
    label: 'Opportunities',
    href: '/app/content/ideas',
    empty: { title: 'No content recommendations yet', text: 'Run an SEO audit for this project to generate topic opportunities, clusters, and content recommendations.' },
  },
  {
    key: 'clusters',
    label: 'Topic Clusters',
    href: '/app/content/clusters',
    empty: { title: 'No topic clusters yet', text: 'Clusters group related topics into structured content groups once opportunities have been generated.' },
  },
  {
    key: 'plan',
    label: 'Content Plan',
    href: '/app/content/plan',
    empty: { title: 'No content plan yet', text: 'Add opportunities to a plan to build and prioritize your content roadmap.' },
  },
  {
    key: 'briefs',
    label: 'Drafts',
    href: '/app/content/briefs',
    empty: { title: 'No drafts yet', text: 'Content briefs and drafts you create from opportunities will appear here.' },
  },
  {
    key: 'optimized',
    label: 'Optimized Content',
    href: '/app/content/optimized',
    empty: { title: 'No optimized content yet', text: 'Content you improve with AI recommendations will be tracked here with its progress.' },
  },
];

const FEATURES = [
  { title: 'Topic Opportunities', text: 'Find high-impact topics and content opportunities for your site.', href: '/app/content/ideas', icon: <Search size={30} />, tone: 'blue' },
  { title: 'Topic Clusters', text: 'Organize related topics into structured content groups.', href: '/app/content/clusters', icon: <FileText size={30} />, tone: 'green' },
  { title: 'Content Plan', text: 'Build and prioritize your content roadmap.', href: '/app/content/plan', icon: <CalendarDays size={30} />, tone: 'amber' },
  { title: 'Optimize Content', text: 'Use AI recommendations to improve existing content and track progress.', href: '/app/content/optimized', icon: <BarChart3 size={30} />, tone: 'purple' },
];

const NEXT = ['Run an SEO audit for this project', 'We analyze your site and competitors', 'Get content opportunities, clusters, and a plan', 'Create, optimize, and track progress'];

/**
 * Content Strategy (chat design 2026-10-06; states from user-app-batch2a/06).
 * The content API is not built, so with a project selected every tab shows its
 * empty state; generation (credit-using) is never simulated.
 */
export async function ContentStrategy({ tab }: { tab: ContentTab }) {
  const { selectedProject } = await getAppContext();
  const current = TABS.find((t) => t.key === tab)!;

  return (
    <>
      <PageHeader title="Content Strategy" description="Get AI-powered content recommendations to improve your SEO and AI search visibility." />

      <nav className={s.tabs} aria-label="Content Strategy">
        {TABS.map((t) => (
          <Link key={t.key} href={t.href} className={`${s.tab} ${t.key === tab ? s.tabActive : ''}`} aria-current={t.key === tab ? 'page' : undefined}>
            {t.label}
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

      <section className={s.body}>
        {selectedProject ? (
          <StateView
            kind="empty"
            icon={<FilePlus2 size={44} />}
            title={current.empty.title}
            description={current.empty.text}
            action={
              <ButtonLink href="/app/audit" icon={<Search size={18} />} size="lg">
                Run SEO Audit
              </ButtonLink>
            }
          />
        ) : (
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
        )}
      </section>

      <section className={s.next}>
        <span className={s.nextIcon}>
          <Lightbulb size={22} />
        </span>
        <div className={s.nextBody}>
          <div className={s.nextHead}>
            <h2>What happens next?</h2>
            <Link href="/help" className={s.learn}>
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
    </>
  );
}
