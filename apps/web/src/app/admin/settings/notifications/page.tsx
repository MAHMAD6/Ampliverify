import { AlertCircle, FileText, Mail, Users } from 'lucide-react';
import { ChannelTable, OffToggle, SettingsCard, SettingsShell, SimpleTable } from '@/components/admin/AdminSettings';

export const metadata = { title: 'Notifications · Settings' };

const off = <span style={{ fontSize: 12, color: 'var(--muted)', background: '#eef1f6', borderRadius: 6, padding: '2px 8px' }}>Off</span>;

export default function NotificationSettingsPage() {
  return (
    <SettingsShell
      tab="notifications"
      about={{ title: 'About Notifications', text: 'Platform-wide notifications for important system, user, content, and billing events.' }}
      footer="Users only receive notifications allowed by their roles and permissions."
    >
      <SettingsCard icon={<Users size={24} />} tone="blue" title="Admin Notifications" description="Notifications for administrative and system events.">
        <ChannelTable events={['New user registration', 'Subscription changes', 'Payment failures', 'Credit adjustments', 'Security/access events', 'System health alerts']} />
      </SettingsCard>
      <SettingsCard icon={<FileText size={24} />} tone="amber" title="Content Notifications" description="Notifications for content-related events.">
        <ChannelTable events={['Blog post published', 'Resource published', 'Job opening published']} />
      </SettingsCard>
      <SettingsCard icon={<Mail size={24} />} tone="green" title="Delivery Channels" description="How notifications are delivered.">
        <SimpleTable
          columns={['Channel', 'Status', 'Configuration']}
          rows={[
            ['In-app notifications', <OffToggle key="a" label="In-app notifications" />, '—'],
            ['Email notifications', <OffToggle key="b" label="Email notifications" />, '—'],
          ]}
        />
      </SettingsCard>
      <SettingsCard icon={<AlertCircle size={24} />} tone="red" title="Severity & Priority" description="Notification categories and priorities.">
        <SimpleTable
          columns={['Level', 'Description', 'Status']}
          rows={[
            ['Informational', 'General updates and activity', off],
            ['Warning', 'Potential issues that need attention', off],
            ['Critical', 'Important issues requiring immediate action', off],
          ]}
        />
      </SettingsCard>
      <SettingsCard icon={<Users size={24} />} tone="purple" title="Recipients" description="Default recipients for notifications." wide>
        <SimpleTable columns={['Recipient Group', 'Status']} rows={[['Super Admin', off], ['Admins', off], ['Sub-Admins', off], ['Selected roles', off]]} />
      </SettingsCard>
    </SettingsShell>
  );
}
