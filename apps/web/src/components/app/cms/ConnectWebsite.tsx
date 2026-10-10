'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CircleHelp, Code2, Copy, Eye, EyeOff, FileText, Info, Lock, PencilLine, Radio, Search, Trash2 } from 'lucide-react';
import { Button, ButtonLink, DataTable, EmptyState, Field, Input, Panel } from '@/components/ui';
import { ActionMessage } from '@/components/ui/actions';
import { apiAction, apiQuery } from '@/lib/actions';
import c from './cms.module.css';

export type Platform = 'wordpress' | 'webflow' | 'shopify' | 'custom_webhook';
const PLATFORMS: { key: Platform; name: string; text: string; icon: React.ReactNode }[] = [
  { key: 'wordpress', name: 'WordPress', text: 'Posts and pages via application password', icon: <span className={c.wp}>W</span> },
  { key: 'webflow', name: 'Webflow', text: 'Items in a CMS collection', icon: <span className={c.logo} style={{ color: '#4353ff' }}>W</span> },
  { key: 'shopify', name: 'Shopify', text: 'Online store pages and blog articles', icon: <span className={c.logo} style={{ color: '#5e8e3e' }}>S</span> },
  { key: 'custom_webhook', name: 'Custom (API)', text: 'Signed webhook to your endpoint', icon: <Code2 size={30} /> },
];

export type WpConnection = { id: string; status: string; account: string | null; createdAt: string };
type WpItem = { id: number; title: string; url: string; modified: string; status: string };

function Step({ n, title, text, children }: { n: number; title: string; text: string; children: React.ReactNode }) {
  return (
    <Panel>
      <div className={c.step}>
        <span className={c.stepNum}>{n}</span>
        <div>
          <h2>{title}</h2>
          <p>{text}</p>
        </div>
      </div>
      <div className={c.stepBody}>{children}</div>
    </Panel>
  );
}

function Secret({ id, name, label, placeholder, hint }: { id: string; name: string; label: string; placeholder: string; hint?: string }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div style={{ position: 'relative' }}>
        <Input id={id} name={name} required minLength={8} type={show ? 'text' : 'password'} placeholder={placeholder} autoComplete="new-password" />
        <button type="button" className={c.eye} aria-label={show ? 'Hide' : 'Show'} onClick={() => setShow((v) => !v)}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </Field>
  );
}

/**
 * Connect Your Website (chat design). WordPress, Webflow and Shopify
 * credentials are verified against the platform's API, stored encrypted and
 * never shown again. "Custom (API)" sends signed webhooks to the customer's
 * endpoint; its signing secret is shown once. Editor documents publish to any
 * connected platform.
 */
