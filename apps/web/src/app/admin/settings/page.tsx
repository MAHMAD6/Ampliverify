import { Box, Database, Download, Settings, SlidersHorizontal } from 'lucide-react';
import { SettingsCard, SettingsShell } from '@/components/admin/AdminSettings';

export const metadata = { title: 'General · Settings' };

export default function GeneralSettingsPage() {
  return (
    <SettingsShell
      tab="general"
      about={{ title: 'About Settings', text: 'These settings control platform-wide preferences and configurations. Only users with appropriate permissions can view and manage them.' }}
      footer="These settings will be applied across the platform where applicable once platform settings can be saved."
    >
      <SettingsCard
        icon={<Settings size={24} />}
        tone="blue"
        title="Platform Information"
        description="Basic platform details and branding information used across the platform."
        rows={[{ label: 'Organization Name' }, { label: 'Platform Name', value: 'AmpliVerify' }, { label: 'Platform URL' }, { label: 'Support Email' }, { label: 'Default Time Zone' }]}
      />
      <SettingsCard
        icon={<SlidersHorizontal size={24} />}
        tone="green"
        title="Default Settings"
        description="Default preferences for new users and content."
        rows={[{ label: 'Default User Role' }, { label: 'Default Language' }, { label: 'Default Date Format' }, { label: 'Default Time Format' }, { label: 'Items Per Page' }]}
      />
      <SettingsCard
        icon={<Box size={24} />}
        tone="purple"
        title="Project & Audit Settings"
        description="Default settings for projects, audits, and reports."
        rows={[{ label: 'Default Project Status' }, { label: 'Default Audit Type' }, { label: 'Default Report Visibility' }, { label: 'Allow User Signup' }, { label: 'Maintenance Mode' }]}
      />
      <SettingsCard
        icon={<Database size={24} />}
        tone="amber"
        title="Data & Retention"
        description="Data retention and cleanup settings."
        rows={[{ label: 'Activity Log Retention' }, { label: 'Session Log Retention' }, { label: 'Deleted Content Retention' }, { label: 'Inactive Account Retention' }]}
      />
      <SettingsCard icon={<Download size={24} />} tone="blue" title="Export Preferences" description="Default export settings for data and reports." rows={[{ label: 'Default Export Format' }, { label: 'Include Audit Details' }]} wide />
    </SettingsShell>
  );
}
