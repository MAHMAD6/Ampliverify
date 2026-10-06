import Link from 'next/link';
import type { ReactNode } from 'react';
import { FileSearch, Search } from 'lucide-react';
import { formatDate } from '@/lib/format';
import type { Category, ContentSummary } from '@/lib/types';
import { Button, Input, Select } from '../ui';
import s from './public.module.css';

/** GET search form shared by Blog, Guides and Help listings. */
export function ContentFilters({
  action,
  q,
  category,
  categories,
  placeholder,
  allLabel,
}: {
  action: string;
  q?: string;
  category?: string;
  categories: NonNullable<Category>[];
  placeholder: string;
  allLabel: string;
}) {
  return (
    <form className={s.filters} action={action} role="search">
      <Input name="q" defaultValue={q} placeholder={placeholder} icon={<Search size={18} />} aria-label={placeholder} />
      {categories.length > 0 && (
        <Select name="category" defaultValue={category ?? ''} aria-label="Topic">
          <option value="">{allLabel}</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
      )}
      <Button type="submit" variant="green">
        Search
      </Button>
    </form>
  );
}

export function ResourceGrid({ items, basePath, cta, icon }: { items: ContentSummary[]; basePath: string; cta: string; icon: ReactNode }) {
  return (
    <div className={s.resourcegrid}>
      {items.map((item) => (
        <Link key={item.slug} href={`${basePath}/${item.slug}`} className={s.resourcecard}>
          <div className={s.thumb}>{icon}</div>
          <div className={s.cardbody}>
            <div className={s.meta}>
              {item.category?.name ?? 'Article'} · {formatDate(item.publishedAt)}
            </div>
            <h3>{item.title}</h3>
            {item.excerpt && <p>{item.excerpt}</p>}
            <div className={s.read}>{cta} →</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function EmptyContent({ title, text, filtered }: { title: string; text: string; filtered?: boolean }) {
  return (
    <div className={s.emptyCard}>
      <FileSearch size={34} color="var(--brand-green-600)" />
      <h3>{filtered ? 'No results match your search' : title}</h3>
      <p>{filtered ? 'Try a different search term or topic.' : text}</p>
    </div>
  );
}
