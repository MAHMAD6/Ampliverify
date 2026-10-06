import { Bell, Database, Lock, Shield, Users } from 'lucide-react';
import { ChannelTable, SettingsCard, SettingsShell } from '@/components/admin/AdminSettings';

export const metadata = { title: 'Security · Settings' };

export default function SecuritySettingsPage() {
  return (
    <SettingsShell
      tab="security"
      about={{ title: 'About Security Settings', text: 'Platform-wide security rules and policies that protect your organization, users, data, and system resources.' }}
      footer="Security settings apply across the platform. Changes may affect user access and can take a short time to take effect."
    >
      <SettingsCard icon={<Shield size={24} />} tone="blue" title="Authentication" description="Authentication methods and requirements." rows={[{ label: 'Allow passkeys', toggle: true }, { label: 'Session timeout', select: true }]} />
      <SettingsCard
        icon={<Database size={24} />}
        tone="green"
        title="Session Controls"
        description="User session behavior and access duration."
        rows={[{ label: 'Maximum concurrent sessions', select: true }, { label: 'Re-authentication for sensitive actions', toggle: true }, { label: 'Remembered devices', toggle: true }, { label: 'Inactivity timeout', select: true }]}
      />
      <SettingsCard
        icon={<Lock size={24} />}
        tone="amber"
        title="Access Protection"
        description="Protections against unauthorized access."
        rows={[{ label: 'Failed login protection', toggle: true }, { label: 'Maximum login attempts', select: true }, { label: 'Account lockout duration', select: true }, { label: 'Invitation expiry', select: true }]}
      />
      <SettingsCard
        icon={<Users size={24} />}
        tone="purple"
        title="Admin Security"
        description="Additional security rules for administrative accounts."
        rows={[{ label: 'Require MFA for Super Admin', toggle: true }, { label: 'Require MFA for Admins / Sub-Admins', toggle: true }, { label: 'Restrict sensitive actions by role', toggle: true }]}
      />
      <SettingsCard icon={<Bell size={24} />} tone="red" title="Security Notifications" description="Notifications for important security events." wide>
        <ChannelTable events={['New device sign-in', 'Suspicious sign-in attempt', 'Password reset', 'MFA changes']} />
      </SettingsCard>
    </SettingsShell>
  );
}
