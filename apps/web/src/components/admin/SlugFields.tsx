'use client';

import { useState } from 'react';
import { Field, Input } from '../ui';

const slugify = (v: string) =>
  v
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

/** Title + slug: the slug follows the title until the admin edits it. */
export function SlugFields({ titleLabel, titlePlaceholder, defaultTitle = '', defaultSlug = '' }: { titleLabel: string; titlePlaceholder: string; defaultTitle?: string; defaultSlug?: string }) {
  const [title, setTitle] = useState(defaultTitle);
  const [slug, setSlug] = useState(defaultSlug);
  const [touched, setTouched] = useState(!!defaultSlug);
  return (
    <>
      <Field label={titleLabel} htmlFor="f-title">
        <Input
          id="f-title"
          name="title"
          value={title}
          maxLength={200}
          required
          placeholder={titlePlaceholder}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!touched) setSlug(slugify(e.target.value));
          }}
        />
      </Field>
      <Field label="Slug" htmlFor="f-slug" hint="Generated from the title — editable before publishing.">
        <Input
          id="f-slug"
          name="slug"
          value={slug}
          placeholder="url-slug"
          onChange={(e) => {
            setTouched(true);
            setSlug(slugify(e.target.value));
          }}
        />
      </Field>
    </>
  );
}
