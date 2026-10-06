'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, FileText, Globe, Info, Layers, Pencil, RotateCcw, Search, Sparkles } from 'lucide-react';
import { createProject, type CreateProjectState } from '@/app/app/projects/new/actions';
import { Button, ButtonLink, Input, Select } from '@/components/ui';
import { PermissionRestricted, StateView } from '@/components/ui/StateView';
import { normalizeHost } from '@/lib/domain';
import s from './wizard.module.css';

type Goal = 'SEO' | 'CONTENT' | 'GEO' | 'ALL';

const STEPS = [
  { title: 'Project Details', text: 'Basic information' },
  { title: 'Website Setup', text: 'Optional integrations' },
  { title: 'Analysis Setup', text: 'Choose what to initialize' },
  { title: 'Review & Create', text: 'Confirm and create' },
];

const GOALS: { key: Goal; label: string; text: string; icon: React.ReactNode; tone: string }[] = [
  { key: 'SEO', label: 'SEO', text: 'Improve search engine visibility', icon: <Search size={22} />, tone: 'blue' },
  { key: 'CONTENT', label: 'Content', text: 'Create and optimize content', icon: <FileText size={22} />, tone: 'green' },
  { key: 'GEO', label: 'GEO', text: 'Track AI search visibility', icon: <Sparkles size={22} />, tone: 'purple' },
  { key: 'ALL', label: 'All', text: 'Set up everything', icon: <Layers size={22} />, tone: 'blue' },
];

const TOOLS = [
  { key: 'audit', label: 'SEO Audit', icon: <Search size={16} />, text: 'Crawl the domain and find on-page issues.' },
  { key: 'content', label: 'Content Strategy', icon: <FileText size={16} />, text: 'Generate topic opportunities from the audit.' },
  { key: 'geo', label: 'AI Search (GEO)', icon: <Sparkles size={16} />, text: 'Track visibility in AI search platforms.' },
];

/**
 * Add Project wizard (chat design 2026-10-06). Steps 1 and 4 are live
 * (`POST /user/projects` with name, domain and primary goal). Integrations
 * (step 2) are connected after creation from Settings → Integrations, and the
 * analysis tools (step 3) cannot be initialized until their services exist,
 * so both steps say so instead of collecting choices that would be ignored.
 */
