import Link from 'next/link';
import { Ban, Info, Laptop, MonitorSmartphone, Search, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { EmptyState, Input, KeyValue, Panel } from '@/components/ui';
import { AdminHeader } from '@/components/admin/AdminParts';
import { StatusPill } from '@/components/admin/AdminList';
import { ReasonAction } from '@/components/admin/ReasonAction';
import { loadSettings } from '@/components/admin/AdminSettings';
import { adminGet, dateTime, loadUsers, matchesQ } from '@/lib/admin-data';
import { describeAgent, listSessions, loadAdminMe, type SessionRow } from '@/lib/auth-sessions';
import s from '@/components/admin/settings.module.css';
import a from '@/components/admin/audit.module.css';
import u from '@/components/ui/ui.module.css';

export const metadata = { title: 'Security & Access' };

const TABS = [
  { key: 'sessions', label: 'Active Sessions' },
  { key: 'devices', label: 'Devices' },
  { key: 'invitations', label: 'Invitations' },
  { key: 'suspended', label: 'Suspended Access' },
  { key: 'controls', label: 'Security Controls' },
] as const;

type Invitation = { id: string; email: string; roleKey: string; status: string; expiresAt: string; acceptedAt: string | null; createdAt: string; workspace: { id: string; name: string }; inviter: { email: string; displayName: string | null } };
type Suspension = { id: string; email: string; displayName: string | null; reason: string | null; suspendedAt: string; suspendedBy: string | null };

function Table({ columns, rows, empty }: { columns: string[]; rows: React.ReactNode[][]; empty: React.ReactNode }) {
  return (
    <>
      <div className={a.tableWrap}>
        <table className={a.table}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          {rows.length > 0 && (
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
      {rows.length === 0 && empty}
    </>
  );
}

/**
 * Security & Access (chat design 2026-10-06; Security Controls tab from
 * admin-final-batch1/02). Sessions and devices come from the auth server's
 * session records; invitations and suspensions from the API. Revoking and
 * suspending need a reason and are audited by the API before taking effect.
 */
export default async function SecurityAccessPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab: requested, q } = await searchParams;
  const tab = TABS.find((t) => t.key === requested) ?? TABS[0];
  const me = await loadAdminMe();
  const canRead = !!me?.permissions.includes('user.read');
  const canManage = !!me?.permissions.includes('user.manage');
  const [active, recent, users, invitations, suspensions, settings] = canRead
    ? await Promise.all([listSessions(), listSessions({ activeOnly: false, sinceDays: 90 }), loadUsers(), adminGet<Invitation[]>('/admin/invitations'), adminGet<Suspension[]>('/admin/suspensions'), loadSettings()])
    : [[] as SessionRow[], [] as SessionRow[], null, null, null, null];
  const apiUser = (email: string) => users?.find((x) => x.email.toLowerCase() === email.toLowerCase());
  const devices = [...recent.reduce((m, r) => {
    const key = `${r.userId}|${describeAgent(r.userAgent)}`;
    const d = m.get(key) ?? { email: r.email, name: r.name, device: describeAgent(r.userAgent), firstSeen: r.createdAt, lastSeen: r.updatedAt, active: false, sessions: 0 };
    d.firstSeen = r.createdAt < d.firstSeen ? r.createdAt : d.firstSeen;
    d.lastSeen = r.updatedAt > d.lastSeen ? r.updatedAt : d.lastSeen;
    d.active ||= r.expiresAt > new Date();
    d.sessions++;
    m.set(key, d);
    return m;
  }, new Map<string, { email: string; name: string | null; device: string; firstSeen: Date; lastSeen: Date; active: boolean; sessions: number }>()).values()];
  const sec = settings?.value<{ requireAdminMfa?: boolean; allowPasskeys?: boolean; invitationExpiryDays?: number }>('platform.security', {}) ?? {};
  const metrics = [
    { label: 'Active Sessions', icon: <Users size={26} />, tone: 'blue', value: canRead ? active.length : null },
    { label: 'Active Devices', icon: <Laptop size={26} />, tone: 'green', value: canRead ? devices.filter((d) => d.active).length : null },
    { label: 'Pending Invitations', icon: <UserPlus size={26} />, tone: 'purple', value: invitations ? invitations.filter((i) => i.status === 'PENDING' && new Date(i.expiresAt) > new Date()).length : null },
    { label: 'Suspended Access', icon: <Ban size={26} />, tone: 'red', value: suspensions ? suspensions.length : null },
  ];
  const search = (
    <form className={a.filters} role="search">
      <input type="hidden" name="tab" value={tab.key} />
      <Input name="q" defaultValue={q} icon={<Search size={16} />} placeholder="Search by name, email or device..." aria-label="Search" />
    </form>
  );

  return (
    <>
      <div className={s.head}>
        <AdminHeader section="System Operations" title="Security & Access" description="Monitor and manage access to the platform: active sessions, devices, invitations, and suspended access." />
        <aside className={s.about}>
          <Info size={22} />
          <div>
            <b>About Security &amp; Access</b>
            <p>Sign-in sessions come from the authentication server. Revoking a session signs that browser out immediately; suspending a user also signs them out everywhere.</p>
          </div>
        </aside>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, margin: '4px 0 16px' }}>
        {metrics.map((m) => (
          <div key={m.label} className={s.card} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span className={s.icon} data-tone={m.tone}>
              {m.icon}
            </span>
            <span>
              <small style={{ color: 'var(--blue-600)', fontSize: 14 }}>{m.label}</small>
              <b style={{ display: 'block', fontSize: 22, color: 'var(--ink)' }}>{m.value ?? '—'}</b>
            </span>
          </div>
        ))}
      </div>
      <Panel bodyless>
        <nav className={u.tabs} aria-label="Security & Access" style={{ margin: 0, padding: '0 12px' }}>
          {TABS.map((t) => (
            <Link key={t.key} href={t.key === 'sessions' ? '/admin/security' : `/admin/security?tab=${t.key}`} className={`${u.tab} ${t.key === tab.key ? u.tabActive : ''}`} aria-current={t.key === tab.key ? 'page' : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>
        {!canRead ? (
          <EmptyState icon={<ShieldCheck size={28} />} title="Not available" description="Your administrator role cannot read user access data." />
        ) : tab.key === 'sessions' ? (
          <>
            {search}
            <Table
              columns={['User', 'Device', 'IP Address', 'Signed In', 'Last Activity', 'MFA', 'Actions']}
              rows={active
                .filter((r) => matchesQ(q, r.email, r.name, describeAgent(r.userAgent), r.ipAddress))
                .map((r) => {
                  const target = apiUser(r.email);
                  return [
                    <span key="u">
                      <b>{r.name || r.email}</b>
                      <small style={{ display: 'block', color: 'var(--muted)' }}>{r.email}</small>
                    </span>,
                    describeAgent(r.userAgent),
                    r.ipAddress ?? '—',
                    dateTime(r.createdAt.toISOString()),
                    dateTime(r.updatedAt.toISOString()),
                    r.twoFactorEnabled ? <StatusPill key="m" tone="green">On</StatusPill> : <StatusPill key="m" tone="slate">Off</StatusPill>,
                    canManage && target ? <ReasonAction key="a" userId={target.id} kind={{ type: 'revoke', sessionId: r.id }} label="Revoke" /> : '—',
                  ];
                })}
              empty={<EmptyState icon={<Laptop size={28} />} title="No active sessions" description="Signed-in sessions will appear here." />}
            />
          </>
        ) : tab.key === 'devices' ? (
          <>
            {search}
            <Table
              columns={['User', 'Device', 'Sessions (90 days)', 'First Seen', 'Last Seen', 'Status']}
              rows={devices
                .filter((d) => matchesQ(q, d.email, d.name, d.device))
                .map((d) => [
                  <span key="u">
                    <b>{d.name || d.email}</b>
                    <small style={{ display: 'block', color: 'var(--muted)' }}>{d.email}</small>
                  </span>,
                  d.device,
                  d.sessions,
                  dateTime(d.firstSeen.toISOString()),
                  dateTime(d.lastSeen.toISOString()),
                  <StatusPill key="s" tone={d.active ? 'green' : 'slate'}>
                    {d.active ? 'Signed in' : 'Signed out'}
                  </StatusPill>,
                ])}
              empty={<EmptyState icon={<MonitorSmartphone size={28} />} title="No devices" description="Devices seen in the last 90 days will appear here." />}
            />
          </>
        ) : tab.key === 'invitations' ? (
          <>
            {search}
            <Table
              columns={['Email', 'Workspace', 'Role', 'Invited By', 'Sent', 'Expires', 'Status']}
              rows={(invitations ?? [])
                .filter((i) => matchesQ(q, i.email, i.workspace.name, i.inviter.email))
                .map((i) => {
                  const expired = i.status === 'PENDING' && new Date(i.expiresAt) <= new Date();
                  return [
                    i.email,
                    i.workspace.name,
                    i.roleKey === 'OWNER' ? 'Owner' : 'Member',
                    i.inviter.displayName ?? i.inviter.email,
                    dateTime(i.createdAt),
                    dateTime(i.expiresAt),
                    <StatusPill key="s" tone={expired ? 'slate' : i.status === 'PENDING' ? 'amber' : i.status === 'ACCEPTED' ? 'green' : 'slate'}>
                      {expired ? 'Expired' : i.status.charAt(0) + i.status.slice(1).toLowerCase()}
                    </StatusPill>,
                  ];
                })}
              empty={<EmptyState icon={<UserPlus size={28} />} title="No invitations yet" description="Workspace invitations sent by owners will appear here." />}
            />
          </>
        ) : tab.key === 'suspended' ? (
          <>
            {search}
            <Table
              columns={['User', 'Reason', 'Suspended By', 'Suspended At', 'Actions']}
              rows={(suspensions ?? [])
                .filter((x) => matchesQ(q, x.email, x.displayName, x.reason))
                .map((x) => [
                  <span key="u">
                    <b>{x.displayName || x.email}</b>
                    <small style={{ display: 'block', color: 'var(--muted)' }}>{x.email}</small>
                  </span>,
                  x.reason ?? '—',
                  x.suspendedBy ?? '—',
                  dateTime(x.suspendedAt),
                  canManage ? <ReasonAction key="a" userId={x.id} kind={{ type: 'reactivate' }} label="Reactivate" /> : '—',
                ])}
              empty={<EmptyState icon={<Ban size={28} />} title="No suspended access" description="Suspended users appear here with the reason, actor and time." />}
            />
          </>
        ) : (
          <div className={a.split} style={{ padding: 16, marginTop: 0 }}>
            <Panel title="Administrator Access Policy" description="Current platform security settings." flushHead>
              <KeyValue label="Require MFA for the admin console" value={sec.requireAdminMfa ? 'On' : 'Off'} />
              <KeyValue label="Allow passkeys" value={sec.allowPasskeys === false ? 'Off' : 'On'} />
              <KeyValue label="Invitation expiry" value={`${sec.invitationExpiryDays ?? 7} days`} />
              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12 }}>
                Change these in{' '}
                <Link href="/admin/settings/security" style={{ color: 'var(--blue)' }}>
                  Settings → Security
                </Link>
                .
              </p>
            </Panel>
            <Panel title="Session & Device Overview" description="From the authentication server." flushHead>
              <KeyValue label="Active sessions" value={String(active.length)} />
              <KeyValue label="Users signed in" value={String(new Set(active.map((r) => r.userId)).size)} />
              <KeyValue label="Signed-in users without MFA" value={String(new Set(active.filter((r) => !r.twoFactorEnabled).map((r) => r.userId)).size)} />
              <KeyValue label="Devices (90 days)" value={String(devices.length)} />
            </Panel>
          </div>
        )}
      </Panel>
    </>
  );
}
