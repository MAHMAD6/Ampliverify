import { AiGeoPreferences } from '@/components/app/settings/AiGeoPreferences';
import { LANGUAGES, LOCATIONS } from '@/components/app/keywords/config';
import { apiList } from '@/lib/api';

export const metadata = { title: 'AI & GEO Preferences · Settings' };

export default async function AiGeoPreferencesPage() {
  const platforms = await apiList<{ key: string; name: string }>('/public/geo-platforms');
  return <AiGeoPreferences platforms={platforms} locations={LOCATIONS} languages={LANGUAGES} />;
}
