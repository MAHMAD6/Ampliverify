import Image from 'next/image';
import { Eye, Palette, Stamp } from 'lucide-react';
import { FactRows, SettingsGrid, SettingsSection, SettingsShell } from '@/components/admin/AdminSettings';

export const metadata = { title: 'Appearance · Settings' };

const Swatch = ({ color, name }: { color: string; name: string }) => (
  <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
    <span style={{ width: 18, height: 18, borderRadius: 4, background: color, border: '1px solid var(--line)' }} /> {name}
  </span>
);

/**
 * Appearance (admin-final-batch2/03). The approved AmpliVerify brand (logo,
 * mark, palette, name and tagline) is fixed by the brand guidelines, so this
 * tab documents it rather than offering edits.
 */
export default function AppearanceSettingsPage() {
  return (
    <SettingsShell
      tab="appearance"
      about={{ title: 'Branding rule', text: 'Use the exact approved AmpliVerify logo. Do not recolor, redraw, or substitute it. Brand assets are fixed by the brand guidelines.' }}
      footer="Brand asset changes go through the brand owner and a release, not this console."
    >
      <SettingsGrid>
        <SettingsSection icon={<Stamp size={24} />} tone="green" title="Branding" description="Product identity shown across the product and website.">
          <FactRows
            rows={[
              [
                'Platform logo',
                <span key="l" style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
                  <Image src="/brand/mark-transparent.png" alt="Approved AmpliVerify mark" width={26} height={26} /> Approved asset
                </span>,
              ],
              ['Favicon', 'Approved asset'],
              ['Brand name', 'AmpliVerify'],
              ['Tagline', 'SEO Engineering'],
            ]}
          />
        </SettingsSection>
        <SettingsSection icon={<Palette size={24} />} tone="blue" title="Theme & Visual Style" description="The approved palette used by every interface.">
          <FactRows
            rows={[
              ['Mode', 'Light'],
              ['Primary', <Swatch key="p" color="var(--blue)" name="AmpliVerify blue" />],
              ['Navigation', <Swatch key="n" color="var(--navy-900)" name="Navy" />],
              ['Accent', <Swatch key="a" color="var(--green)" name="Verify green" />],
            ]}
          />
        </SettingsSection>
        <SettingsSection icon={<Eye size={24} />} tone="purple" title="Preview" description="How the approved branding appears in the app header." wide>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--navy-900)', color: '#fff' }}>
            <Image src="/brand/mark-transparent.png" alt="" width={32} height={32} />
            <span>
              <b style={{ display: 'block', letterSpacing: 0.5 }}>AMPLIVERIFY</b>
              <small style={{ opacity: 0.75, letterSpacing: 1 }}>SEO ENGINEERING</small>
            </span>
          </div>
        </SettingsSection>
      </SettingsGrid>
    </SettingsShell>
  );
}
