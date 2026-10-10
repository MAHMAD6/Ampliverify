import Link from 'next/link';
import { AlertTriangle, ArrowRight, ChevronRight, Cloud, CreditCard, Database, FileText, HardDrive, Layers, Mail, Plus, Server, Settings, Users, Activity } from 'lucide-react';
import { ButtonLink, PageHeader } from '@/components/ui';
import { adminGet, dateTime, loadUsers } from '@/lib/admin-data';
import { loadAudit } from '@/lib/audit';
import s from '@/components/admin/command.module.css';

export const metadata = { title: 'Command Center' };

type Counts = { draft: number; published: number; archived: number };
type Health = {
  database: { status: 'UP' | 'DOWN'; latencyMs: number };
  checks: { componentKey: string; status: 'HEALTHY' | 'DEGRADED' | 'DOWN' }[];
  incidents: { status: string }[];
  deadJobs: unknown[];
  webhooksFailed: number;
  providers: { key: string; configured: boolean }[];
};

/**
 * Command Center (chat design 2026-10-06): users, content, active
 * subscriptions, open alerts (incidents, dead jobs, failed webhooks),
 * component status and recent administrative activity.
 */
export default async function CommandCenterPage() {
  const [users, overview, subs, health, audit] = await Promise.all([
    loadUsers(),
    adminGet<{ blog: Counts; guides: Counts; help: Counts; caseStudies: Counts; jobs: Record<string, number> }>('/admin/content/overview'),
    adminGet<{ status: string }[]>('/admin/subscriptions'),
    adminGet<Health>('/admin/health'),
    loadAudit(),
  ]);
  const sum = (c: Counts) => c.draft + c.published + c.archived;
  const content = overview ? sum(overview.blog) + sum(overview.guides) + sum(overview.help) + sum(overview.caseStudies) + Object.values(overview.jobs).reduce((n, v) => n + v, 0) : null;
  const activeSubs = subs ? subs.filter((x) => ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(x.status)).length : null;
  const alerts = health ? health.incidents.filter((i) => i.status !== 'RESOLVED').length + health.deadJobs.length + (health.webhooksFailed > 0 ? 1 : 0) + (health.database.status === 'DOWN' ? 1 : 0) : null;
  const check = (key: string) => health?.checks.find((c) => c.componentKey === key)?.status;
  const provider = (key: string) => health?.providers.find((x) => x.key === key)?.configured;
  const label = (v: string | boolean | undefined) => (v === undefined ? '—' : v === true || v === 'HEALTHY' || v === 'UP' ? 'Operational' : v === false ? 'Not configured' : v === 'DEGRADED' ? 'Degraded' : 'Down');
  const metrics = [
    { label: 'Total Users', value: users?.length, note: users ? null : 'No users loaded.', icon: <Users size={28} />, tone: 'green' },
    { label: 'Content Items', value: content, note: content === null ? 'No content loaded.' : 'All content types', icon: <FileText size={28} />, tone: 'blue' },
    { label: 'Active Subscriptions', value: activeSubs, note: activeSubs === null ? 'Billing data unavailable.' : 'Active, trialing or past due', icon: <Layers size={28} />, tone: 'purple' },
    { label: 'Open Alerts', value: alerts, note: alerts === null ? 'Health data unavailable.' : 'Incidents, dead jobs, failed webhooks', icon: <AlertTriangle size={28} />, tone: 'red' },
  ];
  const actions = [
    { title: 'Manage Users', text: 'View and manage all users, admins, and permissions.', href: '/admin/users', icon: <Users size={26} />, tone: 'green' },
    { title: 'Manage Content', text: 'Create and manage blog posts, resources, and career listings.', href: '/admin/content', icon: <FileText size={26} />, tone: 'blue' },
    { title: 'Manage Billing', text: 'View subscriptions, invoices, and credits.', href: '/admin/subscriptions', icon: <Layers size={26} />, tone: 'purple' },
    { title: 'System Operations', text: 'Configure modules, feature flags, and system settings.', href: '/admin/modules', icon: <Settings size={26} />, tone: 'green' },
  ];
  const status = [
    { label: 'Platform', icon: <Server size={20} />, value: label(health ? (alerts ? 'DEGRADED' : 'HEALTHY') : undefined) },
    { label: 'Background Jobs', icon: <Cloud size={20} />, value: label(check('job_queue')) },
    { label: 'Database', icon: <Database size={20} />, value: label(health?.database.status) },
    { label: 'File Storage', icon: <HardDrive size={20} />, value: label(provider('storage')) },
    { label: 'Email Services', icon: <Mail size={20} />, value: label(provider('email')) },
  ];
  const recent = audit.records.slice(0, 6);
  return (
    <>
      <PageHeader title="Command Center" description="Manage users, content, billing, and system operations for AmpliVerify." />
      <div className={s.metrics}>
        {metrics.map((m) => (
          <div key={m.label} className={s.metric}>
            <span className={s.icon} data-tone={m.tone}>
              {m.icon}
            </span>
            <span>
              <b>{m.label}</b>
              <strong>{m.value ?? '—'}</strong>
              {m.note && <small>{m.note}</small>}
            </span>
          </div>
        ))}
      </div>
      <div className={s.grid}>
        <div className={s.col}>
          <section className={s.card}>
            <header className={s.head}>
              <div>
                <h2>Quick Actions</h2>
                <p>Common administrative tasks to keep AmpliVerify running smoothly.</p>
              </div>
              <ButtonLink href="/admin/users" variant="green" icon={<Plus size={16} />}>
                Add User
              </ButtonLink>
            </header>
            <div className={s.actions}>
              {actions.map((a) => (
                <Link key={a.title} href={a.href} className={s.action} data-tone={a.tone}>
                  <span className={s.icon} data-tone={a.tone}>
                    {a.icon}
                  </span>
                  <b>{a.title}</b>
                  <small>{a.text}</small>
                  <span className={s.go}>
                    <ArrowRight size={18} />
                  </span>
                </Link>
              ))}
            </div>
          </section>
          <section className={s.card}>
            <header className={s.head}>
              <div>
                <h2>Recent Administrative Activity</h2>
                <p>Latest actions across users, content, billing, and system operations.</p>
              </div>
              <ButtonLink href="/admin/activity" variant="outline">
                View All Activity <ArrowRight size={16} />
              </ButtonLink>
            </header>
            {recent.length === 0 ? (
              <div className={s.empty}>
                <FileText size={40} />
                <b>No activity yet</b>
                <small>Administrative activity will appear here once actions are taken.</small>
              </div>
            ) : (
              <ul className={s.activity}>
                {recent.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/audit-logs/${r.id}`}>
                      <code>{r.eventType}</code>
                      <span>{r.actorUserId ? audit.actors.get(r.actorUserId) ?? 'User' : 'System'}</span>
                      <small>{dateTime(r.createdAt)}</small>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <div className={s.col}>
          <section className={s.card}>
            <h2>System Status</h2>
            <p className={s.sub}>Overview of key system components.</p>
            <ul className={s.status}>
              {status.map((x) => (
                <li key={x.label}>
                  {x.icon}
                  <span>{x.label}</span>
                  <b>{x.value}</b>
                </li>
              ))}
            </ul>
          </section>
          <section className={s.card}>
            <h2>Quick Navigation</h2>
            <p className={s.sub}>Jump to key areas of the Super Admin.</p>
            <ul className={s.nav}>
              {[
                ['All Users', '/admin/users', <Users key="u" size={20} />],
                ['Content Overview', '/admin/content', <FileText key="c" size={20} />],
                ['Plans & Pricing', '/admin/plans', <CreditCard key="p" size={20} />],
                ['System Health', '/admin/health', <Activity key="h" size={20} />],
              ].map(([l, h, i]) => (
                <li key={l as string}>
                  <Link href={h as string}>
                    {i}
                    <span>{l}</span>
                    <ChevronRight size={18} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
