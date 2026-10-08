'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CircleHelp, Code2, Eye, EyeOff, FileText, Info, Lock, PencilLine, Plug, Puzzle, Radio, Search, Trash2 } from 'lucide-react';
import { Badge, Button, ButtonLink, DataTable, EmptyState, Field, Input, Panel } from '@/components/ui';
import { ActionMessage } from '@/components/ui/actions';
import { apiAction, apiQuery } from '@/lib/actions';
import c from './cms.module.css';

type Platform = 'wordpress' | 'webflow' | 'shopify' | 'custom';
const PLATFORMS: { key: Platform; name: string; text: string; icon: React.ReactNode; available: boolean }[] = [
  { key: 'wordpress', name: 'WordPress', text: 'Connect your WordPress site', icon: <span className={c.wp}>W</span>, available: true },
  { key: 'webflow', name: 'Webflow', text: 'Coming soon', icon: <span className={c.logo} style={{ color: '#4353ff' }}>W</span>, available: false },
  { key: 'shopify', name: 'Shopify', text: 'Coming soon', icon: <span className={c.logo} style={{ color: '#5e8e3e' }}>S</span>, available: false },
  { key: 'custom', name: 'Custom (API)', text: 'Coming soon', icon: <Code2 size={30} />, available: false },
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

/**
 * WordPress connection flow. Credentials are verified against the site's REST
 * API, then stored encrypted (integration_tokens) and never shown again.
 * After connecting, pages/posts can be opened in the On-Page SEO Editor.
 */
export function ConnectWebsite({ workspaceId, projectId, connection, available }: { workspaceId: string | null; projectId: string | null; connection: WpConnection | null; available: boolean }) {
  const router = useRouter();
  const [platform, setPlatform] = useState<Platform>('wordpress');
  const [method, setMethod] = useState<'password' | 'plugin'>('password');
  const [showPassword, setShowPassword] = useState(false);
  const [contentTab, setContentTab] = useState<'pages' | 'posts'>('pages');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<WpItem[]>([]);
  const [selected, setSelected] = useState<WpItem | null>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});

  const load = useCallback(() => {
    if (!connection) return;
    start(async () => {
      const r = await apiQuery<WpItem[]>(`/user/integrations/${connection.id}/wordpress/content?type=${contentTab}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
      if (!r.ok) return setMsg({ error: r.message });
      setItems(r.data);
    });
  }, [connection, contentTab, q]);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, contentTab]);

  const connect = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setMsg({});
    start(async () => {
      const r = await apiAction('POST', `/user/workspaces/${workspaceId}/integrations/wordpress`, { siteUrl: String(f.get('siteUrl')), username: String(f.get('username')), applicationPassword: String(f.get('password')) });
      if (!r.ok) return setMsg({ error: r.message });
      setMsg({ ok: 'WordPress connected.' });
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

  return (
    <div className={c.layout}>
      <div className={c.steps}>
        <Step n={1} title="Choose Your Platform" text="Select the platform where your website is hosted.">
          <div className={c.platforms} role="radiogroup" aria-label="Platform">
            {PLATFORMS.map((p) => (
              <button key={p.key} type="button" role="radio" aria-checked={platform === p.key} disabled={!p.available} className={`${c.platform} ${platform === p.key ? c.platformOn : ''}`} onClick={() => setPlatform(p.key)}>
                {p.icon}
                <span>
                  <strong>{p.name}</strong>
                  <span>{p.text}</span>
                  {!p.available && <Badge tone="blue">Coming Soon</Badge>}
                </span>
              </button>
            ))}
          </div>
        </Step>

        <Step n={2} title="Connect to Your WordPress Site" text="Choose a connection method to securely connect your WordPress site.">
          {connection ? (
            <div className={c.info}>
              <Info size={18} />
              <span>
                Connected to <b>{connection.account}</b>. To use different credentials, disconnect and connect again.
              </span>
            </div>
          ) : (
            <>
              <div className={c.methods} role="tablist">
                <button role="tab" aria-selected={method === 'password'} className={method === 'password' ? c.methodOn : ''} onClick={() => setMethod('password')}>
                  <Lock size={16} /> Application Password (Recommended)
                </button>
                <button role="tab" aria-selected={method === 'plugin'} className={method === 'plugin' ? c.methodOn : ''} onClick={() => setMethod('plugin')}>
                  <Puzzle size={16} /> Plugin Connection
                </button>
              </div>
              {method === 'password' ? (
                <form onSubmit={connect}>
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
                    <Field label="Application Password" htmlFor="wp-pass">
                      <div style={{ position: 'relative' }}>
                        <Input id="wp-pass" name="password" required minLength={8} type={showPassword ? 'text' : 'password'} placeholder="xxxx xxxx xxxx xxxx xxxx xxxx" autoComplete="new-password" />
                        <button type="button" className={c.eye} aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((v) => !v)}>
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </Field>
                  </div>
                  <div className={c.connectRow}>
                    <span>
                      <Lock size={14} /> Credentials are stored encrypted and are never displayed after connection.
                    </span>
                    <Button type="submit" size="lg" disabled={!available || !workspaceId || pending} title={available ? undefined : 'Integrations are not available yet'}>
                      {pending ? 'Connecting…' : 'Connect Site'}
                    </Button>
                  </div>
                </form>
              ) : (
                <EmptyState compact icon={<Plug size={24} />} title="Plugin connection is coming soon" description="Use an Application Password to connect today." />
              )}
            </>
          )}
        </Step>

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
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${contentTab}...`} icon={<Search size={16} />} disabled={!connection} style={{ width: 260 }} aria-label="Search content" />
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
            empty={<EmptyState compact icon={<FileText size={26} />} title={connection ? `No ${contentTab} found` : `No ${contentTab} yet`} description={connection ? 'Try another search.' : 'Connect your WordPress site to load your pages.'} />}
          />
        </Step>
      </div>

      <div className={c.side}>
        <Panel title="Connection Summary" flushHead>
          <div className={c.summaryHead}>
            <span className={c.wp}>W</span>
            <strong>WordPress</strong>
            <span className={c.notConnected}>{connection ? (connection.status === 'CONNECTED' ? 'Connected' : connection.status.toLowerCase()) : 'Not connected'}</span>
          </div>
          <div className={c.kv}>
            <span>Site</span>
            {connection?.account ?? '—'}
          </div>
          <div className={c.kv}>
            <span>Selected Page</span>
            {selected?.title ?? '—'}
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            <Button
              variant="secondary"
              icon={<PencilLine size={16} />}
              disabled={!selected || !projectId || pending}
              block
              onClick={() => selected && run(() => apiAction<{ id: string }>('POST', `/user/projects/${projectId}/editor/import`, { url: selected.url }), 'Opening the editor…', (d) => router.push(`/app/editor/${(d as { id: string }).id}`))}
            >
              Edit in SEO Editor
            </Button>
            <Button variant="secondary" icon={<Radio size={16} />} disabled={!connection || pending} block onClick={() => connection && run(() => apiAction('POST', `/user/integrations/${connection.id}/test`, {}), 'Connection test finished.')}>
              Test Connection
            </Button>
            <Button
              variant="secondary"
              icon={<Trash2 size={16} />}
              disabled={!connection || pending}
              block
              onClick={() => connection && window.confirm('Disconnect this site?') && run(() => apiAction('DELETE', `/user/integrations/${connection.id}`), 'Disconnected.')}
            >
              Disconnect
            </Button>
          </div>
          <ActionMessage error={msg.error} success={msg.ok} />
        </Panel>
        <Panel title="What Happens Next?" flushHead>
          {['Connect your website using an application password.', 'Select the page or post you want to improve.', 'Edit it in the On-Page SEO Editor with live SEO and AI search scoring.', 'Click Publish in the editor to push the optimized content back to WordPress.'].map((t, i) => (
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
