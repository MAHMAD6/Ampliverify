import Link from 'next/link';
import { BarChart3, BookOpen, Code2, Database, Info, LayoutTemplate, Settings2, ShieldCheck } from 'lucide-react';
import { ButtonLink, Field, Notice, Select } from '@/components/ui';
import { ActionButton, ApiForm, RedirectButton } from '@/components/ui/actions';
import { apiGet } from '@/lib/api';
import { getAppContext } from '@/lib/project';
import type { GeoPlatformStatus } from '@/lib/app-types';
import { formatDateTime } from '@/lib/format';
import s from '@/components/app/integrations/integrations.module.css';

export const metadata = { title: 'Integrations · Settings' };

type Connection = {
  id: string;
  status: string;
  account: string | null;
  connectedBy: string;
  createdAt: string;
  lastSync: { status: string; at: string; error: string | null } | null;
  projects: { id: string; name: string; sourceType: string; config: { propertyId?: string } | null; lastSyncAt: string | null }[];
};
type ProviderRow = { key: string; name: string; authType: string; available: boolean; connections: Connection[] };

const GEO_TEXT: Record<string, { text: string; mark: string; color: string }> = {
  chatgpt: { text: 'Monitor brand mentions and citations in ChatGPT search answers.', mark: 'C', color: '#10a37f' },
  claude: { text: 'Track how Claude answers questions about your market.', mark: 'A', color: '#d97757' },
  gemini: { text: 'Track visibility in Gemini answers grounded in Google Search.', mark: 'G', color: '#4285f4' },
  perplexity: { text: 'Track visibility and source citations in Perplexity.', mark: 'P', color: '#1f7a8c' },
};
const ANALYTICS: Record<string, { text: string; mark: string; color: string }> = {
  google_search_console: { text: 'Import clicks, impressions and positions for your queries and pages.', mark: 'SC', color: '#4285f4' },
  google_analytics: { text: 'See organic landing-page sessions and conversions.', mark: 'GA', color: '#f9ab00' },
};

function Logo({ mark, color }: { mark: React.ReactNode; color: string }) {
  return (
    <span className={s.logo} style={{ color }} aria-hidden>
      {mark}
    </span>
  );
}

