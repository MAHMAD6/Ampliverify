import { Bell } from 'lucide-react';
import { EmptyState, Notice } from '@/components/ui';
import { ApiForm } from '@/components/ui/actions';
import { getAppContext } from '@/lib/project';
import { apiGet } from '@/lib/api';

export const metadata = { title: 'Notifications · Settings' };

type Pref = { eventKey: string; label: string; description: string; inApp: boolean; email: boolean };

/** Per-event preferences for in-app and email notifications (notification_preferences, per user per workspace). */
export default async function NotificationSettingsPage() {
  const { workspaceId } = await getAppContext();
  const res = workspaceId ? await apiGet<Pref[]>(`/user/notification-preferences?workspaceId=${workspaceId}`, { auth: true }) : null;
  const prefs = res?.ok ? res.data : [];
  return (
    <>
      <h2>Notifications</h2>
      <p>Choose the notifications you want to receive and how you want to be notified.</p>
      {!workspaceId || !prefs.length ? (
        <EmptyState icon={<Bell size={26} />} title="No workspace yet" description="Create a project to configure notifications." />
      ) : (
        <ApiForm
          method="PUT"
          path="/user/notification-preferences"
          submitLabel="Save Preferences"
          transform={(values) => ({
            workspaceId,
            preferences: prefs.map((p) => {
              const k = p.eventKey.replace(/\./g, '~');
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
                  const k = p.eventKey.replace(/\./g, '~');
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
      )}
      <div style={{ marginTop: 16 }}>
        <Notice tone="neutral">Critical service, security and legally required notices are always delivered.</Notice>
      </div>
    </>
  );
}
