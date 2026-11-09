import Link from 'next/link';
import type { ReactNode } from 'react';
import { BadgeCheck, ImageIcon } from 'lucide-react';
import { Badge, Panel } from '../ui';
import { StateView } from '../ui/StateView';
import { assetLabel, kindLabel, type ListingCard as Card, mediaSrc, money, statusOf } from '@/lib/marketplace';
import { SaveButton } from './forms';
import m from './market.module.css';

type LabelMap = Record<string, { label: string; tone?: 'blue' | 'green' | 'amber' }>;

export function StatusBadge({ map, value }: { map: LabelMap; value: string | null | undefined }) {
  const s = statusOf(map, value);
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

/** A listing tile. Seller-reported figures are labelled as such. */
export function ListingTile({ l, href, save = true }: { l: Card; href: string; save?: boolean }) {
  const cover = mediaSrc(l.cover);
  return (
    <article className={m.card}>
      <div className={m.cover}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {cover ? <img src={cover} alt="" loading="lazy" /> : <ImageIcon size={36} aria-hidden />}
      </div>
      {save && l.saved !== undefined && (
        <div className={m.saveSlot}>
          <SaveButton listingId={l.id} saved={l.saved} />
        </div>
      )}
      <div className={m.cardBody}>
        <div className={m.badges}>
          <Badge tone="green">{l.category ?? assetLabel(l.assetType)}</Badge>
          <Badge>{kindLabel(l.kind)}</Badge>
          {l.aiGenerated && <Badge tone="amber">AI-assisted</Badge>}
        </div>
        <h3>
          <Link href={href}>{l.title}</Link>
        </h3>
        <p>{l.summary}</p>
        <span className={m.meta}>
          {l.monthlyRevenueMinor !== null && <span>Revenue {money(l.monthlyRevenueMinor, l.currency)}/mo (seller-reported)</span>}
          {l.monthlyVisitors !== null && <span>{l.monthlyVisitors.toLocaleString('en-US')} visitors/mo (seller-reported)</span>}
          {l.seller && (
            <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              {l.seller.displayName}
              {l.seller.identityVerified && <BadgeCheck size={14} aria-label="Identity verified" color="#059669" />}
            </span>
          )}
        </span>
        <span className={m.price}>{money(l.askingPriceMinor, l.currency)}</span>
      </div>
    </article>
  );
}

export function LoadError({ what }: { what: string }) {
  return (
    <Panel>
      <StateView kind="error" title={`${what} could not be loaded`} description="Please try again shortly." />
    </Panel>
  );
}

export function Empty({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <Panel>
      <StateView kind="empty" icon={icon} title={title} description={description} action={action} />
    </Panel>
  );
}

/** Filter links styled as pills (status tabs on list pages). */
export function Pills({ items, active, label = 'Filter' }: { items: { key: string; label: string; href: string }[]; active: string; label?: string }) {
  return (
    <nav aria-label={label} className={m.pills}>
      {items.map((i) => (
        <Link key={i.key} href={i.href} className={`${m.pill} ${i.key === active ? m.pillActive : ''}`} aria-current={i.key === active ? 'page' : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

const DEAL_STEPS = [
  { key: 'AGREEMENT_PENDING', title: 'Agreement', hint: 'Both parties confirm the accepted terms.' },
  { key: 'DUE_DILIGENCE', title: 'Due diligence', hint: 'The buyer reviews traffic, finances and access.' },
  { key: 'TRANSFER_IN_PROGRESS', title: 'Transfer', hint: 'The seller hands over domains, code and accounts.' },
  { key: 'COMPLETED', title: 'Completed', hint: 'The buyer confirms everything was received.' },
];

/** Acquisition stages: agreement → due diligence → transfer → completion (V2 guide §3.2). */
export function DealStages({ status }: { status: string }) {
  const at = DEAL_STEPS.findIndex((s) => s.key === status);
  return (
    <ol className={m.steps} aria-label="Transaction stages">
      {DEAL_STEPS.map((s, i) => (
        <li key={s.key} className={`${m.step} ${at > i || status === 'COMPLETED' ? m.stepDone : at === i ? m.stepNow : ''}`} aria-current={at === i ? 'step' : undefined}>
          <b>
            {i + 1}. {s.title}
          </b>
          {s.hint}
        </li>
      ))}
    </ol>
  );
}

export const shortDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' }) : '—');
