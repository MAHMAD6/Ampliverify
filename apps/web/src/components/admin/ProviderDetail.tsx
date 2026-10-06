import type { ReactNode } from 'react';
import { Button, EmptyState, KeyValue, Notice, Panel, SettingRow } from '../ui';
import { AdminHeader } from './AdminParts';
import s from './audit.module.css';

export type DetailSection = { title: string; description: string; rows: string[] };

/**
 * Provider-backed record detail (admin-final-batch3/01 Subscription, /02
 * Invoice). Every value must come from the billing provider via synchronized
 * backend records; that API is not built, so values read "Not available",
 * actions are disabled, and the timeline is empty.
 */
export function ProviderDetail({
  section,
  parent,
  title,
  description,
  integrity,
  headerAction,
  summary,
  provider,
  middle,
  actions,
  timeline,
}: {
  section: string;
  parent: { label: string; href: string };
  title: string;
  description: string;
  integrity: ReactNode;
  headerAction: string;
  summary: DetailSection;
  provider: DetailSection;
  middle?: { title: string; description: string; emptyTitle: string; emptyText: string; icon: ReactNode };
  actions: { title: string; description: string; items: { label: string; text: string; cta: string }[] };
  timeline: { title: string; description: string; empty: string };
}) {
  return (
    <>
      <AdminHeader
        section={section}
        parent={parent}
        page="Detail"
        title={title}
        description={description}
        actions={
          <Button variant="outline" disabled>
            {headerAction}
          </Button>
        }
      />
      <div style={{ marginBottom: 16 }}>
        <Notice tone="neutral">{integrity}</Notice>
      </div>
      <div className={s.split} style={{ marginTop: 0 }}>
        {[summary, provider].map((sec) => (
          <Panel key={sec.title} title={sec.title} description={sec.description} flushHead>
            {sec.rows.map((r) => (
              <KeyValue key={r} label={r} />
            ))}
          </Panel>
        ))}
      </div>
      {middle && (
        <div style={{ marginTop: 16 }}>
          <Panel title={middle.title} description={middle.description}>
            <EmptyState icon={middle.icon} title={middle.emptyTitle} description={middle.emptyText} />
          </Panel>
        </div>
      )}
      <div className={s.split}>
        <Panel title={actions.title} description={actions.description} flushHead>
          {actions.items.map((a) => (
            <SettingRow
              key={a.label}
              title={a.label}
              description={a.text}
              control={
                <Button variant="outline" size="sm" disabled title="Available once the record is loaded from the billing provider.">
                  {a.cta}
                </Button>
              }
            />
          ))}
        </Panel>
        <Panel title={timeline.title} description={timeline.description} flushHead>
          <div className={s.timeline}>
            <b>{timeline.empty}</b>
            Provider-backed events will appear here.
          </div>
        </Panel>
      </div>
    </>
  );
}
