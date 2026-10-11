'use client';

import { useState, useTransition } from 'react';
import { ArrowRight, Check, Link2, ThumbsDown, ThumbsUp } from 'lucide-react';
import { postComment, subscribeNewsletter, voteArticle } from '@/lib/public-actions';
import s from './site.module.css';

/** Newsletter sign-up (double opt-in). Hidden "website" field is a bot honeypot. */
export function NewsletterForm({ source, compact = false, buttonLabel = 'Subscribe' }: { source: string; compact?: boolean; buttonLabel?: string }) {
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (state?.ok) {
    return (
      <p className={s.formNote} role="status">
        <Check size={16} /> {state.text}
      </p>
    );
  }
  return (
    <form
      className={compact ? s.newsCompact : s.newsForm}
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const r = await subscribeNewsletter({ email: String(f.get('email') ?? ''), source, website: String(f.get('website') ?? '') });
          setState(r.ok ? { ok: true, text: 'Almost done — check your inbox to confirm your subscription.' } : { ok: false, text: r.message });
        });
      }}
    >
      <input type="email" name="email" required maxLength={254} placeholder="Your email address" aria-label="Email address" className={s.input} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className={s.hp} />
      <button type="submit" className={`${s.btn} ${compact ? s.sm : ''}`} disabled={pending}>
        {pending ? 'Subscribing…' : buttonLabel} <ArrowRight size={16} />
      </button>
      {state && !state.ok && (
        <p className={s.formError} role="alert">
          {state.text}
        </p>
      )}
    </form>
  );
}

/** Copy-link button for the share row. */
export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={s.shareBtn}
      aria-label={copied ? 'Link copied' : 'Copy link'}
      title={copied ? 'Copied' : 'Copy link'}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <Check size={16} /> : <Link2 size={16} />}
    </button>
  );
}

/** "Was this article helpful?" */
export function HelpfulVote({ kind, slug }: { kind: 'blog' | 'guides'; slug: string }) {
  const [voted, setVoted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const vote = (helpful: boolean) =>
    start(async () => {
      setError(null);
      const r = await voteArticle(kind, slug, helpful);
      if (r.ok) setVoted(helpful);
      else setError(r.message);
    });
  if (voted !== null) {
    return (
      <p className={s.formNote} role="status">
        <Check size={16} /> Thanks for your feedback!
      </p>
    );
  }
  return (
    <>
      <div className={s.voteRow}>
        <button type="button" className={s.btnOutline} disabled={pending} onClick={() => vote(true)}>
          <ThumbsUp size={16} /> Yes
        </button>
        <button type="button" className={s.btnOutline} disabled={pending} onClick={() => vote(false)}>
          <ThumbsDown size={16} /> No
        </button>
      </div>
      {error && (
        <p className={s.formError} role="alert">
          {error}
        </p>
      )}
    </>
  );
}

/** Comment form; comments appear after moderation. */
export function CommentForm({ kind, slug }: { kind: 'blog' | 'guides'; slug: string }) {
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (state?.ok) {
    return (
      <p className={s.formNote} role="status">
        <Check size={16} /> {state.text}
      </p>
    );
  }
  return (
    <form
      className={s.form}
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const r = await postComment(kind, slug, { name: String(f.get('name') ?? ''), email: String(f.get('email') ?? ''), body: String(f.get('body') ?? ''), website: String(f.get('website') ?? '') });
          setState(r.ok ? { ok: true, text: 'Thanks! Your comment will appear once it has been reviewed.' } : { ok: false, text: r.message });
        });
      }}
    >
      <label>
        Name <input className={s.input} name="name" required maxLength={80} autoComplete="name" />
      </label>
      <label>
        Email <span style={{ fontWeight: 400, color: 'var(--mute)' }}>(not published)</span>
        <input className={s.input} name="email" type="email" required maxLength={254} autoComplete="email" />
      </label>
      <label className={s.full}>
        Comment <textarea className={s.input} name="body" required minLength={2} maxLength={3000} />
      </label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className={s.hp} />
      <div className={s.full} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="submit" className={s.btn} disabled={pending}>
          {pending ? 'Posting…' : 'Post Comment'}
        </button>
        {state && !state.ok && (
          <span className={s.formError} role="alert">
            {state.text}
          </span>
        )}
      </div>
    </form>
  );
}
