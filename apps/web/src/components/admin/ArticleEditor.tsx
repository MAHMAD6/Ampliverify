'use client';

import { useState } from 'react';
import { HelpCircle, Lightbulb, ListTree, Megaphone, Plus, Trash2 } from 'lucide-react';
import { Button, Card, Field, Input, Notice, Panel, Select, Stack, Textarea } from '../ui';
import { ActionButton, ApiForm } from '../ui/actions';
import { AdminHeader } from './AdminParts';
import { MarkdownField } from './MarkdownField';
import { SlugFields } from './SlugFields';
import { CMS_KINDS, type AdminArticle, type CmsKind } from './cms';
import s from './parts.module.css';

const BLOCKS = [
  { label: 'Table of Contents', hint: 'Auto-generated from headings', icon: <ListTree size={22} />, markdown: '## In this article\n\n_The public page builds the table of contents from your H2 headings._' },
  { label: 'Key Takeaways', hint: 'Add key points', icon: <Lightbulb size={22} />, markdown: '## Key takeaways\n\n- First point\n- Second point\n- Third point' },
  { label: 'FAQ Section', hint: 'Add common questions', icon: <HelpCircle size={22} />, markdown: '## Frequently asked questions\n\n### Question?\n\nAnswer.' },
  { label: 'CTA Block', hint: 'Add a call to action', icon: <Megaphone size={22} />, markdown: '> **Ready to start?** [Get started free](/pricing)' },
];

const local = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

/**
 * Article editor for blog posts, resources (guides), help articles and case
 * studies (`/admin/content/:kind`). Publishing sets the status; a future
 * publish date schedules the item. Every save is audited by the API.
 */
