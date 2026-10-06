import { Image as ImageIcon } from 'lucide-react';
import { AdminHeader, Dropzone } from '@/components/admin/AdminParts';
import { MarkdownField } from '@/components/admin/MarkdownField';
import { SlugFields } from '@/components/admin/SlugFields';
import { Button, Card, Field, Input, Notice, Panel, Select, Stack, Textarea } from '@/components/ui';
import { Toggle } from '@/components/ui/Toggle';
import s from '@/components/admin/parts.module.css';

export const metadata = { title: 'Create Blog Post' };

/**
 * Post editor. Saving and publishing need the admin CMS write API (not built
 * yet), so both actions are disabled; nothing becomes public from this form.
 */
export default async function NewBlogPostPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const isGuide = (await searchParams).type === 'guide';
  const noun = isGuide ? 'Resource' : 'Blog Post';
  return (
    <form>
      <AdminHeader
        section="Content Management"
        parent={isGuide ? { label: 'Resources', href: '/admin/resources' } : { label: 'Blog Posts', href: '/admin/blog' }}
        title={`Create ${noun}`}
        description={`Draft and configure a ${noun.toLowerCase()} before publishing.`}
        actions={
          <>
            <Button variant="secondary" disabled title="Saving requires the content API">
              Save Draft
            </Button>
            <Button disabled title="Publishing requires the content API">
              Publish
            </Button>
          </>
        }
      />
      <div className={s.twocol}>
        <Card>
          <SlugFields titleLabel={isGuide ? 'Resource title' : 'Post title'} titlePlaceholder="Enter a clear title" />
          <Field label="Excerpt" htmlFor="f-excerpt">
            <Textarea id="f-excerpt" name="excerpt" placeholder="Add a short summary for listings and search previews" style={{ minHeight: 90 }} />
          </Field>
          <Field label="Content" htmlFor="f-body" hint="Markdown. The public site renders headings, lists, links and quotes.">
            <MarkdownField id="f-body" name="body" placeholder="Start writing…" />
          </Field>
        </Card>
        <Stack>
          <Panel title="Publishing" description="Control the post state.">
            <div className={s.row}>
              <span>Status</span>
              <strong>Draft</strong>
            </div>
            <div className={s.row}>
              <span>Publish immediately</span>
              <Toggle label="Publish immediately" disabled />
            </div>
            <Field label="Schedule" htmlFor="f-schedule" hint="Scheduled posts go live automatically at this time.">
              <Input id="f-schedule" name="publishedAt" type="datetime-local" />
            </Field>
          </Panel>
          <Panel title="Organization" description="Classification and ownership.">
            <Field label="Author" htmlFor="f-author">
              <Select id="f-author" name="authorId" defaultValue="">
                <option value="">Select author</option>
              </Select>
            </Field>
            <Field label="Category" htmlFor="f-category">
              <Select id="f-category" name="categoryId" defaultValue="">
                <option value="">Select category</option>
              </Select>
            </Field>
            {!isGuide && (
              <Field label="Tags" htmlFor="f-tags" hint="Separate tags with commas.">
                <Input id="f-tags" name="tags" placeholder="Add tags" />
              </Field>
            )}
          </Panel>
          {!isGuide && (
            <Panel title="Featured Image">
              <Dropzone icon={<ImageIcon size={26} />} title="Upload or choose from Media Library" hint="Recommended 1200 × 630 px." />
            </Panel>
          )}
          <Panel title="SEO" description="Optional search metadata.">
            <Field label="SEO title" htmlFor="f-seo">
              <Input id="f-seo" name="seoTitle" placeholder="Optional" />
            </Field>
            <Field label="Meta description" htmlFor="f-meta">
              <Textarea id="f-meta" name="metaDescription" placeholder="Optional" style={{ minHeight: 70 }} />
            </Field>
          </Panel>
          <Notice tone="neutral">Content stays private until an authorized administrator publishes it.</Notice>
        </Stack>
      </div>
    </form>
  );
}
