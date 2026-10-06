import Image from 'next/image';
import { Globe, LayoutPanelLeft, Palette, Stamp } from 'lucide-react';
import { SettingsCard, SettingsShell } from '@/components/admin/AdminSettings';

export const metadata = { title: 'Appearance · Settings' };

/** Appearance (admin-final-batch2/03, in the card style of the newer Settings designs). The approved logo is locked. */
export default function AppearanceSettingsPage() {
  return (
    <SettingsShell
      tab="appearance"
      about={{ title: 'Branding rule', text: 'Use the exact approved AmpliVerify logo. Do not recolor, redraw, or substitute it. Only supported customization is exposed.' }}
      footer="Appearance changes apply to supported interfaces once appearance settings can be saved."
    >
      <SettingsCard icon={<Palette size={24} />} tone="blue" title="Theme & Visual Style" description="Supported platform appearance defaults." rows={[{ label: 'Default mode', select: true }, { label: 'Primary color' }, { label: 'Secondary color' }, { label: 'Accent color' }]} />
      <SettingsCard
        icon={<Stamp size={24} />}
        tone="green"
        title="Branding"
        description="Product identity shown across supported interfaces."
        rows={[
          { label: 'Platform logo', value: <Image src="/brand/mark-transparent.png" alt="Approved AmpliVerify mark" width={26} height={26} /> },
          { label: 'Favicon', value: 'Approved asset' },
          { label: 'Brand name', value: 'AmpliVerify' },
          { label: 'Tagline', value: 'SEO Engineering' },
        ]}
      />
      <SettingsCard icon={<LayoutPanelLeft size={24} />} tone="purple" title="Layout & Navigation" description="Supported shell preferences." rows={[{ label: 'Default sidebar state', select: true }, { label: 'Show module icons', toggle: true }, { label: 'Compact navigation', toggle: true }]} />
      <SettingsCard icon={<Globe size={24} />} tone="amber" title="Login & Public Pages" description="Branding on authentication and public experiences." rows={[{ label: 'Show logo on login', toggle: true }, { label: 'Show product name', toggle: true }, { label: 'Show tagline', toggle: true }]} />
    </SettingsShell>
  );
}
