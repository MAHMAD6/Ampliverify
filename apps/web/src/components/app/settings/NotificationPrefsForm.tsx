'use client';

import { ApiForm } from '@/components/ui/actions';

export type NotificationPref = { eventKey: string; label: string; description: string; inApp: boolean; email: boolean };

const fieldKey = (eventKey: string) => eventKey.replace(/\./g, '~');

/** Per-event in-app/email toggles, saved as one PUT /user/notification-preferences. */
export function NotificationPrefsForm({ workspaceId, prefs }: { workspaceId: string; prefs: NotificationPref[] }) {
  return (
    <ApiForm
      method="PUT"
      path="/user/notification-preferences"
      submitLabel="Save Preferences"
      transform={(values) => ({
        workspaceId,
        preferences: prefs.map((p) => {
          const k = fieldKey(p.eventKey);
          return { eventKey: p.eventKey, inApp: values[`in_${k}`] === true, email: values[`em_${k}`] === true };
        }),
      })}
    >
      <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 12 }}>Notification</th>
              <th style={{ padding: 12, width: 100 }}>In-app</th>
              <th style={{ padding: 12, width: 100 }}>Email</th>
            </tr>
          </thead>
          <tbody>
            {prefs.map((p) => {
              const k = fieldKey(p.eventKey);
              return (
                <tr key={p.eventKey} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: 12 }}>
                    <b>{p.label}</b>
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>{p.description}</div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" name={`in_${k}`} defaultChecked={p.inApp} aria-label={`${p.label} in-app`} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" name={`em_${k}`} defaultChecked={p.email} aria-label={`${p.label} email`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ApiForm>
  );
}
