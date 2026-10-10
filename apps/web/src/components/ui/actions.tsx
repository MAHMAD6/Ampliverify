'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useEffect, useRef, useState, useTransition } from 'react';
import { apiAction, uploadAction } from '@/lib/actions';
import { Button, type ButtonVariant } from './index';
import s from './ui.module.css';

type Method = 'POST' | 'PATCH' | 'PUT' | 'DELETE';
/**
 * Where to go after success. Server components cannot pass functions to
 * these client controls, so a string may contain `{field}` placeholders
 * (e.g. `{id}`, `{code}`), replaced from the API response.
 */
type RedirectTarget = string | ((data: unknown) => string);

function target(to: RedirectTarget, data: unknown) {
  if (typeof to === 'function') return to(data);
  const record = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  return to.replace(/\{(\w+)\}/g, (_, key: string) => encodeURIComponent(String(record[key] ?? '')));
}

/** Inline error/success line used under action controls. */
export function ActionMessage({ error, success }: { error?: string | null; success?: string | null }) {
  if (!error && !success) return null;
  return (
    <p role={error ? 'alert' : 'status'} className={error ? s.actionError : s.actionSuccess}>
      {error ?? success}
    </p>
  );
}

/**
 * Button that calls the API through a server action, then refreshes the
 * page (or navigates). Shows pending state and the API's error message.
 */
export function ActionButton({
  method = 'POST',
  path,
  body,
  children,
  variant = 'primary',
  size = 'md',
  icon,
  confirm,
  revalidate,
  redirectTo,
  onDone,
  disabled,
  title,
  successMessage,
}: {
  method?: Method;
  path: string;
  body?: unknown;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  confirm?: string;
  revalidate?: string[];
  redirectTo?: RedirectTarget;
  onDone?: (data: unknown) => void;
  disabled?: boolean;
  title?: string;
  successMessage?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  return (
    <span className={s.actionWrap}>
      <Button
        variant={variant}
        size={size}
        icon={icon}
        disabled={disabled || pending}
        title={title}
        aria-busy={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setError(null);
          setDone(null);
          start(async () => {
            const result = await apiAction(method, path, body, revalidate);
            if (!result.ok) return setError(result.message);
            onDone?.(result.data);
            if (successMessage) setDone(successMessage);
            if (redirectTo) router.push(target(redirectTo, result.data));
            else router.refresh();
          });
        }}
      >
        {pending ? 'Working…' : children}
      </Button>
      <ActionMessage error={error} success={done} />
    </span>
  );
}

function readForm(form: HTMLFormElement) {
  const out: Record<string, unknown> = {};
  for (const el of Array.from(form.elements) as HTMLInputElement[]) {
    if (!el.name || el.disabled) continue;
    const kind = el.dataset.type;
    let value: unknown;
    if (el.type === 'checkbox') {
      if (kind === 'array') {
        if (!el.checked) {
          out[el.name] ??= [];
          continue;
        }
        out[el.name] = [...((out[el.name] as unknown[]) ?? []), el.value];
        continue;
      }
      value = el.checked;
    } else if (el.type === 'radio') {
      if (!el.checked) continue;
      value = el.value;
    } else if ((el as unknown as HTMLSelectElement).multiple && (el as unknown) instanceof HTMLSelectElement) {
      value = Array.from((el as unknown as HTMLSelectElement).selectedOptions).map((o) => o.value);
    } else {
      value = el.value;
      if (kind === 'number') value = el.value === '' ? null : Number(el.value);
      else if (kind === 'list' || kind === 'optional-list') {
        value = el.value.split(/[\n,]/).map((v) => v.trim()).filter(Boolean);
        if (kind === 'optional-list' && !(value as string[]).length) continue;
      } else if (kind === 'bool') value = el.value === 'on' || el.value === 'true';
      else if (kind === 'code') value = el.value.trim() ? el.value.trim().toUpperCase() : null;
      else if (kind === 'date') value = el.value ? new Date(el.value).toISOString() : null;
      else if (kind === 'utc') value = el.value ? new Date(`${el.value}Z`).toISOString() : null;
      else if (kind === 'nullable') value = el.value.trim() === '' ? null : el.value;
      else if (kind === 'json') {
        try {
          value = el.value.trim() ? JSON.parse(el.value) : null;
        } catch {
          throw new Error(`"${el.name}" must be valid JSON.`);
        }
      } else if (kind === 'optional' && el.value.trim() === '') continue;
    }
    // Dotted names build nested objects: settings.aiGeo.brandName
    const parts = el.name.split('.');
    let target = out;
    for (const p of parts.slice(0, -1)) target = (target[p] ??= {}) as Record<string, unknown>;
    target[parts[parts.length - 1]] = value;
  }
  return out;
}

