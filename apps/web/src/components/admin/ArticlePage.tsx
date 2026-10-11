import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { ArticleEditor } from './ArticleEditor';
import { RichArticleEditor, type MediaItem } from './RichArticleEditor';
import { CMS_KINDS, type AdminArticle, type CmsKind } from './cms';
import { adminGet } from '@/lib/admin-data';
import { getPlatformInfo } from '@/lib/platform';

type Category = { id: string; name: string; contentType: string };
type Author = { id: string; displayName: string };
type Media = { id: string; mimeType: string; altText: string | null; createdAt: string };

async function siteOrigin() {
  const p = await getPlatformInfo();
  if (p.platformUrl) return p.platformUrl.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost';
  return `${h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')}://${host}`;
}

/** Loads an article (or none for "new") plus the pickers it needs, then renders the editor. */
export async function ArticlePage({ kind, id }: { kind: CmsKind; id?: string }) {
  const k = CMS_KINDS[kind];
  const rich = kind === 'blog' || kind === 'guides';
  const [article, categories, authors, media, guides] = await Promise.all([
    id ? adminGet<AdminArticle>(`/admin/content/${kind}/${encodeURIComponent(id)}`) : Promise.resolve(null),
    k.categoryType ? adminGet<Category[]>(`/admin/categories?type=${k.categoryType}`) : Promise.resolve([]),
    rich ? adminGet<Author[]>('/admin/authors') : Promise.resolve([]),
    rich ? adminGet<Media[]>('/admin/media') : Promise.resolve([]),
    kind === 'guides' ? adminGet<{ id: string; title: string }[]>('/admin/content/guides') : Promise.resolve([]),
  ]);
  if (id && !article) notFound();
  const cats = (categories ?? []).map((c) => ({ id: c.id, name: c.name }));
  const people = (authors ?? []).map((a) => ({ id: a.id, displayName: a.displayName }));
  if (rich) {
    const items: MediaItem[] = (media ?? [])
      .filter((m) => m.mimeType.startsWith('image/') || m.mimeType.startsWith('video/'))
      .map((m) => ({ id: m.id, kind: m.mimeType.startsWith('video/') ? 'video' : 'image', label: m.altText || `${m.mimeType.startsWith('video/') ? 'Video' : 'Image'} ${m.id.slice(0, 8)}`, url: `/media/${m.id}` }));
    return (
      <RichArticleEditor
        key={article?.id ?? 'new'}
        kind={kind}
        article={article}
        categories={cats}
        authors={people}
        media={items}
        guides={(guides ?? []).map((g) => ({ id: g.id, title: g.title }))}
        siteUrl={await siteOrigin()}
      />
    );
  }
  return <ArticleEditor key={article?.id ?? 'new'} kind={kind} article={article} categories={cats} authors={people} media={[]} />;
}
