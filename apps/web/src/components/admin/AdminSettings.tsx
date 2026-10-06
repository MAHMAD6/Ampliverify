import type { ReactNode } from 'react';
import { Info, Pencil } from 'lucide-react';
import { Button, TabNav } from '../ui';
import { Toggle } from '../ui/Toggle';
import { AdminHeader } from './AdminParts';
import s from './settings.module.css';

export type SettingsTab = 'general' | 'notifications' | 'security' | 'appearance';

export const SETTINGS_TABS: { key: SettingsTab; label: string; href: string }[] = [
  { key: 'general', label: 'General', href: '/admin/settings' },
  { key: 'notifications', label: 'Notifications', href: '/admin/settings/notifications' },
  { key: 'security', label: 'Security', href: '/admin/settings/security' },
  { key: 'appearance', label: 'Appearance', href: '/admin/settings/appearance' },
];

/**
 * Platform Settings (chat designs 2026-10-06; admin-final-batch1/04 and
 * batch2/01-03). There is no platform-settings API yet, so every value reads
 * "—" / Off and Edit stays disabled; nothing pretends to persist.
 */
export function SettingsShell({ tab, about, footer, children }: { tab: SettingsTab; about: { title: string; text: string }; footer: string; children: ReactNode }) {
  return (
    <>
      <div className={s.head}>
        <AdminHeader
          section="Settings"
          page={SETTINGS_TABS.find((t) => t.key === tab)!.label}
          title="Settings"
          description="Manage platform settings and preferences. Use the tabs below to configure general settings, notifications, security, and appearance."
        />
        <aside className={s.about}>
          <Info size={22} />
          <div>
            <b>{about.title}</b>
            <p>{about.text}</p>
          </div>
        </aside>
      </div>
      <TabNav tabs={SETTINGS_TABS} active={tab} />
      <div className={s.grid}>{children}</div>
      <p className={s.footer}>
        <Info size={18} /> {footer}
      </p>
    </>
  );
}

export type Row = { label: string; value?: ReactNode; toggle?: boolean; select?: boolean };

/** A settings card: icon, title, Edit (disabled until the settings API exists) and label/value rows. */
export function SettingsCard({ icon, tone, title, description, rows, wide, children }: { icon: ReactNode; tone: string; title: string; description: string; rows?: Row[]; wide?: boolean; children?: ReactNode }) {
  return (
    <section className={`${s.card} ${wide ? s.wide : ''}`}>
      <header className={s.cardHead}>
        <span className={s.icon} data-tone={tone}>
          {icon}
        </span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <Button variant="outline" size="sm" icon={<Pencil size={14} />} disabled title="Platform settings can’t be edited yet.">
          Edit
        </Button>
      </header>
      {rows && (
        <dl className={s.rows}>
          {rows.map((r) => (
            <div key={r.label}>
              <dt>{r.label}</dt>
              <dd>{r.toggle ? <OffToggle label={r.label} /> : r.select ? <span className={s.select}>{r.value ?? '—'}</span> : (r.value ?? '—')}</dd>
            </div>
          ))}
        </dl>
      )}
      {children}
    </section>
  );
}

export function OffToggle({ label }: { label: string }) {
  return (
    <span className={s.toggle}>
      <Toggle label={label} disabled />
      <span className={s.off}>Off</span>
    </span>
  );
}

/** Event × channel matrix (notifications). All channels Off until configured. */
export function ChannelTable({ events, recipients = true, status = true }: { events: string[]; recipients?: boolean; status?: boolean }) {
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>Event</th>
            <th>In-App</th>
            <th>Email</th>
            {recipients && <th>Recipients</th>}
            {status && <th>Status</th>}
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e}>
              <td>{e}</td>
              <td>
                <Toggle label={`${e} in-app`} disabled />
              </td>
              <td>
                <Toggle label={`${e} email`} disabled />
              </td>
              {recipients && <td>—</td>}
              {status && (
                <td>
                  <span className={s.off}>Off</span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SimpleTable({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