/**
 * Form that submits its fields as JSON to an API path. Field types via
 * `data-type` (number, bool, list, optional-list, date, utc, nullable, code, json,
 * optional, array). `wrap` nests the values under a dotted path and `extra`
 * adds fixed fields; both are serializable so server components can use
 * them (`transform` only works from client components).
 */
export function ApiForm({
  method = 'POST',
  path,
  children,
  submitLabel = 'Save',
  submitVariant = 'primary',
  revalidate,
  redirectTo,
  successMessage = 'Saved.',
  transform,
  wrap,
  extra,
  onDone,
  className,
  resetOnSuccess,
  hideSubmit,
}: {
  method?: Method;
  path: string;
  children: ReactNode;
  submitLabel?: ReactNode;
  submitVariant?: ButtonVariant;
  revalidate?: string[];
  redirectTo?: RedirectTarget;
  successMessage?: string | null;
  transform?: (values: Record<string, unknown>) => unknown;
  wrap?: string;
  extra?: Record<string, unknown>;
  onDone?: (data: unknown) => void;
  className?: string;
  resetOnSuccess?: boolean;
  hideSubmit?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setDone(null);
    let values: Record<string, unknown>;
    try {
      values = readForm(form);
    } catch (err) {
      return setError((err as Error).message);
    }
    start(async () => {
      let body = transform ? transform(values) : values;
      if (wrap) body = wrap.split('.').reduceRight<unknown>((inner, key) => ({ [key]: inner }), body);
      if (extra) body = { ...extra, ...(body as Record<string, unknown>) };
      const result = await apiAction(method, path, body, revalidate);
      if (!result.ok) return setError(result.message);
      onDone?.(result.data);
      if (resetOnSuccess) form.reset();
      if (redirectTo) return router.push(target(redirectTo, result.data));
      if (successMessage) setDone(successMessage);
      router.refresh();
    });
  };
  return (
    <form onSubmit={submit} className={className} aria-busy={pending}>
      {children}
      <div className={s.formActions}>
        {!hideSubmit && (
          <Button type="submit" variant={submitVariant} disabled={pending}>
            {pending ? 'Saving…' : submitLabel}
          </Button>
        )}
        <ActionMessage error={error} success={done} />
      </div>
    </form>
  );
}

/** Multipart upload form (media library). */
export function UploadForm({ path, children, submitLabel = 'Upload', revalidate }: { path: string; children: ReactNode; submitLabel?: string; revalidate?: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        setError(null);
        start(async () => {
          const result = await uploadAction(path, data, revalidate);
          if (!result.ok) return setError(result.message);
          form.reset();
          router.refresh();
        });
      }}
    >
      {children}
      <div className={s.formActions}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Uploading…' : submitLabel}
        </Button>
        <ActionMessage error={error} />
      </div>
    </form>
  );
}

/** Refreshes server data every `seconds` while `active` (queued/running jobs). */
export function AutoRefresh({ active, seconds = 4 }: { active: boolean; seconds?: number }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!active) return;
    timer.current = setInterval(() => router.refresh(), seconds * 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [active, seconds, router]);
  return null;
}

/** Opens an external URL returned by the API (Stripe Checkout, portal, OAuth). */
export function RedirectButton({ path, body, children, variant = 'primary', size = 'md', disabled, icon }: { path: string; body?: unknown; children: ReactNode; variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg'; disabled?: boolean; icon?: ReactNode }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className={s.actionWrap}>
      <Button
        variant={variant}
        size={size}
        icon={icon}
        disabled={disabled || pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await apiAction<{ url: string }>('POST', path, body ?? {});
            if (!result.ok) return setError(result.message);
            window.location.assign(result.data.url);
          })
        }
      >
        {pending ? 'Redirecting…' : children}
      </Button>
      <ActionMessage error={error} />
    </span>
  );
}
