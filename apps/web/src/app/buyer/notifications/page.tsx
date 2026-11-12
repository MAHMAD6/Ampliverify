import { NotificationCenter } from '@/components/app/NotificationCenter';

export const metadata = { title: 'Notifications · Marketplace' };

/** Bell destination inside the Buyer dashboard, so buyers stay in the Marketplace layout. */
export default async function BuyerNotificationsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  return <NotificationCenter filter={(await searchParams).filter} base="/buyer/notifications" settingsHref="/buyer/settings/notifications" />;
}
