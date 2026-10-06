import { Bell, BarChart3, Megaphone, Search, TriangleAlert, Zap } from 'lucide-react';
import { Button, EmptyState, IconCircle, Notice } from '@/components/ui';
import { Toggle } from '@/components/ui/Toggle';
import p from '@/components/app/pages.module.css';

export const metadata = { title: 'Notifications · Settings' };

const CATEGORIES = [
  { icon: <Zap size={22} />, tone: 'blue' as const, title: 'Project Activity', text: 'Get notified about important activity on your projects, such as audit completion, content updates, or recommended actions.' },
  { icon: <Search size={22} />, tone: 'purple' as const, title: 'Keyword Monitoring', text: 'Receive notifications about keyword ranking changes, new opportunities, and significant movements.' },
  { icon: <BarChart3 size={22} />, tone: 'green' as const, title: 'Reports', text: 'Get notified when scheduled reports are ready or when new insights are available.' },
  { icon: <TriangleAlert size={22} />, tone: 'red' as const, title: 'System Alerts', text: 'Important notifications about your account, billing, or system status.' },
  { icon: <Megaphone size={22} />, tone: 'amber' as const, title: 'Product Updates', text: 'Occasional updates about new features, improvements, and tips.' },
];

/** Preferences persist per user per workspace (notification_preferences); saving is not wired yet. */
export default function NotificationSettingsPage() {
  return (
    <>
      <h2>Notifications</h2>
      <p>Choose the types of notifications you want to receive and how you want to be notified.</p>
      <div style={{ display: 'grid', gap: 12 }}>
        {CATEGORIES.map((c) => (
          <div key={c.title} className={p.notifCard}>
            <IconCircle tone={c.tone} size={52}>
              {c.icon}
            </IconCircle>
            <div>
              <h4>{c.title}</h4>
              <p>{c.text}</p>
            </div>
            <Toggle label={c.title} disabled />
          </div>
        ))}
      </div>
      <h3 style={{ fontSize: 20, marginTop: 28 }}>Notification Channels</h3>
      <p style={{ color: 'var(--muted)', marginBottom: 12 }}>Choose how you want to receive notifications.</p>
      <div style={{ border: '1px solid var(--line)', borderRadius: 12 }}>
        <EmptyState
          icon={<Bell size={26} />}
          title="No notification channels configured"
          description="Enable email or in-app notifications to start receiving updates."
          action={
            <Button variant="outline" disabled>
              Configure Notifications
            </Button>
          }
        />
      </div>
      <div style={{ marginTop: 16 }}>
        <Notice tone="neutral">Critical service, security and legally required notices are always delivered.</Notice>
      </div>
    </>
  );
}