export function AddProjectWizard({
  workspaces,
  integrations,
  disabled,
}: {
  workspaces: { id: string; name: string }[];
  integrations: { key: string; name: string }[];
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState<CreateProjectState, FormData>(createProject, {});
  const [dismissed, setDismissed] = useState<CreateProjectState | null>(null);
  const [step, setStep] = useState(0);
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? '');
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [goal, setGoal] = useState<Goal | null>(null);

  const host = domain.trim() ? normalizeHost(domain) : null;
  const domainInvalid = domain.trim() !== '' && !host;
  const detailsValid = !!workspaceId && name.trim() !== '' && !!host;
  const failed = state !== dismissed && (state.error || state.forbidden);

  const goTo = (n: number) => setStep(n === 0 || detailsValid ? n : 0);

  let body: React.ReactNode;
  if (pending) body = <StateView kind="processing" compact title="Creating your project…" description="Setting up your project and domain. This may take a few seconds." />;
  else if (failed && state.forbidden) body = <PermissionRestricted action="create projects in this workspace" />;
  else if (failed)
    body = (
      <StateView
        kind="error"
        compact
        title="Failed to create project"
        description={state.error}
        action={
          <Button onClick={() => setDismissed(state)} icon={<RotateCcw size={16} />}>
            Try Again
          </Button>
        }
      />
    );
  else if (step === 0)
    body = (
      <>
        <h2>Project Details</h2>
        <p className={s.lead}>Tell us about your project and what you want to achieve.</p>
        {workspaces.length > 1 && (
          <div className={s.field}>
            <label htmlFor="p-workspace">
              Workspace <span className={s.req}>*</span>
            </label>
            <Select id="p-workspace" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className={s.field}>
          <label htmlFor="p-name">
            Project Name <span className={s.req}>*</span>
          </label>
          <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={160} placeholder="e.g. My Website" disabled={disabled} />
          <small>A clear name to identify this project.</small>
        </div>
        <div className={s.field}>
          <label htmlFor="p-domain">
            Website Domain <span className={s.req}>*</span>
          </label>
          <Input id="p-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" icon={<Globe size={18} />} disabled={disabled} aria-invalid={domainInvalid} aria-describedby="p-domain-hint" />
          <small id="p-domain-hint" className={domainInvalid ? s.invalid : undefined}>
            {domainInvalid ? 'Enter a valid domain, for example example.com.' : 'Enter your domain (without https:// or www). We’ll use this domain for all audits and analysis.'}
          </small>
        </div>
        <fieldset className={s.field}>
          <legend>
            Primary Goal <span className={s.optional}>(Optional)</span>
          </legend>
          <div className={s.goals}>
            {GOALS.map((g) => (
              <label key={g.key} className={`${s.goal} ${goal === g.key ? s.goalOn : ''}`}>
                <input type="radio" name="goal" value={g.key} checked={goal === g.key} onChange={() => setGoal(g.key)} disabled={disabled} />
                <span className={s.goalIcon} data-tone={g.tone}>
                  {g.icon}
                </span>
                <b>{g.label}</b>
                <small>{g.text}</small>
              </label>
            ))}
          </div>
        </fieldset>
      </>
    );
  else if (step === 1)
    body = (
      <>
        <h2>Website Setup</h2>
        <p className={s.lead}>Optional. Connect data sources such as Google Search Console after the project is created.</p>
        <ul className={s.list}>
          {integrations.length === 0 && <li className={s.muted}>No integrations are available yet.</li>}
          {integrations.map((i) => (
            <li key={i.key}>
              <span>{i.name}</span>
              <span className={s.muted}>Connect from Settings → Integrations after creation</span>
            </li>
          ))}
        </ul>
      </>
    );
  else if (step === 2)
    body = (
      <>
        <h2>Analysis Setup</h2>
        <p className={s.lead}>Choose which tools to initialize when the project is created.</p>
        <ul className={s.list}>
          {TOOLS.map((t) => (
            <li key={t.key}>
              <span className={s.tool}>
                {t.icon}
                <span>
                  <b>{t.label}</b>
                  <small>{t.text}</small>
                </span>
              </span>
              <span className={s.muted}>Not available yet</span>
            </li>
          ))}
        </ul>
        <p className={s.note}>
          <Info size={16} /> You can run each tool from its page once it is available for your workspace.
        </p>
      </>
    );
  else
    body = (
      <>
        <h2>Review & Create</h2>
        <p className={s.lead}>Check your project details, then create the project.</p>
        <dl className={s.review}>
          <dt>Project Name</dt>
          <dd>{name.trim()}</dd>
          <dt>Domain</dt>
          <dd>{host}</dd>
          <dt>Primary Goal</dt>
          <dd>{goal ? GOALS.find((g) => g.key === goal)!.label : 'Not selected'}</dd>
          {workspaces.length > 1 && (
            <>
              <dt>Workspace</dt>
              <dd>{workspaces.find((w) => w.id === workspaceId)?.name}</dd>
            </>
          )}
        </dl>
      </>
    );

  const idle = !pending && !failed;
  const last = step === STEPS.length - 1;

  return (
    <>
      <ol className={s.stepper}>
        {STEPS.map((st, i) => (
          <li key={st.title} className={i === step ? s.current : i < step ? s.done : undefined}>
            <button type="button" onClick={() => goTo(i)} disabled={!idle || (i > 0 && !detailsValid)} aria-current={i === step ? 'step' : undefined}>
              <span className={s.num}>{i < step ? <Check size={18} /> : i + 1}</span>
              <span>
                <b>{st.title}</b>
                <small>{st.text}</small>
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className={s.layout}>
        <form action={action} className={s.main}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="name" value={name} />
          <input type="hidden" name="domain" value={domain} />
          <input type="hidden" name="primaryGoal" value={goal ?? ''} />
          <div className={s.body}>{body}</div>
          {idle && (
            <div className={s.footer}>
              {step === 0 ? (
                <ButtonLink href="/app/projects" variant="outline">
                  Cancel
                </ButtonLink>
              ) : (
                <Button type="button" variant="outline" icon={<ArrowLeft size={16} />} onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              )}
              {!detailsValid && <span className={s.hint}>Please complete the required fields to continue.</span>}
              {last ? (
                <Button type="submit" disabled={disabled || !detailsValid}>
                  Create Project
                </Button>
              ) : (
                <Button type="button" disabled={disabled || !detailsValid} onClick={() => setStep(step + 1)}>
                  Next Step <ArrowRight size={16} />
                </Button>
              )}
            </div>
          )}
        </form>

        <aside className={s.summary} aria-label="Project summary">
          <h2>Project Summary</h2>
          <p className={s.lead}>Live preview of your configuration.</p>
          <section>
            <div className={s.sumHead}>
              <span className={s.sumIcon}>
                <CalendarDays size={18} />
              </span>
              <b>Project Information</b>
              <button type="button" className={s.edit} onClick={() => setStep(0)} disabled={!idle}>
                <Pencil size={14} /> Edit
              </button>
            </div>
            <dl className={s.kv}>
              <dt>Project Name</dt>
              <dd>{name.trim() || 'Not set'}</dd>
              <dt>Domain</dt>
              <dd>{host ?? 'Not set'}</dd>
              <dt>Primary Goal</dt>
              <dd>{goal ? GOALS.find((g) => g.key === goal)!.label : 'Not selected'}</dd>
            </dl>
          </section>
          <section>
            <div className={s.sumHead}>
              <span className={s.sumIcon}>
                <Layers size={18} />
              </span>
              <b>Analysis Tools</b>
              <button type="button" className={s.edit} onClick={() => goTo(2)} disabled={!idle || !detailsValid}>
                <Pencil size={14} /> Edit
              </button>
            </div>
            <dl className={s.kv}>
              {TOOLS.map((t) => (
                <div key={t.key} style={{ display: 'contents' }}>
                  <dt className={s.toolName}>
                    {t.icon} {t.label}
                  </dt>
                  <dd>Not enabled</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className={s.next}>
            <b>
              <Info size={18} /> What happens next?
            </b>
            <ol>
              <li>Set up optional integrations (e.g. Google Search Console).</li>
              <li>Choose which tools to initialize.</li>
              <li>Review your configuration.</li>
              <li>Create your project and start the initial setup.</li>
            </ol>
          </section>
          <Link href="/help?q=projects" className={s.help}>
            Learn more about projects
          </Link>
        </aside>
      </div>
    </>
  );
}
