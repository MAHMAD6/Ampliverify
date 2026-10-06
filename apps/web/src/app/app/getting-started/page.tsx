import Link from 'next/link';
import { ButtonLink, Grid, KeyValue, PageHeader, Panel } from '@/components/ui';
import { getAppContext } from '@/lib/project';
import p from '@/components/app/pages.module.css';

export const metadata = { title: 'Getting Started' };

const STEPS = [
  { title: 'Add your first project', text: 'Enter the domain and required project details.', href: '/app/projects/new', cta: 'Add Project' },
  { title: 'Add or verify a page URL', text: 'Select the page you want to evaluate and optimize.' },
  { title: 'Run an On-Page SEO Audit', text: 'Use the audit workflow to identify page-level issues and opportunities.' },
  { title: 'Review recommendations', text: 'Open the Optimization Center and prioritize useful actions.' },
  { title: 'Optimize in the SEO Editor', text: 'Apply approved changes with the page editor and AI-assisted tools where available.' },
  { title: 'Generate a report', text: 'Create, review, and optionally share or schedule a report.' },
];

/** Dismissible onboarding. Progress is derived from real data only (projects today). */
export default async function GettingStartedPage() {
  const { signedIn, projects } = await getAppContext();
  const projectCreated = projects.length > 0;
  const status = (done: boolean) => (signedIn ? (done ? 'Done' : 'Not yet') : '—');
  return (
    <>
      <PageHeader
        title="Getting Started"
        description="Complete AmpliVerify’s core SEO workflow at your own pace."
        crumbs={[{ label: 'Dashboard', href: '/app' }, { label: 'Getting Started' }]}
      />
      <Grid cols={2}>
        <Panel title="Get Started with AmpliVerify" description="Complete the core workflow at your own pace." flushHead>
          {STEPS.map((step, i) => (
            <div key={step.title} className={p.stepRow}>
              <span className={p.stepBadge}>{i === 0 && projectCreated ? '✓' : i + 1}</span>
              <div>
                <h4>{step.title}</h4>
                <p>{step.text}</p>
                {step.href && !(i === 0 && projectCreated) && (
                  <div style={{ marginTop: 8 }}>
                    <ButtonLink href={step.href} variant="secondary" size="sm">
                      {step.cta}
                    </ButtonLink>
                  </div>
                )}
              </div>
            </div>
          ))}
        </Panel>
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <Panel title="Your Progress" description="Based on actions you have completed." flushHead>
            <KeyValue label="Setup progress" value={signedIn ? `${projectCreated ? 1 : 0} of ${STEPS.length} steps` : '—'} />
            <KeyValue label="Project created" value={status(projectCreated)} />
            <KeyValue label="First audit" value={status(false)} />
            <KeyValue label="First optimization" value={status(false)} />
            <KeyValue label="First report" value={status(false)} />
          </Panel>
          <Panel title="Need Help?" description="Guides and support for each step." flushHead>
            <KeyValue label="Product guide" value={<Link href="/guides" style={{ color: 'var(--blue)' }}>Open Getting Started guides</Link>} />
            <KeyValue label="Support" value={<Link href="/app/help" style={{ color: 'var(--blue)' }}>Open Help & Support</Link>} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <ButtonLink href="/app" variant="secondary">
                Dismiss for Now
              </ButtonLink>
              <ButtonLink href={projectCreated ? '/app/audit' : '/app/projects/new'}>Continue Setup</ButtonLink>
            </div>
          </Panel>
        </div>
      </Grid>
    </>
  );
}
