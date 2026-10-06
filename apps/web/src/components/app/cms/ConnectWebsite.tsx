'use client';

import { useState } from 'react';
import { CircleHelp, Code2, Eye, EyeOff, FileText, Info, Lock, PencilLine, Plug, Puzzle, Radio, Search, Trash2 } from 'lucide-react';
import { Badge, Button, ButtonLink, DataTable, EmptyState, Field, Input, Panel } from '@/components/ui';
import c from './cms.module.css';

type Platform = 'wordpress' | 'webflow' | 'shopify' | 'custom';
const PLATFORMS: { key: Platform; name: string; text: string; icon: React.ReactNode; available: boolean }[] = [
  { key: 'wordpress', name: 'WordPress', text: 'Connect your WordPress site', icon: <span className={c.wp}>W</span>, available: true },
  { key: 'webflow', name: 'Webflow', text: 'Coming soon', icon: <span className={c.logo} style={{ color: '#4353ff' }}>W</span>, available: false },
  { key: 'shopify', name: 'Shopify', text: 'Coming soon', icon: <span className={c.logo} style={{ color: '#5e8e3e' }}>S</span>, available: false },
  { key: 'custom', name: 'Custom (API)', text: 'Coming soon', icon: <Code2 size={30} />, available: false },
];

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
 * WordPress connection flow. Credentials would be stored as a secret
 * reference (integration_tokens), never in plain text. The connection API is
 * not built yet, so Connect / Test / Disconnect are disabled and no
 * credentials leave the browser.
 */
export function ConnectWebsite() {
  const [platform, setPlatform] = useState<Platform>('wordpress');
  const [method, setMethod] = useState<'password' | 'plugin'>('password');
  const [showPassword, setShowPassword] = useState(false);
  const [contentTab, setContentTab] = useState('Pages');

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
                disabled={!p.available}
                className={`${c.platform} ${platform === p.key ? c.platformOn : ''}`}
                onClick={() => setPlatform(p.key)}
              >
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
          <div className={c.methods} role="tablist">
            <button role="tab" aria-selected={method === 'password'} className={method === 'password' ? c.methodOn : ''} onClick={() => setMethod('password')}>
              <Lock size={16} /> Application Password (Recommended)
            </button>
            <button role="tab" aria-selected={method === 'plugin'} className={method === 'plugin' ? c.methodOn : ''} onClick={() => setMethod('plugin')}>
              <Puzzle size={16} /> Plugin Connection
            </button>
          </div>
          {method === 'password' ? (
            <>
              <div className={c.info}>
                <Info size={18} />
                <span>Use a WordPress Application Password to securely connect without installing a plugin.</span>
                <a href="/help?q=application%20password">Learn how to create an application password</a>
              </div>
              <div className={c.fields}>
                <Field label="Site URL" htmlFor="wp-url" hint="For example: https://yourdomain.com">
                  <Input id="wp-url" type="url" placeholder="Enter your WordPress site URL" autoComplete="url" />
                </Field>
                <Field label="Username" htmlFor="wp-user">
                  <Input id="wp-user" placeholder="Enter your WordPress username" autoComplete="off" />
                </Field>
                <Field label="Application Password" htmlFor="wp-pass">
                  <div style={{ position: 'relative' }}>
                    <Input id="wp-pass" type={showPassword ? 'text' : 'password'} placeholder="Enter your application password" autoComplete="new-password" />
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
                <Button size="lg" disabled title="Website connections are not available yet">
                  Connect Site
                </Button>
              </div>
            </>
          ) : (
            <EmptyState compact icon={<Plug size={24} />} title="Plugin connection is coming soon" description="Use an Application Password to connect today." />
          )}
        </Step>

        <Step n={3} title="Select a Page or Post" text="Choose the page or post you want to edit and publish.">
          <div className={c.contentTabs}>
            {['Pages', 'Posts', 'Custom Post Types'].map((t) => (
              <button key={t} className={contentTab === t ? c.contentTabOn : ''} onClick={() => setContentTab(t)}>
                {t}
              </button>
            ))}
            <Input placeholder={`Search ${contentTab.toLowerCase()}...`} icon={<Search size={16} />} disabled style={{ marginLeft: 'auto', width: 260 }} aria-label="Search pages" />
          </div>
          <DataTable
            columns={['Title', 'URL', 'Last Modified']}
            empty={<EmptyState compact icon={<FileText size={26} />} title={`No ${contentTab.toLowerCase()} found`} description="Connect your WordPress site to load your pages." />}
          />
        </Step>
      </div>

      <div className={c.side}>
        <Panel title="Connection Summary" flushHead>
          <div className={c.summaryHead}>
            <span className={c.wp}>W</span>
            <strong>WordPress</strong>
            <span className={c.notConnected}>Not connected</span>
          </div>
          {['Site URL', 'Username', 'Selected Page'].map((k) => (
            <div key={k} className={c.kv}>
              <span>{k}</span>—
            </div>
          ))}
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            <Button variant="secondary" icon={<PencilLine size={16} />} disabled block>
              Change Page
            </Button>
            <Button variant="secondary" icon={<Radio size={16} />} disabled block>
              Test Connection
            </Button>
            <Button variant="secondary" icon={<Trash2 size={16} />} disabled block>
              Disconnect
            </Button>
          </div>
        </Panel>
        <Panel title="What Happens Next?" flushHead>
          {[
            'Connect your website or CMS using your credentials.',
            'Select the page or post you want to edit and publish.',
            'Your connection will be saved for future use.',
            'Return to the On-Page SEO Editor and click Publish to push your optimized content to your website.',
          ].map((t, i) => (
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
