'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useState, useTransition } from 'react';
import { Heart } from 'lucide-react';
import { toast } from 'sonner';
import { apiAction } from '@/lib/actions';
import { Button, type ButtonVariant } from '../ui';
import { ActionMessage, ApiForm } from '../ui/actions';
import m from './market.module.css';

const toMinor = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) : v === '' ? null : v);

/**
 * ApiForm for money: the listed fields are entered in major units (e.g.
 * dollars) and sent in minor units. Serializable props, so server pages can use it.
 */
export function MinorForm({
  minorFields,
  dropEmpty,
  ...props
}: Omit<React.ComponentProps<typeof ApiForm>, 'transform'> & { minorFields: string[]; dropEmpty?: string[] }) {
  return (
    <ApiForm
      {...props}
      transform={(values) => {
        const out: Record<string, unknown> = { ...values };
        for (const f of minorFields) if (f in out) out[f] = toMinor(out[f]);
        for (const f of dropEmpty ?? []) if (out[f] === null || out[f] === '' || (Array.isArray(out[f]) && !(out[f] as unknown[]).length)) delete out[f];
        return out;
      }}
    />
  );
}

/** Heart toggle on a listing (saved listings, V2 guide §3.4). */
export function SaveButton({ listingId, saved, label }: { listingId: string; saved: boolean; label?: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(saved);
  const [pending, start] = useTransition();
  const toggle = () =>
    start(async () => {
      const next = !on;
      setOn(next);
      const r = await apiAction('PUT', `/user/marketplace/listings/${listingId}/save`, { saved: next });
      if (!r.ok) {
        setOn(!next);
        toast.error(r.message);
        return;
      }
      toast.success(next ? 'Saved to your listings.' : 'Removed from saved listings.', next ? undefined : { action: { label: 'Undo', onClick: () => void apiAction('PUT', `/user/marketplace/listings/${listingId}/save`, { saved: true }).then(() => router.refresh()) } });
      router.refresh();
    });
  if (label)
    return (
      <Button variant="outline" icon={<Heart size={16} fill={on ? 'currentColor' : 'none'} />} onClick={toggle} loading={pending} aria-pressed={on}>
        {on ? 'Saved' : 'Save listing'}
      </Button>
    );
  return (
    <button type="button" className={m.saveBtn} aria-pressed={on} aria-label={on ? 'Remove from saved listings' : 'Save listing'} onClick={toggle} disabled={pending}>
      <Heart size={18} fill={on ? 'currentColor' : 'none'} />
    </button>
  );
}

/** Licence and refund disclosures, then consent, then Stripe Checkout (V2 guide §3.2–§3.3). */
export function CheckoutForm({ listingId, price, withdrawal }: { listingId: string; price: string; withdrawal: boolean }) {
  const [license, setLicense] = useState(false);
  const [refund, setRefund] = useState(false);
  const [waiver, setWaiver] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ready = license && refund && (!withdrawal || waiver);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        setError(null);
        start(async () => {
          const r = await apiAction<{ url: string }>('POST', `/user/marketplace/listings/${listingId}/checkout`, { license, refundPolicy: refund, withdrawalWaiver: waiver });
          if (!r.ok) {
            setError(r.message);
            toast.error(r.message);
            return;
          }
          window.location.assign(r.data.url);
        });
      }}
    >
      <ul className={m.checks}>
        <li>
          <label>
            <input type="checkbox" checked={license} onChange={(e) => setLicense(e.target.checked)} required />
            <span>I have read and accept the licence terms for this product.</span>
          </label>
        </li>
        <li>
          <label>
            <input type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} required />
            <span>
              I have read the <a href="/digital-product-refund-policy" target="_blank" rel="noreferrer">Digital Product Refund Policy</a>.
            </span>
          </label>
        </li>
        {withdrawal && (
          <li>
            <label>
              <input type="checkbox" checked={waiver} onChange={(e) => setWaiver(e.target.checked)} />
              <span>I ask for immediate access to the files and understand that, where the law allows, this affects my right to withdraw once the download begins. My statutory rights are otherwise unaffected.</span>
            </label>
          </li>
        )}
      </ul>
      <div className={m.actions} style={{ marginTop: 16 }}>
        <Button type="submit" disabled={!ready} loading={pending}>
          {pending ? 'Opening secure checkout…' : `Continue to secure checkout · ${price}`}
        </Button>
        <ActionMessage error={error} />
      </div>
    </form>
  );
}

/** A button that asks for a written note before calling the API (decline, cancel, reject). */
export function NoteAction({
  path,
  body,
  label,
  noteField = 'note',
  placeholder = 'Reason (required)',
  required = true,
  variant = 'outline',
  successMessage = 'Done.',
  confirm,
}: {
  path: string;
  body?: Record<string, unknown>;
  label: ReactNode;
  noteField?: string;
  placeholder?: string;
  required?: boolean;
  variant?: ButtonVariant;
  successMessage?: string;
  confirm?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!open)
    return (
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={1000}
        style={{ minWidth: 220, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line, #e3e9f1)', font: 'inherit' }}
      />
      <Button
        size="sm"
        variant={variant === 'outline' ? 'primary' : variant}
        loading={pending}
        disabled={required && note.trim().length < 3}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => {
            setError(null);
            const r = await apiAction('POST', path, { ...(body ?? {}), [noteField]: note.trim() || undefined });
            if (!r.ok) {
              setError(r.message);
              toast.error(r.message);
              return;
            }
            toast.success(successMessage);
            setOpen(false);
            setNote('');
            router.refresh();
          });
        }}
      >
        Confirm
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <ActionMessage error={error} />
    </span>
  );
}