/** Integrations catalog: GEO platforms (managed), WordPress and Google connections with per-project properties. */
export default async function IntegrationsSettingsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const sp = await searchParams;
  const { workspaceId, projects, selectedProject } = await getAppContext();
  const [geoRes, listRes] = await Promise.all([
    apiGet<GeoPlatformStatus[]>('/public/geo-platforms/status', { revalidate: 30 }),
    workspaceId ? apiGet<ProviderRow[]>(`/user/workspaces/${workspaceId}/integrations`, { auth: true }) : null,
  ]);
  const geo = geoRes.ok ? geoRes.data : [];
  const providers = listRes?.ok ? listRes.data : [];
  const provider = (key: string) => providers.find((p) => p.key === key);
  const wp = provider('wordpress');
  const googleConnections = await Promise.all(
    ['google_search_console', 'google_analytics'].flatMap((k) =>
      (provider(k)?.connections ?? []).map(async (c) => ({
        key: k,
        connection: c,
        properties: c.status === 'CONNECTED' ? await apiGet<{ id: string; name: string }[]>(`/user/integrations/${c.id}/properties`, { auth: true }) : null,
      })),
    ),
  );

  return (
    <>
      <h2>Integrations</h2>
      <p>Connect supported services to extend AmpliVerify. Only available integrations are shown as connectable.</p>
      {sp.connected && (
        <div style={{ marginBottom: 12 }}>
          <Notice tone="green" title="Connected">Choose which property each project should use below.</Notice>
        </div>
      )}
      {sp.error && (
        <div style={{ marginBottom: 12 }}>
          <Notice tone="amber" title="The connection was not completed">{sp.error}</Notice>
        </div>
      )}
      <div style={{ display: 'grid', gap: 16 }}>
        <section className={s.section}>
          <div className={s.head}>
            <Settings2 size={26} color="var(--blue)" />
            <div>
              <h3>
                AI Search (GEO) Tracking Platforms <Info size={16} color="var(--muted)" />
              </h3>
              <p>Track how your brand and content appear in AI-generated answers. No account connection is required.</p>
            </div>
            <span className={s.headAction}>
              <ButtonLink href="/help?q=geo%20tracking" variant="secondary" icon={<BookOpen size={16} />}>
                Learn how GEO tracking works
              </ButtonLink>
            </span>
          </div>
          <div className={s.grid}>
            {geo.map((g) => (
              <div key={g.key} className={s.card}>
                <Logo mark={GEO_TEXT[g.key]?.mark ?? g.name[0]} color={GEO_TEXT[g.key]?.color ?? 'var(--blue)'} />
                <div>
                  <h4>{g.name}</h4>
                  <p>{GEO_TEXT[g.key]?.text ?? `Track visibility in ${g.name} answers.`}</p>
                  {g.configured ? (
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
              <p>Connect your website or content management system to publish optimized content directly.</p>
            </div>
          </div>
          <div className={s.grid}>
            <div className={s.card}>
              <Logo mark="W" color="#21759b" />
              <div>
                <h4>WordPress</h4>
                <p>Publish editor documents as WordPress posts or pages.</p>
                {wp?.connections.length ? (
                  wp.connections.map((c) => (
                    <div key={c.id} className={s.row} style={{ flexWrap: 'wrap' }}>
                      <span className={`${s.status} ${c.status === 'CONNECTED' ? s.ok : ''}`}>{c.status === 'CONNECTED' ? `Connected · ${c.account}` : `${c.status.toLowerCase()} · ${c.account}`}</span>
                      <ActionButton size="sm" variant="ghost" path={`/user/integrations/${c.id}/test`}>
                        Test
                      </ActionButton>
                      <ActionButton size="sm" variant="ghost" method="DELETE" path={`/user/integrations/${c.id}`} confirm="Disconnect this site? Publishing will stop.">
                        Disconnect
                      </ActionButton>
                    </div>
                  ))
                ) : (
                  <div className={s.row}>
                    <span className={s.status}>{wp?.available ? 'Not Connected' : 'Not available yet'}</span>
                    {wp?.available && (
                      <ButtonLink href="/app/integrations/cms" size="sm">
                        Connect
                      </ButtonLink>
                    )}
                  </div>
                )}
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
                Analytics Integrations <Info size={16} color="var(--muted)" />
              </h3>
              <p>Read-only Google connections that bring your real search and traffic data into AmpliVerify.</p>
            </div>
          </div>
          <div className={s.grid}>
            {Object.entries(ANALYTICS).map(([key, meta]) => {
              const p = provider(key);
              return (
                <div key={key} className={s.card}>
                  <Logo mark={meta.mark} color={meta.color} />
                  <div>
                    <h4>{p?.name ?? key}</h4>
                    <p>{meta.text}</p>
                    <div className={s.row} style={{ flexWrap: 'wrap' }}>
                      <span className={`${s.status} ${p?.connections.some((c) => c.status === 'CONNECTED') ? s.ok : ''}`}>
                        {p?.connections.filter((c) => c.status === 'CONNECTED').map((c) => c.account).join(', ') || (p?.available ? 'Not Connected' : 'Not available yet')}
                      </span>
                      {p?.available && workspaceId && (
                        <RedirectButton size="sm" path={`/user/workspaces/${workspaceId}/integrations/google/start`} body={{ provider: key }}>
                          {p.connections.length ? 'Connect another account' : 'Connect'}
                        </RedirectButton>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {googleConnections.map(({ key, connection: c, properties }) => {
            const current = c.projects.find((x) => x.id === selectedProject?.id);
            return (
              <div key={c.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 16, marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <b>
                    {ANALYTICS[key]?.mark === 'SC' ? 'Search Console' : 'Google Analytics'} · {c.account}
                  </b>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <ActionButton size="sm" variant="ghost" path={`/user/integrations/${c.id}/test`}>
                      Test
                    </ActionButton>
                    <ActionButton size="sm" variant="ghost" method="DELETE" path={`/user/integrations/${c.id}`} confirm="Disconnect this Google account?">
                      Disconnect
                    </ActionButton>
                  </span>
                </div>
                {c.projects.length > 0 && (
                  <ul style={{ fontSize: 14, color: 'var(--muted)', margin: '8px 0' }}>
                    {c.projects.map((pr) => (
                      <li key={pr.id}>
                        {pr.name}: {pr.config?.propertyId ?? 'no property'} {pr.lastSyncAt ? `· last read ${formatDateTime(pr.lastSyncAt)}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
                {properties?.ok && projects.length > 0 ? (
                  <ApiForm path={`/user/projects/${selectedProject?.id ?? projects[0].id}/data-sources`} submitLabel={`Use for ${(selectedProject ?? projects[0]).name}`} transform={(v) => ({ integrationId: c.id, propertyId: v.propertyId })}>
                    <Field label="Property" htmlFor={`prop-${c.id}`}>
                      <Select id={`prop-${c.id}`} name="propertyId" defaultValue={current?.config?.propertyId ?? properties.data[0]?.id}>
                        {properties.data.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </ApiForm>
                ) : (
                  <small style={{ color: 'var(--muted)' }}>{properties && !properties.ok ? 'Properties could not be loaded. Test or reconnect the account.' : 'Create a project to link a property.'}</small>
                )}
              </div>
            );
          })}
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
                <p>Your files are stored securely in AmpliVerify’s infrastructure. No external storage connection is required.</p>
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