export function ArticleEditor({
  kind,
  article,
  categories,
  authors,
  media,
}: {
  kind: CmsKind;
  article: AdminArticle | null;
  categories: { id: string; name: string }[];
  authors: { id: string; displayName: string }[];
  media: { id: string; label: string }[];
}) {
  const k = CMS_KINDS[kind];
  const isCase = kind === 'case-studies';
  const [results, setResults] = useState<{ label: string; value: string }[]>(article?.resultsJson ?? []);
  const path = article ? `/admin/content/${kind}/${article.id}` : `/admin/content/${kind}`;

  return (
    <>
      <AdminHeader
        section="Content Management"
        parent={{ label: k.plural, href: k.admin }}
        page={article ? article.title : `New ${k.noun}`}
        title={article ? `Edit ${k.noun}` : `Create ${k.noun}`}
        description={`Draft and configure a ${k.noun.toLowerCase()} before publishing.`}
        actions={
          article ? (
            <span style={{ display: 'flex', gap: 8 }}>
              {article.status === 'PUBLISHED' && (
                <a href={`${k.publicBase}/${article.slug}`} target="_blank" rel="noopener noreferrer" style={{ alignSelf: 'center', color: 'var(--blue)', fontWeight: 600 }}>
                  View live
                </a>
              )}
              <ActionButton variant="ghost" method="DELETE" path={path} confirm={`Delete “${article.title}” permanently?`} redirectTo={k.admin}>
                Delete
              </ActionButton>
            </span>
          ) : undefined
        }
      />
      <ApiForm
        method={article ? 'PATCH' : 'POST'}
        path={path}
        submitLabel={article ? 'Save Changes' : `Create ${k.noun}`}
        redirectTo={article ? undefined : `${k.admin}/{id}`}
        successMessage="Saved."
        transform={(v) => ({
          ...v,
          ...(isCase ? { results: results.filter((r) => r.label.trim() && r.value.trim()) } : {}),
        })}
      >
        <div className={s.twocol}>
          <Card>
            <SlugFields titleLabel={`${k.noun} title`} titlePlaceholder="Enter a clear title" defaultTitle={article?.title} defaultSlug={article?.slug} />
            {isCase && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Customer name" htmlFor="f-cust">
                  <Input id="f-cust" name="customerName" required maxLength={160} defaultValue={article?.customerName ?? ''} />
                </Field>
                <Field label="Industry" htmlFor="f-ind">
                  <Input id="f-ind" name="industry" data-type="nullable" maxLength={120} defaultValue={article?.industry ?? ''} />
                </Field>
              </div>
            )}
            <Field label={isCase ? 'Summary' : 'Excerpt'} htmlFor="f-excerpt">
              <Textarea id="f-excerpt" name="excerpt" data-type="nullable" maxLength={1000} defaultValue={article?.excerpt ?? article?.summary ?? ''} placeholder="A short summary for listings and search previews" style={{ minHeight: 90 }} />
            </Field>
            <Field label="Content" htmlFor="f-body" hint="Markdown. The public site renders headings, lists, links, images and quotes.">
              <MarkdownField id="f-body" name="body" placeholder="Start writing… Add content, images, links, and formatting." blocks={BLOCKS} defaultValue={article?.body ?? ''} />
            </Field>
            {isCase && (
              <div>
                <b style={{ fontSize: 14 }}>Results</b>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>Measured outcomes shown as highlights (e.g. “Organic traffic” · “+42%”).</p>
                {results.map((r, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginTop: 6 }}>
                    <Input value={r.label} maxLength={80} placeholder="Metric" aria-label="Metric" onChange={(e) => setResults((x) => x.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} />
                    <Input value={r.value} maxLength={80} placeholder="Value" aria-label="Value" onChange={(e) => setResults((x) => x.map((y, j) => (j === i ? { ...y, value: e.target.value } : y)))} />
                    <Button type="button" variant="ghost" aria-label="Remove result" onClick={() => setResults((x) => x.filter((_, j) => j !== i))}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" icon={<Plus size={14} />} style={{ marginTop: 8 }} onClick={() => setResults((x) => [...x, { label: '', value: '' }])} disabled={results.length >= 10}>
                  Add result
                </Button>
              </div>
            )}
          </Card>
          <Stack>
            <Panel title="Publishing" description="Drafts stay private. A future date schedules publication.">
              <Field label="Status" htmlFor="f-status">
                <Select id="f-status" name="status" defaultValue={article?.status ?? 'DRAFT'}>
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="ARCHIVED">Archived</option>
                </Select>
              </Field>
              <Field label="Publish date" htmlFor="f-date" hint="Leave empty to publish now when the status is Published.">
                <Input id="f-date" name="publishedAt" type="datetime-local" data-type="date" defaultValue={local(article?.publishedAt)} />
              </Field>
            </Panel>
            {!isCase && (
              <Panel title="Organization" description="Classification and ownership.">
                {kind === 'blog' && (
                  <Field label="Author" htmlFor="f-author">
                    <Select id="f-author" name="authorId" data-type="nullable" defaultValue={article?.authorId ?? ''}>
                      <option value="">No author</option>
                      {authors.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.displayName}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                <Field label="Category" htmlFor="f-category">
                  <Select id="f-category" name="categoryId" data-type="nullable" defaultValue={article?.categoryId ?? ''}>
                    <option value="">No category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                {kind === 'blog' && (
                  <Field label="Tags" htmlFor="f-tags" hint="Separate tags with commas.">
                    <Input id="f-tags" name="tags" data-type="list" defaultValue={(article?.tags ?? []).map((t) => t.tag.name).join(', ')} placeholder="Add tags" />
                  </Field>
                )}
                {kind === 'blog' && (
                  <Field label="Featured image" htmlFor="f-media" hint="Upload images in the Media Library.">
                    <Select id="f-media" name="featuredMediaId" data-type="nullable" defaultValue={article?.featuredMediaId ?? ''}>
                      <option value="">None</option>
                      {media.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
              </Panel>
            )}
            <Panel title="SEO & GEO" description="Search and AI-search metadata.">
              <Field label="SEO title" htmlFor="f-seo" hint="Recommended 50–60 characters.">
                <Input id="f-seo" name="seoTitle" data-type="nullable" maxLength={300} defaultValue={article?.seoTitle ?? ''} placeholder="Defaults to the title" />
              </Field>
              <Field label="Meta description" htmlFor="f-meta" hint="Recommended 150–160 characters.">
                <Textarea id="f-meta" name="metaDescription" data-type="nullable" maxLength={500} defaultValue={article?.metaDescription ?? ''} placeholder="Defaults to the excerpt" style={{ minHeight: 70 }} />
              </Field>
            </Panel>
            <Notice tone="neutral">Content stays private until it is published.</Notice>
          </Stack>
        </div>
      </ApiForm>
    </>
  );
}
