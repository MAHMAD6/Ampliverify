import Link from 'next/link';
import { ArrowRight, Clock3, Layers, ListChecks, User, UserCircle2 } from 'lucide-react';
import { Button } from '../ui';
import { AdminHeader } from './AdminParts';
import { date, scopeLabel, type AdminAssignment, type AdminUser } from '@/lib/admin-data';
import type { AuditRecord } from '@/lib/audit';
import s from './detail.module.css';

/** Admin / Sub-Admin Detail (chat design 2026-10-06). All values from the user, assignment and audit APIs; "—" when absent. */
export function AdminDetail({ user, assignments, activity }: { user: AdminUser | null; assignments: AdminAssignment[]; activity: AuditRecord[] }) {
  const roles = [...new Set(assignments.map((a) => a.role.name))].join(', ') || '—';
  const scopes = [...new Set(assignments.map(scopeLabel))].join(', ') || '—';
  const f = (v?: string | null) => v || '—';
  return (
    <>
      <AdminHeader
        section="User Management"
        parent={{ label: 'Sub-Admins', href: '/admin/sub-admins' }}
        page="Admin / Sub-Admin Detail"
        title="Admin / Sub-Admin Detail"
        description="View and manage admin or sub-admin information, roles, permissions, and access assignments."
        actions={
          <Button variant="outline" disabled>
            Actions
          </Button>
        }
      />
      <section className={s.profile}>
        <span className={s.avatar}>
          <UserCircle2 size={56} />
        </span>
        <dl>
          {[
            ['Name', f(user?.displayName)],
            ['Email', f(user?.email)],
            ['Role', roles],
            ['Access Scope', scopes],
            ['Status', user ? user.status.charAt(0) + user.status.slice(1).toLowerCase() : '—'],
            ['Last Active', '—'],
            ['Date Created', user ? date(user.createdAt) : '—'],
            ['Last Updated', user ? date(user.updatedAt) : '—'],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className={s.body}>
        <nav className={s.side}>
          <a href="#overview" className={s.on}>
            <ListChecks size={18} /> Overview
          </a>
          <a href="#roles">
            <User size={18} /> Roles &amp; Permissions
          </a>
          <a href="#access">
            <Layers size={18} /> Access Assignments
          </a>
          <a href="#activity">
            <Clock3 size={18} /> Activity
          </a>
        </nav>
        <div className={s.main}>
          <section id="overview" className={s.card}>
            <h2>Overview</h2>
            <p>Basic information and settings for this admin or sub-admin account.</p>
          </section>
          <div className={s.two}>
            <section id="roles" className={s.card}>
              <h3>
                <User size={18} /> Role &amp; Permissions
              </h3>
              <dl className={s.mini}>
                <div>
                  <dt>Role</dt>
                  <dd>{roles}</dd>
                </div>
                <div>
                  <dt>Permissions</dt>
                  <dd>{assignments.length ? 'Defined by role' : '—'}</dd>
                </div>
              </dl>
              <Link href="/admin/roles" className={s.link}>
                View Role &amp; Permissions <ArrowRight size={16} />
              </Link>
            </section>
            <section id="access" className={s.card}>
              <h3>
                <Layers size={18} /> Access Assignments
              </h3>
              <ul className={s.list}>
                {assignments.length === 0 && <li>—</li>}
                {assignments.map((a) => (
                  <li key={a.id}>
                    {a.role.name} · {scopeLabel(a)} · since {date(a.createdAt)}
                  </li>
                ))}
              </ul>
              <Link href="/admin/access" className={s.link}>
                View Access Assignments <ArrowRight size={16} />
              </Link>
            </section>
          </div>
          <section id="activity" className={s.card}>
            <h3>
              <Clock3 size={18} /> Recent Activity
            </h3>
            {activity.length === 0 ? (
              <p className={s.empty}>No activity yet. Activity will appear here once available.</p>
            ) : (
              <ul className={s.list}>
                {activity.slice(0, 10).map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/activity/${r.id}`}>
                      <code>{r.eventType}</code> · {r.targetType} · {date(r.createdAt)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
