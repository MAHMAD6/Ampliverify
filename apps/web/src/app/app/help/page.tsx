import Link from 'next/link';
import { CircleHelp, Search } from 'lucide-react';
import { Button, ButtonLink, EmptyState, Field, Grid, Input, KeyValue, Notice, PageHeader, Panel, Select, Textarea } from '@/components/ui';

export const metadata = { title: 'Help & Support' };

const SHORTCUTS = [
  ['Getting Started', 'getting started'],
  ['SEO Audits', 'audit'],
  ['Reports', 'report'],
  ['Billing & Credits', 'billing'],
];

/** Support-ticket storage does not exist yet, so requests cannot be submitted or listed. */
export default function HelpSupportPage() {
  return (
    <>
      <PageHeader title="Help & Support" description="Find product guidance or contact support when you need assistance." crumbs={[{ label: 'Help & Support' }]} />
      <Grid cols={2}>
        <Panel title="Find an Answer" description="Search product guidance before opening a support request." flushHead>
          <form action="/help">
            <Field label="Search help" htmlFor="help-q">
              <Input id="help-q" name="q" icon={<Search size={18} />} placeholder="Search audits, projects, reports, billing, GEO, editor, or settings..." />
            </Field>
          </form>
          <Grid cols={2}>
            {SHORTCUTS.map(([label, q]) => (
              <ButtonLink key={label} href={`/help?q=${encodeURIComponent(q)}`} variant="secondary" block>
                {label}
              </ButtonLink>
            ))}
          </Grid>
        </Panel>
        <Panel title="Contact Support" description="Send a request when documentation does not resolve the issue." flushHead>
          <Field label="Topic" htmlFor="s-topic">
            <Select id="s-topic" defaultValue="" disabled>
              <option value="">Select topic</option>
            </Select>
          </Field>
          <Field label="Subject" htmlFor="s-subject">
            <Input id="s-subject" placeholder="Describe the issue briefly" disabled />
          </Field>
          <Field label="Message" htmlFor="s-message">
            <Textarea id="s-message" placeholder="Explain what happened, what you expected, and any relevant project or page." disabled />
          </Field>
          <Button disabled>Submit Support Request</Button>
          <div style={{ marginTop: 12 }}>
            <Notice tone="neutral">Support requests can’t be submitted from the app yet. Please use the Help Center in the meantime.</Notice>
          </div>
        </Panel>
        <Panel title="Useful Links" flushHead>
          <KeyValue label="Documentation" value={<Link href="/help" style={{ color: 'var(--blue)' }}>Open Help Center</Link>} />
          <KeyValue label="Account & Billing" value={<Link href="/app/billing" style={{ color: 'var(--blue)' }}>Open Billing & Plan</Link>} />
          <KeyValue label="Privacy" value={<Link href="/legal/privacy" style={{ color: 'var(--blue)' }}>Open privacy information</Link>} />
        </Panel>
        <Panel title="Your Requests" description="Requests you submit will be listed here." flushHead>
          <EmptyState compact icon={<CircleHelp size={22} />} title="No support requests yet" description="Submitted requests and their status will appear here." />
        </Panel>
      </Grid>
    </>
  );
}
