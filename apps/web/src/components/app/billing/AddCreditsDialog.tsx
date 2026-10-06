'use client';

import { useEffect, useRef, useState } from 'react';
import { CreditCard, Database, Lock, Plus, X } from 'lucide-react';
import { Badge, Button, EmptyState, Input } from '@/components/ui';
import b from './billing.module.css';

/** A purchasable pack as configured in billing (credits + price in minor units). */
export type CreditPack = { id: string; credits: number; amountMinor: number; currency: string; bestValue?: boolean };

const money = (minor: number, currency: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100);

/**
 * "Add Credits" dialog. Packs, minimums and prices come only from billing
 * configuration (`packs`); payment is handled by the payment provider. With no
 * configured packs the dialog says so, and checkout stays disabled until the
 * purchase API exists.
 */
export function AddCreditsButton({
  packs,
  balance,
  label = 'Add Credits',
  variant = 'primary',
  icon = <Plus size={18} />,
  size = 'lg',
}: {
  packs: CreditPack[];
  balance: number | null;
  label?: string;
  variant?: 'primary' | 'outline';
  icon?: React.ReactNode;
  size?: 'md' | 'lg';
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(packs[0]?.id ?? null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  const pack = packs.find((p) => p.id === selected) ?? null;

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
                    <small>
                      {money(p.amountMinor / p.credits, p.currency)}/credit
                    </small>
                  </button>
                ))}
              </div>
            )}
            <div className={b.or}>or</div>
            <label className={b.label} htmlFor="custom-credits">
              Custom Amount <small>(Optional)</small>
            </label>
            <Input id="custom-credits" type="number" placeholder="Enter credits" disabled={packs.length === 0} />
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
            <Button block icon={<CreditCard size={16} />} disabled title="Checkout is not available yet">
              Continue to Payment
            </Button>
            <Button block variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <p className={b.secure}>
              <Lock size={14} /> Secure payment processing by our payment provider. Credits are added to your account after successful payment.
            </p>
          </aside>
        </div>
      </dialog>
    </>
  );
}
