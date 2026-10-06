import type { Metadata } from 'next';
import { BrainCircuit, Cloud, Globe, Plug } from 'lucide-react';
import { Hero, NumberedList } from '@/components/public/Hero';
import { Badge } from '@/components/ui';
import { apiList } from '@/lib/api';
import type { IntegrationProvider } from '@/lib/types';
import s from '@/components/public/public.module.css';

export const metadata: Metadata = { title: 'Integrations' };

const CATEGORIES = [
  { icon: <Globe size={22} />, title: 'Google Services', text: 'Connect supported Google data sources through secure OAuth.' },
  { icon: <Plug size={22} />, title: 'Website & Search Data', text: 'Use supported SEO and search-data providers for audits, research, and analysis.' },
  { icon: <BrainCircuit size={22} />, title: 'AI Providers', text: 'Power AI-assisted recommendations and content workflows where enabled.' },
  { icon: <Cloud size={22} />, title: 'Storage & Delivery', text: 'Approved storage and delivery services for generated assets and reports.' },
];

export default async function IntegrationsPage() {
  const providers = await apiList<IntegrationProvider>('/public/integrations');
  return (
    <>
      <Hero eyebrow="Integrations" title="Connect the data sources AmpliVerify supports">
        Integrations improve analysis and workflow. Only connections that are available in production are listed as available.
      </Hero>
      <section className={s.section}>
        <div className={s.container}>
          <div className={s.cards}>
            {CATEGORIES.map((c) => (
              <div key={c.title} className={s.cardx}>
                <div className={s.iconbox}>{c.icon}</div>
                <h3>{c.title}</h3>
                <p>{c.text}</p>
              </div>
            ))}
          </div>
          <div className={s.twocol} style={{ marginTop: 56 }}>
            <div>
              <div className={s.eyebrow}>How integrations work</div>
              <h2 className={s.h2}>Secure connections, clear permissions</h2>
              <p className={s.lead}>You always see what you are connecting, what data is accessed, and why the connection is needed.</p>
              <NumberedList
                items={[
                  { title: 'Choose a supported integration', text: 'Pick from the integrations available for your workspace.' },
                  { title: 'Authorize securely', text: 'Connect with OAuth or an approved credential flow — never by pasting unnecessary secrets.' },
                  { title: 'Use only required scopes', text: 'Only the minimum permissions needed for the feature are requested.' },
                  { title: 'Disconnect when needed', text: 'Remove a connection at any time from Settings.' },
                ]}
              />
            </div>
            <div className={s.mock}>
              <div className={s.eyebrow}>Integration status</div>
              <h3 style={{ fontSize: 22, color: '#173a63', margin: '10px 0 14px' }}>Available integrations</h3>
              {providers.length === 0 ? (
                <p style={{ fontSize: 15, color: '#748394', lineHeight: 1.6 }}>
                  No integrations are available to connect yet. Supported providers will be listed here as they become available.
                </p>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {providers.map((p) => (
                    <div key={p.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #e0e8e4', borderRadius: 12, padding: '12px 14px' }}>
                      <strong style={{ color: '#173a63' }}>{p.name}</strong>
                      <Badge tone="green">Available</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
