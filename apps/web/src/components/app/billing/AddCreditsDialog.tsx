'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { CreditCard, Database, Lock, Plus, X } from 'lucide-react';
import { apiAction } from '@/lib/actions';
import { Badge, Button, EmptyState } from '@/components/ui';
import b from './billing.module.css';

/** A purchasable pack as configured in billing (credits + price in minor units). */
export type CreditPack = { id: string; credits: number; amountMinor: number; currency: string; bestValue?: boolean };

const money = (minor: number, currency: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100);

/** Maps the API's configured packs (Super Admin → credit packs) to dialog packs. */
export function toPacks(packs: { code: string; credits: number; amountMinor: number; currency: string }[]): CreditPack[] {
  const perCredit = packs.map((p) => p.amountMinor / p.credits);
  const best = Math.min(...perCredit);
  return packs.map((p, i) => ({ id: p.code, credits: p.credits, amountMinor: p.amountMinor, currency: p.currency, bestValue: packs.length > 1 && perCredit[i] === best }));
}

/**
 * "Add Credits" dialog. Packs and prices come only from billing configuration;
 * checkout goes to Stripe and credits are added by the verified payment
 * webhook. With no packs, or payments not enabled, the dialog says so.
 */
export function AddCreditsButton({
  packs,
  balance,
  workspaceId,
  paymentsEnabled = false,
  label = 'Add Credits',
  variant = 'primary',
  icon = <Plus size={18} />,
  size = 'lg',
}: {
  packs: CreditPack[];
  balance: number | null;
  workspaceId?: string | null;
  paymentsEnabled?: boolean;
  label?: string;
  variant?: 'primary' | 'outline';
  icon?: React.ReactNode;
  size?: 'md' | 'lg';
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(packs[0]?.id ?? null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  const pack = packs.find((p) => p.id === selected) ?? null;
  const checkout = () =>
    start(async () => {
      if (!pack || !workspaceId) return;
      setError(null);
      const r = await apiAction<{ url: string }>('POST', `/user/workspaces/${workspaceId}/credits/checkout`, { packCode: pack.id });
      if (!r.ok) return setError(r.message);
      window.location.assign(r.data.url);
    });

  return (
    <>
      <Button icon={icon} size={size} variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <dialog ref={dialog} className={b.dialog} onClose={() => setOpen(false)} aria-labelledby="add-credits-title">
        <div className={b.dialogHead}>
          <span className={b.dbIcon}>
            <Database size={22} />
          </span>
          <div>
            <h2 id="add-credits-title">Add Credits</h2>
            <p>Purchase additional credits to use AI-powered features, content generation, and premium tools.</p>
          </div>
          <button className={b.close} aria-label="Close" onClick={() => setOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <div className={b.dialogBody}>
          <div>
            <h3>Select a Credit Pack</h3>
            {packs.length === 0 ? (
              <EmptyState compact icon={<Database size={22} />} title="No credit packs available" description="Credit packs for your plan will be shown here when they are offered." />
            ) : (
              <div className={b.packs} role="radiogroup" aria-label="Credit pack">
                {packs.map((p) => (
                  <button key={p.id} role="radio" aria-checked={selected === p.id} className={`${b.pack} ${selected === p.id ? b.packOn : ''}`} onClick={() => setSelected(p.id)}>
                    {p.bestValue && (
                      <span className={b.best}>
                        <Badge tone="blue">Best Value</Badge>
                      </span>
                    )}
                    <strong>{p.credits.toLocaleString('en-US')}</strong>
                    <span>Credits</span>
                    <b>{money(p.amountMinor, p.currency)}</b>
                    <small>{money(p.amountMinor / p.credits, p.currency)}/credit</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <aside className={b.summary}>
            <h3>Purchase Summary</h3>
            <div>
              <span>Current Balance</span>
              <b>{balance === null ? '—' : `${balance.toLocaleString('en-US')} credits`}</b>
            </div>
            <div>
              <span>Credits to Purchase</span>
              <b>{pack ? `${pack.credits.toLocaleString('en-US')} credits` : '—'}</b>
            </div>
            <div>
              <span>Price</span>
              <b>{pack ? money(pack.amountMinor, pack.currency) : '—'}</b>
            </div>
            <div className={b.total}>
              <span>New Balance (after purchase)</span>
              <b>{pack && balance !== null ? `${(balance + pack.credits).toLocaleString('en-US')} credits` : '—'}</b>
            </div>
            <Button block icon={<CreditCard size={16} />} disabled={!pack || !workspaceId || !paymentsEnabled || pending} title={paymentsEnabled ? undefined : 'Online payments are not available yet'} onClick={checkout}>
              {pending ? 'Redirecting…' : 'Continue to Payment'}
            </Button>
            <Button block variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {error && (
              <p role="alert" style={{ color: 'var(--red)', fontSize: 13 }}>
                {error}
              </p>
            )}
            {!paymentsEnabled && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Online payments are not enabled yet.</p>}
            <p className={b.secure}>
              <Lock size={14} /> Secure payment processing by our payment provider. Credits are added to your account after successful payment.
            </p>
          </aside>
        </div>
      </dialog>
    </>
  );
}
