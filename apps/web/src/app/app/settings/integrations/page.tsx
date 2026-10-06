import Link from 'next/link';
import { BarChart3, BookOpen, Code2, Database, Info, LayoutTemplate, Settings2, ShieldCheck } from 'lucide-react';
import { ButtonLink, Button, Notice } from '@/components/ui';
import { apiList } from '@/lib/api';
import type { IntegrationProvider } from '@/lib/types';
import s from '@/components/app/integrations/integrations.module.css';

export const metadata = { title: 'Integrations · Settings' };

/**
 * The catalog layout comes from the design; whether an item is trackable or
 * connectable comes only from the backend registries (geo_platforms,
 * integration_providers). Registry keys used here are listed in docs/SCREENS.md.
 */
const GEO = [
  { key: 'google_ai_overview', name: 'Google AI Overview', text: 'Track visibility in Google AI Overview responses.', mark: 'G', color: '#4285f4' },
  { key: 'chatgpt', name: 'ChatGPT', text: 'Monitor brand mentions and citations in ChatGPT search results.', mark: 'C', color: '#10a37f' },
  { key: 'perplexity', name: 'Perplexity', text: 'Track visibility and source citations in Perplexity.', mark: 'P', color: '#1f7a8c' },
  { key: 'copilot', name: 'Microsoft Copilot', text: 'Monitor brand presence in Copilot search responses.', mark: 'M', color: '#d83b01' },
];
const ANALYTICS = [
  { key: 'google_analytics', name: 'Google Analytics', text: 'Track traffic and engagement for your content.', mark: 'GA', color: '#f9ab00' },
  { key: 'google_search_console', name: 'Google Search Console', text: 'Import search performance data and keywords.', mark: 'SC', color: '#4285f4' },
  { key: 'google_ads', name: 'Google Ads', text: 'Analyze ad performance and opportunities.', mark: 'Ads', color: '#34a853' },
  { key: 'meta_ads', name: 'Meta Ads (Facebook/Instagram)', text: 'Track ad performance and audience insights.', mark: '∞', color: '#0866ff' },
];

function Logo({ mark, color }: { mark: React.ReactNode; color: string }) {
  return (
    <span className={s.logo} style={{ color }} aria-hidden>
      {mark}
    </span>
  );
}

export default async function IntegrationsSettingsPage() {
  const [geoPlatforms, providers] = await Promise.all([
    apiList<{ key: string; name: string }>('/public/geo-platforms'),
    apiList<IntegrationProvider>('/public/integrations'),
  ]);
  const geoActive = new Set(geoPlatforms.map((p) => p.key));
  const providerActive = new Set(providers.map((p) => p.key));

  return (
    <>
      <h2>Integrations</h2>
      <p>Connect supported services to extend AmpliVerify. Only available integrations are shown as connectable.</p>
      <div style={{ display: 'grid', gap: 16 }}>
        <section className={s.section}>
          <div className={s.head}>
            <Settings2 size={26} color="var(--blue)" />
            <div>
              <h3>
                AI Search (GEO) Tracking Platforms <Info size={16} color="var(--muted)" />
              </h3>
              <p>Track how your brand and content appear in AI-generated search results. No account connection is required.</p>
            </div>
            <span className={s.headAction}>
            <ButtonLink href="/help?q=geo%20tracking" variant="secondary" icon={<BookOpen size={16} />}>
              Learn how GEO tracking works
            </ButtonLink>
            </span>
          </div>
          <div className={s.grid}>
            {GEO.map((g) => (
              <div key={g.key} className={s.card}>
                <Logo mark={g.mark} color={g.color} />
                <div>
                  <h4>{g.name}</h4>
                  <p>{g.text}</p>
                  {geoActive.has(g.key) ? (
                    <span className={`${s.status} ${s.ok}`}>
                      <BarChart3 size={14} /> Trackable (no connection required)
                    </span>
                  ) : (
                    <span className={s.status}>Not available yet</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={s.section}>
          <div className={s.head}>
            <LayoutTemplate size={26} color="var(--blue)" />
            <div>
              <h3>
                Website &amp; CMS Integrations <Info size={16} color="var(--muted)" />
              </h3>
              <p>Connect your website or content management system to analyze and publish content directly.</p>
            </div>
            <span className={s.headAction}>
              <ButtonLink href="/help?q=integration" variant="secondary" icon={<BookOpen size={16} />}>
                View Integration Guide
              </ButtonLink>
            </span>
          </div>
          <div className={s.grid}>
            <div className={s.card}>
              <Logo mark="W" color="#21759b" />
              <div>
                <h4>WordPress</h4>
                <p>Connect your WordPress site to analyze and publish content.</p>
                <div className={s.row}>
                  <span className={s.status}>Not Connected</span>
                  <ButtonLink href="/app/integrations/cms" size="sm">
                    Connect
                  </ButtonLink>
                </div>
              </div>
            </div>
            {[
              { name: 'Webflow', mark: 'W', color: '#4353ff' },
              { name: 'Shopify', mark: 'S', color: '#5e8e3e' },
              { name: 'Custom Website (API)', mark: <Code2 size={24} />, color: 'var(--blue)' },
            ].map((c) => (
              <div key={c.name} className={s.card}>
                <Logo mark={c.mark} color={c.color} />
                <div>
                  <h4>{c.name}</h4>
                  <p>Integration coming soon.</p>
                  <span className={s.status}>Coming Soon</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={s.section}>
          <div className={s.head}>
            <Settings2 size={26} color="var(--blue)" />
            <div>
              <h3>
                Analytics &amp; Marketing Integrations <Info size={16} color="var(--muted)" />
              </h3>
              <p>Connect analytics and marketing tools to get deeper insights into your content performance.</p>
            </div>
          </div>
          <div className={s.grid}>
            {ANALYTICS.map((a) => (
              <div key={a.key} className={s.card}>
                <Logo mark={a.mark} color={a.color} />
                <div>
                  <h4>{a.name}</h4>
                  <p>{a.text}</p>
                  {providerActive.has(a.key) ? (
                    <div className={s.row}>
                      <span className={s.status}>Not Connected</span>
                      <Button size="sm" disabled title="Account connections will be available soon">
                        Connect
                      </Button>
                    </div>
                  ) : (
                    <span className={s.status}>Not available yet</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className={s.managed}>
          <section className={s.section}>
            <div className={s.head}>
              <h3>
                AI Providers <Info size={16} color="var(--muted)" />
              </h3>
            </div>
            <div className={s.managedCard}>
              <ShieldCheck size={28} color="var(--blue)" />
              <div>
                <h4>Managed by AmpliVerify</h4>
                <p>AI models are centrally managed by AmpliVerify. No account connection is required; usage is included based on your plan and credits.</p>
              </div>
              <Link href="/help?q=ai">Learn more ›</Link>
            </div>
          </section>
          <section className={s.section}>
            <div className={s.head}>
              <h3>
                Storage &amp; Media <Info size={16} color="var(--muted)" />
              </h3>
            </div>
            <div className={s.managedCard}>
              <Database size={28} color="var(--green)" />
              <div>
                <h4>Managed by AmpliVerify</h4>
                <p>Your images, videos, and files are securely stored in AmpliVerify’s infrastructure. No external storage connection is required.</p>
              </div>
              <Link href="/help?q=storage">Learn more ›</Link>
            </div>
          </section>
        </div>

        <Notice tone="neutral">You can disconnect an integration at any time. Disconnecting stops future syncs; previously imported data follows your retention settings.</Notice>
      </div>
    </>
  );
}
