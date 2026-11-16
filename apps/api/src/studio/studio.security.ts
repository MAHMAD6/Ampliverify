import { BadRequestException } from '@nestjs/common';
import { load, type CheerioAPI } from 'cheerio';

/**
 * Editor Studio security helpers (V13.2 guide §3, §8, §11): role mapping onto
 * workspace RBAC, an allowlist HTML sanitizer for drafts, publication and
 * exports, identifier and form-schema validation.
 */

/** Guide role semantics mapped onto the existing workspace permissions. */
export const STUDIO_PERMISSION = {
  viewer: 'editor.read',
  editor: 'editor.write',
  publisher: 'editor.publish',
  connections: 'integration.manage',
  forms: 'editor.forms.manage',
} as const;

export const MAX_ARTICLE_HTML = 1_000_000;

export function validIdentifier(input: unknown, label = 'identifier'): string {
  if (typeof input !== 'string' || !/^[a-zA-Z0-9_-]{3,100}$/.test(input)) {
    throw new BadRequestException({ code: 'INVALID_IDENTIFIER', message: `Invalid ${label}.` });
  }
  return input;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

/** Public origin of hosted forms and approved media (PUBLIC_FORM_ORIGIN, default the web app). */
export function publicOrigin() {
  const raw = process.env.PUBLIC_FORM_ORIGIN || process.env.PUBLIC_WEB_URL || process.env.BETTER_AUTH_URL || 'http://localhost:3000';
  try {
    return new URL(raw).origin;
  } catch {
    return 'http://localhost:3000';
  }
}

// ── HTML sanitizer ──────────────────────────────────────────────────────────

const BASE_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'del', 'ins', 'strike', 'sub', 'sup', 'mark', 'small',
  'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption', 'video', 'source', 'iframe', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
  'caption', 'colgroup', 'col', 'br', 'hr', 'code', 'pre', 'section', 'article', 'aside', 'header', 'footer', 'dl', 'dt', 'dd', 'abbr', 'cite', 'q', 'time',
]);
/** Form mock-ups and media tools the editor rebuilds itself; kept in drafts only. */
const DRAFT_TAGS = new Set(['button', 'label', 'input', 'select', 'option', 'textarea', 'fieldset', 'legend']);
/** Removed together with their content. */
const DROP = new Set(['script', 'style', 'noscript', 'template', 'object', 'embed', 'applet', 'link', 'meta', 'base', 'svg', 'math', 'frame', 'frameset', 'title', 'head']);

