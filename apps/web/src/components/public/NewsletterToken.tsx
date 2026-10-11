'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { newsletterToken } from '@/lib/public-actions';
import s from './site.module.css';

/**
 * Newsletter confirm / unsubscribe. The action runs on a button press (not on
 * page load), so link scanners and prefetchers cannot change the subscription.
 */
export function NewsletterToken({ action, token }: { action: 'confirm' | 'unsubscribe'; token: string }) {
  const [done, setDone] = useState<{ unsubscribeToken?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done) {
    return (
      <div className={s.card} style={{ textAlign: 'center', display: 'grid', gap: 12, justifyItems: 'center' }}>
        <CheckCircle2 size={36} color="#15803d" />
        <h2 className={s.cardTitle}>{action === 'confirm' ? 'You’re subscribed!' : 'You’ve been unsubscribed'}</h2>
        <p className={s.cardText}>{action === 'confirm' ? 'Thanks for confirming. You’ll get one useful SEO idea every two weeks.' : 'You won’t receive any more newsletter emails.'}</p>
        {done.unsubscribeToken && (
          <p className={s.cardText} style={{ fontSize: 13 }}>
            Changed your mind later?{' '}
            <Link href={`/newsletter/unsubscribe?token=${encodeURIComponent(done.unsubscribeToken)}`} style={{ color: 'var(--g900)', textDecoration: 'underline' }}>
              Unsubscribe here
            </Link>{' '}
            (bookmark this link).
          </p>
        )}
        <Link href="/blog" className={s.btnOutline}>
          Read the Blog
        </Link>
      </div>
    );
  }
  return (
    <div className={s.card} style={{ textAlign: 'center', display: 'grid', gap: 14, justifyItems: 'center' }}>
      <h2 className={s.cardTitle}>{action === 'confirm' ? 'Confirm your subscription' : 'Unsubscribe from the newsletter'}</h2>
      <p className={s.cardText}>{action === 'confirm' ? 'Press the button to start receiving SEO tips, guides and product updates from AmpliVerify.' : 'Press the button to stop receiving newsletter emails.'}</p>
      <button
        type="button"
        className={s.btn}
        disabled={pending || !token}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await newsletterToken(action, token);
            if (r.ok) setDone({ unsubscribeToken: r.data.unsubscribeToken });
            else setError(r.message);
          })
        }
      >
        {pending ? 'Working…' : action === 'confirm' ? 'Confirm Subscription' : 'Unsubscribe'}
      </button>
      {(error || !token) && (
        <p className={s.formError} role="alert">
          {error ?? 'This link is incomplete. Open the link from your email again.'}
        </p>
      )}
    </div>
  );
}