export function ConnectWebsite({ workspaceId, projectId, connections, available }: { workspaceId: string | null; projectId: string | null; connections: Partial<Record<Platform, WpConnection | null>>; available: boolean }) {
  const router = useRouter();
  const [platform, setPlatform] = useState<Platform>('wordpress');
  const [contentTab, setContentTab] = useState<'pages' | 'posts'>('pages');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<WpItem[]>([]);
  const [selected, setSelected] = useState<WpItem | null>(null);
  const [signingSecret, setSigningSecret] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const connection = connections[platform] ?? null;
  const meta = PLATFORMS.find((p) => p.key === platform)!;
  const wp = connections.wordpress ?? null;

  const load = useCallback(() => {
    if (!wp) return;
    start(async () => {
      const r = await apiQuery<WpItem[]>(`/user/integrations/${wp.id}/wordpress/content?type=${contentTab}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
      if (!r.ok) return setMsg({ error: r.message });
      setItems(r.data);
    });
  }, [wp, contentTab, q]);
  useEffect(() => {
    if (platform === 'wordpress') load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wp, contentTab, platform]);

  const connect = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? '');
    const body =
      platform === 'wordpress'
        ? { siteUrl: v('siteUrl'), username: v('username'), applicationPassword: v('password') }
        : platform === 'webflow'
          ? { apiToken: v('apiToken'), collectionId: v('collectionId') }
          : platform === 'shopify'
            ? { shopDomain: v('shopDomain'), accessToken: v('accessToken') }
            : { url: v('url') };
    const path = platform === 'custom_webhook' ? 'webhook' : platform;
    setMsg({});
    start(async () => {
      const r = await apiAction<{ signingSecret?: string }>('POST', `/user/workspaces/${workspaceId}/integrations/${path}`, body);
      if (!r.ok) return setMsg({ error: r.message });
      if (r.data.signingSecret) setSigningSecret(r.data.signingSecret);
      setMsg({ ok: `${meta.name} connected.` });
      router.refresh();
    });
  };

  const run = (fn: () => Promise<{ ok: boolean; message?: string; data?: unknown }>, ok: string, after?: (d: unknown) => void) =>
    start(async () => {
      setMsg({});
      const r = await fn();
      if (!r.ok) return setMsg({ error: r.message });
      setMsg({ ok });
      after?.(r.data);
      router.refresh();
    });

  const submit = (
    <div className={c.connectRow}>
      <span>
        <Lock size={14} /> Credentials are stored encrypted and are never displayed after connection.
      </span>
      <Button type="submit" size="lg" disabled={!available || !workspaceId || pending} title={available ? undefined : 'Integrations are not configured on this server yet'}>
        {pending ? 'Connecting…' : 'Connect'}
      </Button>
    </div>
  );

  return (
    <div className={c.layout}>
      <div className={c.steps}>
        <Step n={1} title="Choose Your Platform" text="Select the platform where your website is hosted.">
          <div className={c.platforms} role="radiogroup" aria-label="Platform">
            {PLATFORMS.map((p) => (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={platform === p.key}
                className={`${c.platform} ${platform === p.key ? c.platformOn : ''}`}
                onClick={() => {
                  setPlatform(p.key);
                  setMsg({});
                }}
              >
                {p.icon}
                <span>
                  <strong>{p.name}</strong>
                  <span>{connections[p.key] ? `Connected · ${connections[p.key]!.account}` : p.text}</span>
                </span>
              </button>
            ))}
          </div>
        </Step>

        <Step n={2} title={`Connect ${meta.name}`} text="Connect securely; you can disconnect at any time.">
          {connection ? (
            <div className={c.info}>
              <Info size={18} />
              <span>
                Connected to <b>{connection.account}</b>. To use different credentials, disconnect and connect again.
              </span>
            </div>
          ) : (
            <form onSubmit={connect} key={platform}>
              {platform === 'wordpress' && (
                <>
                  <div className={c.info}>
                    <Info size={18} />
                    <span>In WordPress, go to Users → Profile → Application Passwords, create one for AmpliVerify and paste it below.</span>
                    <a href="/help?q=application%20password">Learn how to create an application password</a>
                  </div>
                  <div className={c.fields}>
                    <Field label="Site URL" htmlFor="wp-url" hint="For example: https://yourdomain.com">
                      <Input id="wp-url" name="siteUrl" type="url" required placeholder="Enter your WordPress site URL" autoComplete="url" />
                    </Field>
                    <Field label="Username" htmlFor="wp-user">
                      <Input id="wp-user" name="username" required placeholder="Enter your WordPress username" autoComplete="off" />
                    </Field>
                    <Secret id="wp-pass" name="password" label="Application Password" placeholder="xxxx xxxx xxxx xxxx xxxx xxxx" />
                  </div>
                </>
              )}
              {platform === 'webflow' && (
                <>
                  <div className={c.info}>
                    <Info size={18} />
                    <span>In Webflow, open Site settings → Apps & integrations → API access and generate a site token with CMS read and write access. The collection ID is in the CMS collection settings.</span>
                  </div>
                  <div className={c.fields}>
                    <Secret id="wf-token" name="apiToken" label="Site API token" placeholder="Paste the site token" />
                    <Field label="Collection ID" htmlFor="wf-col" hint="24 characters, e.g. 6512…">
                      <Input id="wf-col" name="collectionId" required pattern="[a-fA-F0-9]{24}" placeholder="Collection ID" autoComplete="off" />
                    </Field>
                  </div>
                </>
              )}
              {platform === 'shopify' && (
                <>
                  <div className={c.info}>
                    <Info size={18} />
                    <span>In Shopify admin, open Settings → Apps and sales channels → Develop apps, create an app with read/write access to online store content and pages, and install it to get an Admin API access token.</span>
                  </div>
                  <div className={c.fields}>
                    <Field label="Store address" htmlFor="sh-shop" hint="your-store.myshopify.com">
                      <Input id="sh-shop" name="shopDomain" required placeholder="your-store.myshopify.com" autoComplete="off" />
                    </Field>
                    <Secret id="sh-token" name="accessToken" label="Admin API access token" placeholder="shpat_…" />
                  </div>
                </>
              )}
              {platform === 'custom_webhook' && (
                <>
                  <div className={c.info}>
                    <Info size={18} />
                    <span>
                      We send a signed JSON <code>POST</code> to your https endpoint for each publish (<code>document.publish</code>) and a <code>ping</code> to verify it. Verify the <code>X-AmpliVerify-Signature</code> header (<code>t=…,v1=HMAC-SHA256(secret, &quot;t.body&quot;)</code>). Reply with <code>{'{ "id": "…", "url": "https://…" }'}</code> to link the published item.
                    </span>
                  </div>
                  <div className={c.fields}>
                    <Field label="Endpoint URL" htmlFor="wh-url" hint="Must be https and publicly reachable.">
                      <Input id="wh-url" name="url" type="url" required placeholder="https://your-site.com/hooks/ampliverify" />
                    </Field>
                  </div>
                </>
              )}
              {submit}
            </form>
          )}
          {signingSecret && (
            <div className={c.info} style={{ marginTop: 12 }}>
              <Lock size={18} />
              <span>
                Signing secret (shown once — store it now): <code style={{ wordBreak: 'break-all' }}>{signingSecret}</code>
              </span>
              <Button size="sm" variant="outline" icon={<Copy size={14} />} onClick={() => navigator.clipboard?.writeText(signingSecret)}>
                Copy
              </Button>
            </div>
          )}
        </Step>

        {platform === 'wordpress' ? (
          <Step n={3} title="Select a Page or Post" text="Choose the page or post you want to edit and publish.">
            <div className={c.contentTabs}>
              {(['pages', 'posts'] as const).map((t) => (
                <button key={t} className={contentTab === t ? c.contentTabOn : ''} onClick={() => setContentTab(t)}>
                  {t === 'pages' ? 'Pages' : 'Posts'}
                </button>
              ))}
              <form
                style={{ marginLeft: 'auto' }}
                onSubmit={(e) => {
                  e.preventDefault();
                  load();
                }}
              >
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${contentTab}...`} icon={<Search size={16} />} disabled={!wp} style={{ width: 260 }} aria-label="Search content" />
              </form>
            </div>
            <DataTable
              columns={['Title', 'URL', 'Status', 'Last Modified', '']}
              rows={items.map((it) => [
                <b key="t">{it.title}</b>,
                <a key="u" href={it.url} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontSize: 13, wordBreak: 'break-all' }}>
                  {it.url.replace(/^https?:\/\//, '')}
                </a>,
                it.status,
                new Date(it.modified).toLocaleDateString(),
                <Button key="s" size="sm" variant={selected?.id === it.id ? 'primary' : 'outline'} onClick={() => setSelected(it)}>
                  {selected?.id === it.id ? 'Selected' : 'Select'}
                </Button>,
              ])}
              empty={<EmptyState compact icon={<FileText size={26} />} title={wp ? `No ${contentTab} found` : `No ${contentTab} yet`} description={wp ? 'Try another search.' : 'Connect your WordPress site to load your pages.'} />}
            />
          </Step>
        ) : (
          <Step n={3} title="Write and Publish" text="Create or import a page in the On-Page SEO Editor, then publish it from the editor's publish menu.">
            <ButtonLink href="/app/editor" variant="outline" icon={<PencilLine size={16} />}>
              Open the On-Page SEO Editor
            </ButtonLink>
          </Step>
        )}
      </div>

      <div className={c.side}>
        <Panel title="Connection Summary" flushHead>
          <div className={c.summaryHead}>
            {meta.icon}
            <strong>{meta.name}</strong>
            <span className={c.notConnected}>{connection ? (connection.status === 'CONNECTED' ? 'Connected' : connection.status.toLowerCase()) : 'Not connected'}</span>
          </div>
          <div className={c.kv}>
            <span>Account</span>
            {connection?.account ?? '—'}
          </div>
          {platform === 'wordpress' && (
            <div className={c.kv}>
              <span>Selected Page</span>
              {selected?.title ?? '—'}
            </div>
          )}
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {platform === 'wordpress' && (
              <Button
                variant="secondary"
                icon={<PencilLine size={16} />}
                disabled={!selected || !projectId || pending}
                block
                onClick={() => selected && run(() => apiAction<{ id: string }>('POST', `/user/projects/${projectId}/editor/import`, { url: selected.url }), 'Opening the editor…', (d) => router.push(`/app/editor/${(d as { id: string }).id}`))}
              >
                Edit in SEO Editor
              </Button>
            )}
            <Button variant="secondary" icon={<Radio size={16} />} disabled={!connection || pending} block onClick={() => connection && run(() => apiAction<{ ok: boolean }>('POST', `/user/integrations/${connection.id}/test`, {}), 'Connection test finished.')}>
              Test Connection
            </Button>
            <Button variant="secondary" icon={<Trash2 size={16} />} disabled={!connection || pending} block onClick={() => connection && window.confirm(`Disconnect ${meta.name}?`) && run(() => apiAction('DELETE', `/user/integrations/${connection.id}`), 'Disconnected.')}>
              Disconnect
            </Button>
          </div>
          <ActionMessage error={msg.error} success={msg.ok} />
        </Panel>
        <Panel title="What Happens Next?" flushHead>
          {['Connect your website.', 'Write a page, or import one from your site.', 'Improve it in the On-Page SEO Editor with live SEO and AI search scoring.', 'Publish from the editor to push the optimized content to your site.'].map((t, i) => (
            <div key={t} className={c.next}>
              <span className={c.stepNum} style={{ width: 28, height: 28, fontSize: 13 }}>
                {i + 1}
              </span>
              <p>{t}</p>
            </div>
          ))}
        </Panel>
        <Panel>
          <div style={{ display: 'flex', gap: 12 }}>
            <CircleHelp size={28} color="var(--blue)" />
            <div>
              <h3 style={{ fontSize: 16 }}>Need Help?</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 12px' }}>Follow our step-by-step guide or contact support if you need assistance.</p>
              <ButtonLink href="/help?q=connect%20website" variant="outline" block>
                View Help Guide
              </ButtonLink>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
