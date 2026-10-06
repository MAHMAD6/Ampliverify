import type { Metadata } from 'next';
import { BrainCircuit, Check, Cloud, Globe, Plug } from 'lucide-react';
import { CheckList, CtaBand, PageHero } from '@/components/public/Blocks';
import { apiList } from '@/lib/api';
import type { IntegrationProvider } from '@/lib/types';
import s from '@/components/public/site.module.css';

export const metadata: Metadata = { title: 'Integrations' };

const CATEGORIES = [
  { icon: <Globe size={22} />, title: 'Google Services', text: 'Connect supported Google data sources through secure OAuth.' },
  { icon: <Plug size={22} />, title: 'Website & Search Data', text: 'Use supported SEO and search-data providers for audits, research, and analysis.' },
  { icon: <BrainCircuit size={22} />, title: 'AI Providers', text: 'Power AI-assisted recommendations and content workflows where enabled.' },
  { icon: <Cloud size={22} />, title: 'Storage & Delivery', text: 'Approved storage and delivery services for generated assets and reports.' },
];

/** Integrations (public-batch1/02, restyled to the v2 public theme). Providers are live from the registry. */
export default async function IntegrationsPage() {
  const providers = await apiList<IntegrationProvider>('/public/integrations');
  return (
    <>
      <PageHero eyebrow="Integrations" title="Connect the Data Sources You Already Use" lead="Integrations improve analysis and workflow. Only connections available in production are listed." />
      <section className={s.section}>
        <div className={s.container}>
          <div className={s.grid4}>
            {CATEGORIES.map((c) => (
              <div key={c.title} className={s.card}>
                <span className={s.icon}>{c.icon}</span>
                <h3 className={s.cardTitle}>{c.title}</h3>
                <p className={s.cardText}>{c.text}</p>
              </div>
            ))}
          </div>
          <div className={s.split} style={{ marginTop: 64 }}>
            <div>
              <div className={s.eyebrow}>How integrations work</div>
              <h2 className={s.h2}>Secure Connections, Clear Permissions</h2>
              <p className={s.lead}>You always see what you are connecting, what data is accessed, and why the connection is needed.</p>
              <CheckList items={['Choose a supported integration', 'Authorize securely with OAuth or an approved credential flow', 'Only the minimum permissions are requested', 'Disconnect at any time from Settings']} />
            </div>
            <div className={s.mock}>
              <b>Available integrations</b>
              {providers.length === 0 ? (
                <p className={s.cardText} style={{ marginTop: 10 }}>
                  No integrations are available to connect yet. Supported providers will be listed here as they become available.
                </p>
              ) : (
                providers.map((p) => (
                  <div key={p.key} className={s.mockRow}>
                    <b>{p.name}</b>
                    <span className={s.badge}>
                      <Check size={12} /> Available
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
      <CtaBand title="Ready to Connect Your Website?" text="Start free and connect your data sources in minutes." />
    </>
  );
}
