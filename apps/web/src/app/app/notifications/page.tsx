import { NotificationCenter } from '@/components/app/NotificationCenter';

export const metadata = { title: 'Notifications' };

export default async function NotificationCenterPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  return <NotificationCenter filter={(await searchParams).filter} base="/app/notifications" settingsHref="/app/settings/notifications" />;
}
