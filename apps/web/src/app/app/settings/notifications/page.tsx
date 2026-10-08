import { Bell } from 'lucide-react';
import { EmptyState, Notice } from '@/components/ui';
import { NotificationPrefsForm, type NotificationPref } from '@/components/app/settings/NotificationPrefsForm';
import { getAppContext } from '@/lib/project';
import { apiGet } from '@/lib/api';

export const metadata = { title: 'Notifications · Settings' };

/** Per-event preferences for in-app and email notifications (notification_preferences, per user per workspace). */
export default async function NotificationSettingsPage() {
  const { workspaceId } = await getAppContext();
  const res = workspaceId ? await apiGet<NotificationPref[]>(`/user/notification-preferences?workspaceId=${workspaceId}`, { auth: true }) : null;
  const prefs = res?.ok ? res.data : [];
  return (
    <>
      <h2>Notifications</h2>
      <p>Choose the notifications you want to receive and how you want to be notified.</p>
      {!workspaceId || !prefs.length ? (
        <EmptyState icon={<Bell size={26} />} title="No workspace yet" description="Create a project to configure notifications." />
      ) : (
        <NotificationPrefsForm workspaceId={workspaceId} prefs={prefs} />
      )}
      <div style={{ marginTop: 16 }}>
        <Notice tone="neutral">Critical service, security and legally required notices are always delivered.</Notice>
      </div>
    </>
  );
}