const ATTRS: Record<string, string[]> = {
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt', 'width', 'height', 'loading'],
  video: ['src', 'controls', 'poster', 'preload', 'playsinline', 'muted', 'loop', 'width', 'height'],
  source: ['src', 'type'],
  iframe: ['src', 'title', 'loading', 'sandbox', 'referrerpolicy', 'allow', 'allowfullscreen', 'width', 'height'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan', 'scope'],
  ol: ['start', 'type'],
  time: ['datetime'],
  col: ['span'],
  '*': ['class', 'id', 'style', 'title', 'lang', 'dir', 'aria-label', 'aria-hidden', 'role'],
};
const DRAFT_ATTRS: Record<string, string[]> = {
  button: ['type', 'disabled', 'draggable'],
  input: ['type', 'name', 'placeholder', 'value', 'checked', 'disabled', 'required', 'readonly'],
  select: ['name', 'disabled', 'required'],
  option: ['value', 'selected'],
  textarea: ['name', 'placeholder', 'disabled', 'rows', 'required', 'readonly'],
  label: ['for'],
  '*': ['contenteditable', 'draggable', 'tabindex'],
};
const STYLE_PROPS = new Set([
  'width', 'max-width', 'min-width', 'height', 'max-height', 'min-height', 'text-align', 'color', 'background-color', 'font-weight', 'font-style',
  'text-decoration', 'margin', 'margin-left', 'margin-right', 'margin-top', 'margin-bottom', 'padding', 'float', 'vertical-align', 'aspect-ratio', 'object-fit',
]);
const SAFE_IFRAME_HOSTS = ['www.youtube.com', 'www.youtube-nocookie.com', 'youtube.com', 'player.vimeo.com'];
const REL_TOKENS = new Set(['nofollow', 'sponsored', 'ugc', 'noopener', 'noreferrer']);

function safeStyle(value: string) {
  const out: string[] = [];
  for (const decl of value.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim().toLowerCase();
    const val = decl.slice(i + 1).trim();
    if (!STYLE_PROPS.has(prop) || !val || val.length > 100) continue;
    if (/url\s*\(|expression|javascript:|[<>\\@{}]|var\s*\(/i.test(val)) continue;
    out.push(`${prop}: ${val}`);
  }
  return out.join('; ');
}

function httpUrl(value: string, allowRelative: boolean) {
  const v = value.trim();
  if (allowRelative && /^(\/(?!\/)|#)/.test(v)) return v;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

function iframeAllowed(src: string) {
  try {
    const u = new URL(src);
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(u.hostname))) return false;
    if (SAFE_IFRAME_HOSTS.includes(u.hostname)) return true;
    return u.origin === publicOrigin() && /^\/forms\/public\/[0-9a-f-]{36}$/.test(u.pathname);
  } catch {
    return false;
  }
}

export type SanitizeMode = 'draft' | 'publish';

/**
 * Allowlist sanitizer. `draft` keeps the editor's data-* markers (media and
 * form blocks), form mock-ups and media tools so a cloud draft reopens
 * intact; `publish` strips every editor-only control and attribute.
 */
export function sanitizeArticle(html: unknown, mode: SanitizeMode = 'publish'): string {
  if (typeof html !== 'string' || !html.trim()) throw new BadRequestException({ code: 'INVALID_ARTICLE', message: 'The article is empty.' });
  if (html.length > MAX_ARTICLE_HTML) throw new BadRequestException({ code: 'ARTICLE_TOO_LARGE', message: 'The article is too large (1 MB of HTML at most).' });
  const $ = load(html, null, false);
  if (mode === 'publish') $('.av-media-actions,.remove-media,.av-form-activate,.article-drag-handle,[data-editor-only],.move-history-btn,.av-media-missing,.av-media-resize').remove();
  clean($, mode);
  return $.html();
}

function clean($: CheerioAPI, mode: SanitizeMode) {
  const draft = mode === 'draft';
  // Deepest first, so unwrapping never skips children.
  const nodes = $('*').toArray().reverse();
  for (const node of nodes) {
    const el = node as unknown as { tagName?: string; name?: string; attribs?: Record<string, string> };
    const tag = (el.tagName ?? el.name ?? '').toLowerCase();
    const $el = $(node);
    if (DROP.has(tag) || (!draft && DRAFT_TAGS.has(tag))) {
      $el.remove();
      continue;
    }
    if (!BASE_TAGS.has(tag) && !(draft && DRAFT_TAGS.has(tag))) {
      $el.replaceWith($el.contents());
      continue;
    }
    const allowed = new Set([...(ATTRS['*'] ?? []), ...(ATTRS[tag] ?? []), ...(draft ? [...(DRAFT_ATTRS['*'] ?? []), ...(DRAFT_ATTRS[tag] ?? [])] : [])]);
    for (const [name, value] of Object.entries(el.attribs ?? {})) {
      const lower = name.toLowerCase();
      const isData = /^data-[a-z0-9-]+$/.test(lower);
      if (!(allowed.has(lower) || (draft && isData))) {
        $el.removeAttr(name);
        continue;
      }
      if (lower === 'style') {
        const s = safeStyle(value);
        if (s) $el.attr('style', s);
        else $el.removeAttr('style');
      } else if (lower === 'href') {
        const v = value.trim();
        const ok = /^(mailto|tel):/i.test(v) ? v : httpUrl(v, true);
        if (ok) $el.attr('href', ok);
        else $el.removeAttr('href');
      } else if (lower === 'src' || lower === 'poster') {
        const ok = httpUrl(value, false);
        if (ok) $el.attr(lower, ok);
        else $el.removeAttr(lower);
      } else if (lower === 'target') {
        if (value !== '_blank') $el.removeAttr('target');
      } else if (lower === 'contenteditable') {
        if (value !== 'false') $el.removeAttr(name);
      } else if (isData && value.length > 20_000) {
        $el.removeAttr(name);
      }
    }
    if (tag === 'a') {
      const rel = new Set((($el.attr('rel') ?? '').toLowerCase().split(/\s+/)).filter((t) => REL_TOKENS.has(t)));
      if ($el.attr('target') === '_blank') {
        rel.add('noopener');
        rel.add('noreferrer');
      }
      if (rel.size) $el.attr('rel', [...rel].join(' '));
      else $el.removeAttr('rel');
    }
    if (tag === 'iframe') {
      const src = $el.attr('src') ?? '';
      if (!iframeAllowed(src)) {
        $el.remove();
        continue;
      }
      if (!$el.attr('sandbox')) $el.attr('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-forms');
    }
  }
}

/** Browser-only media (IndexedDB blocks, blob:/data: URLs) can never be published or exported portably. */
export function assertNoLocalMedia(html: string) {
  if (/data-av-local-id\s*=|\s(?:src|poster)\s*=\s*["']?\s*(?:blob:|data:|file:)/i.test(html)) {
    throw new BadRequestException({ code: 'LOCAL_MEDIA', message: 'Upload local images and videos for approval before publishing or exporting.' });
  }
}

/** Offline (unactivated) form blocks block publication. */
export function assertNoOfflineForms(html: string) {
  const $ = load(html, null, false);
  if ($('.av-form-block').toArray().some((b) => $(b).attr('data-form-status') !== 'active')) {
    throw new BadRequestException({ code: 'FORM_NOT_ACTIVE', message: 'Activate offline forms before publishing, or remove those blocks.' });
  }
}

// ── Hosted form schema (V12 style and dimension contract) ───────────────────

export const FORM_FIELD_KINDS = ['text', 'email', 'tel', 'textarea', 'select', 'checkbox'] as const;
const FONTS = ['inherit', 'Arial, sans-serif', 'Georgia, serif', 'Verdana, sans-serif', 'Tahoma, sans-serif'];
const COLOR = /^#[0-9a-f]{6}$/i;

export type FormField = { key: string; label: string; kind: (typeof FORM_FIELD_KINDS)[number]; required: boolean; options: string[] };
export type FormStyle = {
  mode: 'neutral' | 'inherit' | 'custom';
  background: string;
  text: string;
  border: string;
  button: string;
  buttonText: string;
  accent: string;
  font: string;
  fontSize: number;
  spacing: number;
  radius: number;
  width: number;
  height: number;
};
export type FormSchema = {
  name: string;
  description: string;
  submit_label: string;
  success_message: string;
  privacy_url: string | null;
  consent_required: boolean;
  fields: FormField[];
};

const STYLE_DEFAULTS: FormStyle = { mode: 'neutral', background: '#ffffff', text: '#243144', border: '#d4dbe4', button: '#233b55', buttonText: '#ffffff', accent: '#2563a6', font: 'inherit', fontSize: 14, spacing: 12, radius: 8, width: 100, height: 0 };

const bad = (message: string) => new BadRequestException({ code: 'INVALID_FORM', message });

function rangeNumber(v: unknown, min: number, max: number, label: string, fallback: number) {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw bad(`${label} must be between ${min} and ${max}.`);
  return Math.round(n);
}

/** Rejects unsafe styles instead of silently changing them (guide §7). */
export function validateFormStyle(input: unknown): FormStyle {
  const v = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const style: FormStyle = { ...STYLE_DEFAULTS };
  if (v.mode !== undefined) {
    if (!['neutral', 'inherit', 'custom'].includes(String(v.mode))) throw bad('Unknown form theme.');
    style.mode = v.mode as FormStyle['mode'];
  }
  for (const k of ['background', 'text', 'border', 'button', 'buttonText', 'accent'] as const) {
    if (v[k] === undefined) continue;
    if (!COLOR.test(String(v[k]))) throw bad(`Colors must be #rrggbb values (${k}).`);
    style[k] = String(v[k]);
  }
  if (v.font !== undefined) {
    if (!FONTS.includes(String(v.font))) throw bad('Unsupported form font.');
    style.font = String(v.font);
  }
  style.fontSize = rangeNumber(v.fontSize, 12, 24, 'Font size', style.fontSize);
  style.spacing = rangeNumber(v.spacing, 4, 32, 'Spacing', style.spacing);
  style.radius = rangeNumber(v.radius, 0, 32, 'Corner radius', style.radius);
  style.width = rangeNumber(v.width, 30, 100, 'Width (%)', style.width);
  const height = rangeNumber(v.height, 0, 1200, 'Height (px)', 0);
  if (height !== 0 && height < 160) throw bad('Height must be auto or between 160 and 1200 px.');
  style.height = height;
  return style;
}

export function validateFormSchema(input: unknown): { schema: FormSchema; style: FormStyle } {
  const v = (input && typeof input === 'object' ? input : null) as Record<string, unknown> | null;
  if (!v) throw bad('Invalid form.');
  const fields = v.fields;
  if (!Array.isArray(fields) || fields.length < 1 || fields.length > 20) throw bad('A form needs 1 to 20 fields.');
  const keys = new Set<string>();
  const clean: FormField[] = fields.map((f) => {
    const field = (f && typeof f === 'object' ? f : {}) as Record<string, unknown>;
    const key = String(field.key ?? '');
    if (!/^[a-z0-9_-]{1,100}$/i.test(key) || keys.has(key)) throw bad('Each field needs a unique key (letters, numbers, - and _).');
    keys.add(key);
    if (!FORM_FIELD_KINDS.includes(field.kind as FormField['kind'])) throw bad('Unsupported field type.');
    const label = text(field.label, 200).trim();
    if (!label) throw bad('Every field needs a label.');
    if (/<|>/.test(label)) throw bad('Labels cannot contain markup.');
    const options = field.kind === 'select' ? (Array.isArray(field.options) ? field.options : []).slice(0, 30).map((o) => text(o, 200)).filter(Boolean) : [];
    if (field.kind === 'select' && !options.length) throw bad('Select fields need options.');
    return { key, label, kind: field.kind as FormField['kind'], required: field.required === true, options };
  });
  const privacy = typeof v.privacy_url === 'string' && v.privacy_url.trim() ? v.privacy_url.trim() : null;
  if (privacy && !/^https:\/\/[^\s<>"']+$/.test(privacy)) throw bad('The privacy link must be an https:// address.');
  const plain = (value: unknown, max: number, fallback = '') => {
    const s = text(value, max).trim();
    if (/<\s*\/?\s*script|javascript:/i.test(s)) throw bad('Form text cannot contain scripts.');
    return s || fallback;
  };
  return {
    schema: {
      name: plain(v.name, 160, 'Form'),
      description: plain(v.description, 1000),
      submit_label: plain(v.submit_label, 60, 'Submit'),
      success_message: plain(v.success_message, 300, 'Thank you'),
      privacy_url: privacy,
      consent_required: v.consent_required === true,
      fields: clean,
    },
    style: validateFormStyle(v.style),
  };
}
