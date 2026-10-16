'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cancelValuation } from '@/lib/public-actions';
import site from '../site.module.css';

/** Cancels a queued valuation (any credit reservation is released). */
export function CancelButton({ id, token }: { id: string; token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div style={{ marginTop: 14 }}>
      <button
        type="button"
        className={`${site.btnOutline} ${site.sm}`}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await cancelValuation(id, token);
            if (!r.ok) return setError(r.message);
            router.refresh();
          })
        }
      >
        {pending ? 'Cancelling…' : 'Cancel'}
      </button>
      {error && (
        <p role="alert" style={{ color: '#b42318', fontSize: 13, marginTop: 8 }}>
          {error}
        </p>
      )}
    </div>
  );
}
