import Link from 'next/link';
import { ButtonLink, Grid, KeyValue, PageHeader, Panel } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { getAppContext } from '@/lib/project';
import p from '@/components/app/pages.module.css';
import { appCrumbs } from '@/lib/nav';

export const metadata = { title: 'Getting Started' };

type Progress = { projects: number; pages: number; audits: number; tasksStarted: number; editorDocuments: number; reports: number };

const STEPS: { title: string; text: string; href: string; cta: string; done: (x: Progress) => boolean }[] = [
  { title: 'Add your first project', text: 'Enter the domain and required project details.', href: '/app/projects/new', cta: 'Add Project', done: (x) => x.projects > 0 },
  { title: 'Add or verify a page URL', text: 'Select the page you want to evaluate and optimize.', href: '/app/audit', cta: 'Choose a Page', done: (x) => x.pages > 0 },
  { title: 'Run an On-Page SEO Audit', text: 'Use the audit workflow to identify page-level issues and opportunities.', href: '/app/audit', cta: 'Run Audit', done: (x) => x.audits > 0 },
  { title: 'Review recommendations', text: 'Open the Optimization Center and start working on a prioritized task.', href: '/app/optimize', cta: 'Open Optimization Center', done: (x) => x.tasksStarted > 0 },
  { title: 'Optimize in the SEO Editor', text: 'Apply approved changes with the page editor and AI-assisted tools where available.', href: '/app/editor', cta: 'Open Editor', done: (x) => x.editorDocuments > 0 },
  { title: 'Generate a report', text: 'Create, review, and optionally share or schedule a report.', href: '/app/reports', cta: 'Create Report', done: (x) => x.reports > 0 },
];

/** Dismissible onboarding. Progress is derived from the user's real data (GET /user/onboarding). */
export default async function GettingStartedPage() {
  const { signedIn } = await getAppContext();
  const res = signedIn ? await apiGet<Progress>('/user/onboarding', { auth: true }) : null;
  const x = res?.ok ? res.data : null;
  const done = x ? STEPS.filter((s) => s.done(x)).length : 0;
  const next = x ? STEPS.find((s) => !s.done(x)) : STEPS[0];
  const status = (ok: boolean | undefined) => (x ? (ok ? 'Done' : 'Not yet') : '—');
  return (
    <>
      <PageHeader title="Getting Started" description="Complete AmpliVerify’s core SEO workflow at your own pace." crumbs={appCrumbs({ label: 'Getting Started' })} />
      <Grid cols={2}>
        <Panel title="Get Started with AmpliVerify" description="Complete the core workflow at your own pace." flushHead>
          {STEPS.map((step, i) => {
            const complete = x ? step.done(x) : false;
            return (
              <div key={step.title} className={p.stepRow}>
                <span className={p.stepBadge}>{complete ? '✓' : i + 1}</span>
                <div>
                  <h4>{step.title}</h4>
                  <p>{step.text}</p>
                  {!complete && (
                    <div style={{ marginTop: 8 }}>
                      <ButtonLink href={step.href} variant="secondary" size="sm">
                        {step.cta}
                      </ButtonLink>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </Panel>
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <Panel title="Your Progress" description="Based on actions you have completed." flushHead>
            <KeyValue label="Setup progress" value={x ? `${done} of ${STEPS.length} steps` : '—'} />
            <KeyValue label="Project created" value={status(x ? x.projects > 0 : undefined)} />
            <KeyValue label="First audit" value={status(x ? x.audits > 0 : undefined)} />
            <KeyValue label="First optimization" value={status(x ? x.tasksStarted > 0 || x.editorDocuments > 0 : undefined)} />
            <KeyValue label="First report" value={status(x ? x.reports > 0 : undefined)} />
          </Panel>
          <Panel title="Need Help?" description="Guides and support for each step." flushHead>
            <KeyValue label="Product guide" value={<Link href="/guides" style={{ color: 'var(--blue)' }}>Open Getting Started guides</Link>} />
            <KeyValue label="Support" value={<Link href="/app/help" style={{ color: 'var(--blue)' }}>Open Help & Support</Link>} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <ButtonLink href="/app/dashboard" variant="secondary">
                Dismiss for Now
              </ButtonLink>
              {next ? <ButtonLink href={next.href}>Continue Setup</ButtonLink> : <ButtonLink href="/app/dashboard">All Done</ButtonLink>}
            </div>
          </Panel>
        </div>
      </Grid>
    </>
  );
}
