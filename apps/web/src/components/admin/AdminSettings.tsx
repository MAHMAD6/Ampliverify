import 'server-only';
import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { TabNav } from '../ui';
import { AdminHeader } from './AdminParts';
import { adminGet, dateTime } from '@/lib/admin-data';
import s from './settings.module.css';

export type SettingsTab = 'general' | 'billing' | 'notifications' | 'security' | 'appearance';

export const SETTINGS_TABS: { key: SettingsTab; label: string; href: string }[] = [
  { key: 'general', label: 'General', href: '/admin/settings' },
  { key: 'billing', label: 'Credits & Billing', href: '/admin/settings/billing' },
  { key: 'notifications', label: 'Notifications', href: '/admin/settings/notifications' },
  { key: 'security', label: 'Security', href: '/admin/settings/security' },
  { key: 'appearance', label: 'Appearance', href: '/admin/settings/appearance' },
];

export type SettingRow = { key: string; value: unknown; updatedAt: string | null; updatedBy: string | null };

/** All editable platform settings (`GET /admin/settings`), or null when the API refuses. */
export async function loadSettings() {
  const rows = await adminGet<SettingRow[]>('/admin/settings');
  if (!rows) return null;
  return {
    rows,
    value: <T,>(key: string, fallback: T) => ((rows.find((r) => r.key === key)?.value ?? fallback) as T),
    updated: (key: string) => {
      const at = rows.find((r) => r.key === key)?.updatedAt;
      return at ? `Last saved ${dateTime(at)}` : 'Not saved yet — defaults apply';
    },
  };
}

/**
 * Platform Settings (chat designs 2026-10-06; admin-final-batch1/04 and
 * batch2/01-03). Each tab edits one `system_settings` key through the audited
 * admin API; only settings the platform actually applies are offered.
 */
export function SettingsShell({ tab, about, footer, children }: { tab: SettingsTab; about: { title: string; text: string }; footer?: string; children: ReactNode }) {
  return (
    <>
      <div className={s.head}>
        <AdminHeader
          section="Settings"
          page={SETTINGS_TABS.find((t) => t.key === tab)!.label}
          title="Settings"
          description="Manage platform settings and preferences. Use the tabs below to configure general settings, credits, notifications, security, and appearance."
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
      <div style={{ marginTop: 14 }}>{children}</div>
      {footer && (
        <p className={s.footer}>
          <Info size={18} /> {footer}
        </p>
      )}
    </>
  );
}

/** Two-column grid of setting sections. */
export function SettingsGrid({ children }: { children: ReactNode }) {
  return <div className={s.grid}>{children}</div>;
}

/** A settings section: icon, title, description and its fields. */
export function SettingsSection({ icon, tone, title, description, wide, children }: { icon: ReactNode; tone: string; title: string; description: string; wide?: boolean; children: ReactNode }) {
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
      </header>
      <div style={{ display: 'grid', gap: 12 }}>{children}</div>
    </section>
  );
}

/** Read-only facts (behavior that is fixed by the platform, not configurable). */
export function FactRows({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className={s.rows}>
      {rows.map(([label, value], i) => (
        <div key={i}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
