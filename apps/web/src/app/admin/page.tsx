import Link from 'next/link';
import { AlertTriangle, ArrowRight, ChevronRight, Cloud, CreditCard, Database, FileText, HardDrive, Layers, Mail, Plus, Server, Settings, Users, Activity } from 'lucide-react';
import { ButtonLink, PageHeader } from '@/components/ui';
import { dateTime, loadUsers } from '@/lib/admin-data';
import { apiGet } from '@/lib/api';
import { loadAudit } from '@/lib/audit';
import type { ContentSummary, JobSummary } from '@/lib/types';
import s from '@/components/admin/command.module.css';

export const metadata = { title: 'Command Center' };

/**
 * Command Center (chat design 2026-10-06). Users, published content and
 * recent activity are live; subscriptions, alerts and component status need
 * the billing and monitoring APIs and read "—".
 */
export default async function CommandCenterPage() {
  const [users, blog, guides, jobs, audit] = await Promise.all([
    loadUsers(),
    apiGet<ContentSummary[]>('/public/blog?limit=50'),
    apiGet<ContentSummary[]>('/public/guides?limit=50'),
    apiGet<JobSummary[]>('/public/careers'),
    loadAudit(),
  ]);
  const content = blog.ok && guides.ok && jobs.ok ? blog.data.length + guides.data.length + jobs.data.length : null;
  const metrics = [
    { label: 'Total Users', value: users?.length, note: users ? null : 'No users loaded.', icon: <Users size={28} />, tone: 'green' },
    { label: 'Content Items', value: content, note: content === null ? 'No content loaded.' : 'Published items', icon: <FileText size={28} />, tone: 'blue' },
    { label: 'Active Subscriptions', value: null, note: 'No subscriptions data yet.', icon: <Layers size={28} />, tone: 'purple' },
    { label: 'Open Alerts', value: null, note: 'No monitoring data yet.', icon: <AlertTriangle size={28} />, tone: 'red' },
  ];
  const actions = [
    { title: 'Manage Users', text: 'View and manage all users, admins, and permissions.', href: '/admin/users', icon: <Users size={26} />, tone: 'green' },
    { title: 'Manage Content', text: 'Create and manage blog posts, resources, and career listings.', href: '/admin/content', icon: <FileText size={26} />, tone: 'blue' },
    { title: 'Manage Billing', text: 'View subscriptions, invoices, and credits.', href: '/admin/subscriptions', icon: <Layers size={26} />, tone: 'purple' },
    { title: 'System Operations', text: 'Configure modules, feature flags, and system settings.', href: '/admin/modules', icon: <Settings size={26} />, tone: 'green' },
  ];
  const status = [
    { label: 'Platform', icon: <Server size={20} /> },
    { label: 'API Services', icon: <Cloud size={20} /> },
    { label: 'Database', icon: <Database size={20} /> },
    { label: 'File Storage', icon: <HardDrive size={20} /> },
    { label: 'Email Services', icon: <Mail size={20} /> },
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
                  <b>—</b>
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
