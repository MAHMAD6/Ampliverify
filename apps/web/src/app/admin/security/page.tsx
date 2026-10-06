import Link from 'next/link';
import { Ban, Download, Info, Laptop, MonitorSmartphone, RotateCw, Search, UserPlus, Users } from 'lucide-react';
import { Button, EmptyState, Input, KeyValue, Panel, Select } from '@/components/ui';
import { AdminHeader } from '@/components/admin/AdminParts';
import { OffToggle } from '@/components/admin/AdminSettings';
import s from '@/components/admin/settings.module.css';
import a from '@/components/admin/audit.module.css';
import u from '@/components/ui/ui.module.css';

export const metadata = { title: 'Security & Access' };

const TABS = [
  { key: 'sessions', label: 'Active Sessions', columns: ['User Name', 'User Type', 'Device', 'Session Start', 'Last Activity', 'Status', 'Actions'], icon: <Laptop size={28} />, empty: 'No active session data yet', text: 'Active sessions will appear here when session data is available.' },
  { key: 'devices', label: 'Devices', columns: ['User Name', 'Device', 'Browser / OS', 'First Seen', 'Last Seen', 'Status', 'Actions'], icon: <MonitorSmartphone size={28} />, empty: 'No device data yet', text: 'Recognized devices will appear here when device data is available.' },
  { key: 'invitations', label: 'Invitations', columns: ['Email', 'Role', 'Invited By', 'Sent', 'Expires', 'Status', 'Actions'], icon: <UserPlus size={28} />, empty: 'No invitations yet', text: 'Pending and past invitations will appear here once invitations are available.' },
  { key: 'suspended', label: 'Suspended Access', columns: ['User Name', 'User Type', 'Reason', 'Suspended By', 'Suspended At', 'Status', 'Actions'], icon: <Ban size={28} />, empty: 'No suspended access', text: 'Restriction records include reason, actor, time, and current status.' },
  { key: 'controls', label: 'Security Controls' },
] as const;

/**
 * Security & Access (chat design 2026-10-06; Security Controls tab from
 * admin-final-batch1/02). Sessions (`auth_sessions`), devices, invitations and
 * suspensions have no admin API yet, so tables are empty and actions disabled.
 */
export default async function SecurityAccessPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const requested = (await searchParams).tab;
  const tab = TABS.find((t) => t.key === requested) ?? TABS[0];
  const metrics = [
    { label: 'Active Sessions', icon: <Users size={26} />, tone: 'blue' },
    { label: 'Active Devices', icon: <Laptop size={26} />, tone: 'green' },
    { label: 'Pending Invitations', icon: <UserPlus size={26} />, tone: 'purple' },
    { label: 'Suspended Access', icon: <Ban size={26} />, tone: 'red' },
  ];
  return (
    <>
      <div className={s.head}>
        <AdminHeader
          section="System Operations"
          title="Security & Access"
          description="Monitor and manage access to the platform: active sessions, devices, invitations, and suspended access."
        />
        <aside className={s.about}>
          <Info size={22} />
          <div>
            <b>About Security &amp; Access</b>
            <p>An overview of platform access and security-related information. Data appears only when recorded by the backend.</p>
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
              <b style={{ display: 'block', fontSize: 22, color: 'var(--ink)' }}>—</b>
              <small style={{ color: 'var(--muted)' }}>No data available yet</small>
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
        {'columns' in tab ? (
          <>
            <div className={a.filters}>
              <Input icon={<Search size={16} />} placeholder="Search by user name, device, or session ID..." aria-label="Search" disabled />
              <Select aria-label="User type" disabled>
                <option>All Users</option>
              </Select>
              <Select aria-label="Status" disabled>
                <option>All Statuses</option>
              </Select>
              <Select aria-label="Date range" disabled>
                <option>Last 30 days</option>
              </Select>
              <Button variant="secondary" disabled icon={<Download size={16} />}>
                Export
              </Button>
              <Button variant="secondary" disabled aria-label="Refresh">
                <RotateCw size={16} />
              </Button>
            </div>
            <div className={a.tableWrap}>
              <table className={a.table}>
                <thead>
                  <tr>
                    {tab.columns.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
              </table>
            </div>
            <EmptyState icon={tab.icon} title={tab.empty} description={tab.text} />
          </>
        ) : (
          <div className={a.split} style={{ padding: 16, marginTop: 0 }}>
            <Panel title="Administrator Access Policy" description="Baseline administrative access controls." flushHead>
              <KeyValue label="Require MFA for administrators" value={<OffToggle label="Require MFA for administrators" />} />
              <KeyValue label="Allow passkeys" value={<OffToggle label="Allow passkeys" />} />
              <KeyValue label="Session expiration" value="Not configured" />
              <KeyValue label="Reauthentication for sensitive actions" value={<OffToggle label="Reauthentication for sensitive actions" />} />
            </Panel>
            <Panel title="Session & Device Controls" description="Administrator sessions from backend session records." flushHead>
              <KeyValue label="Current sessions" value="Not available yet" />
              <KeyValue label="Recognized devices" value="Not available yet" />
              <KeyValue label="Revoked sessions" value="Not available yet" />
              <KeyValue label="Last security review" value="Not available yet" />
              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12 }}>
                Platform-wide defaults live in <Link href="/admin/settings/security" style={{ color: 'var(--blue)' }}>Settings → Security</Link>.
              </p>
            </Panel>
          </div>
        )}
        <p className={s.footer} style={{ margin: 16 }}>
          <Info size={18} /> Security and access data is shown when available. Location information (if captured) appears in the session detail view.
        </p>
      </Panel>
    </>
  );
}
