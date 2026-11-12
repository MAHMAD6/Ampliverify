import Link from 'next/link';
import { Scale } from 'lucide-react';
import { Badge, DataTable, Field, Input, Notice, PageHeader, Panel, Textarea } from '@/components/ui';
import { ApiForm } from '@/components/ui/actions';
import { StateView } from '@/components/ui/StateView';
import { adminGet } from '@/lib/admin-data';
import { formatDateTime } from '@/lib/format';

export const metadata = { title: 'Legal Pages · Admin' };

type Revision = { version: number; summary: string | null; publishedAt: string; publishedBy: string };
type LegalDoc = { key: string; draft: { body: string; updatedAt: string } | null; published: (Revision & { body: string }) | null; history: Revision[] };

const DOCS: Record<string, { title: string; href: string }> = {
  privacy: { title: 'Privacy Policy', href: '/privacy' },
  terms: { title: 'Terms of Service', href: '/terms' },
  cookies: { title: 'Cookie Policy', href: '/cookies' },
  dpa: { title: 'Data Processing Addendum', href: '/dpa' },
  refund: { title: 'Digital Product Refund Policy', href: '/digital-product-refund-policy' },
  seller: { title: 'Seller Guidelines', href: '/seller-guidelines' },
  regional: { title: 'Regional Disclosures', href: '/regional-disclosures' },
};

/** Legal revisions (V2 guide §1 CMS): save drafts, publish numbered versions, keep the history. */
export default async function AdminLegalPages({ searchParams }: { searchParams: Promise<{ doc?: string }> }) {
  const sp = await searchParams;
  const docs = await adminGet<LegalDoc[]>('/admin/legal');
  const active = docs?.find((d) => d.key === sp.doc) ?? docs?.[0];
  return (
    <>
      <PageHeader title="Legal Pages" description="Publish the approved text of each legal document. Until a version is published, the site shows its built-in text." />
      {!docs || !active ? (
        <Panel>
          <StateView kind="error" icon={<Scale size={36} />} title="Legal pages could not be loaded with your permissions." description="Editing legal pages needs the cms.manage permission." />
        </Panel>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, alignItems: 'start' }}>
          <Panel bodyless>
            <DataTable
              columns={['Document', 'Status']}
              rows={docs.map((d) => [
                <Link key="l" href={`/admin/legal?doc=${d.key}`} aria-current={d.key === active.key ? 'page' : undefined} style={{ fontWeight: d.key === active.key ? 700 : 500 }}>
                  {DOCS[d.key]?.title ?? d.key}
                </Link>,
                d.published ? (
                  <Badge key="b" tone="green">
                    v{d.published.version}
                  </Badge>
                ) : (
                  <Badge key="b">Built-in</Badge>
                ),
              ])}
            />
          </Panel>
          <div style={{ display: 'grid', gap: 16, gridColumn: 'span 2', minWidth: 0 }}>
            <Panel
              title={DOCS[active.key]?.title ?? active.key}
              description={active.published ? `Version ${active.published.version} published ${formatDateTime(active.published.publishedAt)}` : 'No version published yet.'}
              actions={
                <Link href={DOCS[active.key]?.href ?? '/'} target="_blank">
                  View page
                </Link>
              }
            >
              {active.draft && (
                <div style={{ marginBottom: 12 }}>
                  <Notice tone="amber" title={`Unpublished draft saved ${formatDateTime(active.draft.updatedAt)}.`}>
                    Publish it to replace the live text.
                  </Notice>
                </div>
              )}
              <Notice tone="blue" title="Have the text reviewed by your lawyer before publishing.">
                Use Markdown: # headings, lists and links. Raw HTML is not rendered.
              </Notice>
              <div style={{ marginTop: 12 }}>
                <ApiForm key={active.key} method="PUT" path={`/admin/legal/${active.key}`} submitLabel="Save" successMessage="Saved.">
                  <Field label="Document text (Markdown)" htmlFor="lg-body">
                    <Textarea id="lg-body" name="body" rows={22} required minLength={50} maxLength={100000} defaultValue={active.draft?.body ?? active.published?.body ?? ''} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }} />
                  </Field>
                  <Field label="Change summary (shown in history)" htmlFor="lg-sum">
                    <Input id="lg-sum" name="summary" maxLength={300} placeholder="e.g. Updated retention periods" />
                  </Field>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
                    <input type="checkbox" name="publish" data-type="bool" />
                    <span>Publish as a new version now (otherwise saved as a draft)</span>
                  </label>
                </ApiForm>
              </div>
            </Panel>
            <Panel title="Version history" bodyless>
              <DataTable columns={['Version', 'Summary', 'Published']} rows={active.history.map((h) => [`v${h.version}`, h.summary ?? '—', formatDateTime(h.publishedAt)])} empty="No versions published yet." />
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
