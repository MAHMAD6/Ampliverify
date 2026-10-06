import Image from 'next/image';
import { Eye, Globe, LayoutPanelLeft, Palette, Stamp } from 'lucide-react';
import { SettingsCard, SettingsShell } from '@/components/admin/AdminSettings';
import { Button } from '@/components/ui';

const change = (
  <Button size="sm" variant="secondary" disabled title="The approved brand assets are locked">
    Change
  </Button>
);

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
          {
            label: 'Platform logo',
            value: (
              <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
                <Image src="/brand/mark-transparent.png" alt="Approved AmpliVerify mark" width={26} height={26} /> {change}
              </span>
            ),
          },
          {
            label: 'Favicon',
            value: (
              <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
                Approved asset {change}
              </span>
            ),
          },
          { label: 'Brand name', value: 'AmpliVerify' },
          { label: 'Tagline', value: 'SEO Engineering' },
        ]}
      />
      <SettingsCard icon={<LayoutPanelLeft size={24} />} tone="purple" title="Layout & Navigation" description="Supported shell preferences." rows={[{ label: 'Default sidebar state', select: true }, { label: 'Show module icons', toggle: true }, { label: 'Compact navigation', toggle: true }]} />
      <SettingsCard icon={<Globe size={24} />} tone="amber" title="Login & Public Pages" description="Branding on authentication and public experiences." rows={[{ label: 'Show logo on login', toggle: true }, { label: 'Show product name', toggle: true }, { label: 'Show tagline', toggle: true }]} />
      <SettingsCard icon={<Eye size={24} />} tone="blue" title="Preview" description="How the approved branding appears in the app header." wide>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--navy-900)', color: '#fff' }}>
          <Image src="/brand/mark-transparent.png" alt="" width={32} height={32} />
          <span>
            <b style={{ display: 'block', letterSpacing: 0.5 }}>AMPLIVERIFY</b>
            <small style={{ opacity: 0.75, letterSpacing: 1 }}>SEO ENGINEERING</small>
          </span>
        </div>
      </SettingsCard>
    </SettingsShell>
  );
}
