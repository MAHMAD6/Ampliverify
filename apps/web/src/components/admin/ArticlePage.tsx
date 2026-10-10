import { notFound } from 'next/navigation';
import { ArticleEditor } from './ArticleEditor';
import { CMS_KINDS, type AdminArticle, type CmsKind } from './cms';
import { adminGet } from '@/lib/admin-data';

type Category = { id: string; name: string; contentType: string };
type Author = { id: string; displayName: string };
type Media = { id: string; mimeType: string; altText: string | null; createdAt: string };

/** Loads an article (or none for "new") plus the pickers it needs, then renders the editor. */
export async function ArticlePage({ kind, id }: { kind: CmsKind; id?: string }) {
  const k = CMS_KINDS[kind];
  const [article, categories, authors, media] = await Promise.all([
    id ? adminGet<AdminArticle>(`/admin/content/${kind}/${encodeURIComponent(id)}`) : Promise.resolve(null),
    k.categoryType ? adminGet<Category[]>(`/admin/categories?type=${k.categoryType}`) : Promise.resolve([]),
    kind === 'blog' ? adminGet<Author[]>('/admin/authors') : Promise.resolve([]),
    kind === 'blog' ? adminGet<Media[]>('/admin/media') : Promise.resolve([]),
  ]);
  if (id && !article) notFound();
  return (
    <ArticleEditor
      key={article?.id ?? 'new'}
      kind={kind}
      article={article}
      categories={(categories ?? []).map((c) => ({ id: c.id, name: c.name }))}
      authors={(authors ?? []).map((a) => ({ id: a.id, displayName: a.displayName }))}
      media={(media ?? []).filter((m) => m.mimeType.startsWith('image/')).map((m) => ({ id: m.id, label: m.altText || `Image ${m.id.slice(0, 8)}` }))}
    />
  );
}
