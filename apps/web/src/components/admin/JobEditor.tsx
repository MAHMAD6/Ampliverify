import { ListPlus } from 'lucide-react';
import { ButtonLink, Card, Field, FormGrid, Input, Notice, Panel, Select, Stack, Textarea } from '../ui';
import { Toggle } from '../ui/Toggle';
import { ActionButton, ApiForm } from '../ui/actions';
import { AdminHeader } from './AdminParts';
import { MarkdownField } from './MarkdownField';
import { SlugFields } from './SlugFields';
import s from './parts.module.css';

/** Job Sections from the Create Job Opening design, inserted as markdown headings into the description. */
const JOB_SECTIONS = ['About the Role', 'Responsibilities', 'Qualifications', 'Preferred Qualifications', 'Benefits', 'Company Overview', 'Equal Opportunity Statement', 'Additional Information'].map((label) => ({
  label,
  hint: 'Add section',
  icon: <ListPlus size={20} />,
  markdown: `## ${label}\n\n${label === 'Responsibilities' || label.includes('Qualifications') ? '- ' : ''}`,
}));

export type AdminJob = {
  id: string;
  title: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
  department: string | null;
  locationText: string | null;
  employmentType: string;
  workArrangement: 'REMOTE' | 'HYBRID' | 'ON_SITE' | null;
  compensationText: string | null;
  summary: string | null;
  description?: string;
  showOnCareersPage: boolean;
  applicationDeadline: string | null;
  requireResume: boolean;
  requireCoverLetter: boolean;
  seoTitle: string | null;
  metaDescription: string | null;
  publishedAt: string | null;
  closedAt: string | null;
  updatedAt: string;
  _count: { applications: number };
};

/** Create / edit a job opening (`/admin/jobs`). Nothing is public until it is Published and shown on the careers page. */
export function JobEditor({ job }: { job: AdminJob | null }) {
  return (
    <>
      <AdminHeader
        section="Content Management"
        parent={{ label: 'Careers / Job Openings', href: '/admin/careers' }}
        page={job ? job.title : 'Editor'}
        title={job ? 'Edit Job Opening' : 'Create Job Opening'}
        description="Create or edit a role using the same controlled content workflow used across AmpliVerify."
        actions={
          job ? (
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <ButtonLink href={`/admin/careers/applications?job=${job.id}`} variant="secondary">
                Applications ({job._count.applications})
              </ButtonLink>
              <ActionButton variant="ghost" method="DELETE" path={`/admin/jobs/${job.id}`} confirm={`Delete “${job.title}”? Openings with applications should be closed instead.`} redirectTo="/admin/careers">
                Delete
              </ActionButton>
            </span>
          ) : (
            <ButtonLink href="/admin/careers" variant="secondary">
              Cancel
            </ButtonLink>
          )
        }
      />
      <div style={{ marginBottom: 16 }}>
        <Notice title={job?.status === 'PUBLISHED' ? 'Live opening.' : 'Draft editor.'}>
          {job?.status === 'PUBLISHED' ? 'Changes are visible on the careers page as soon as they are saved.' : 'Nothing becomes public until the opening is published.'}
        </Notice>
      </div>
      <ApiForm method={job ? 'PATCH' : 'POST'} path={job ? `/admin/jobs/${job.id}` : '/admin/jobs'} submitLabel={job ? 'Save Changes' : 'Create Opening'} redirectTo={job ? undefined : '/admin/careers/{id}'} successMessage="Saved.">
        <div className={s.twocol}>
          <Card>
            <SlugFields titleLabel="Job title" titlePlaceholder="Enter job title" defaultTitle={job?.title} defaultSlug={job?.slug} />
            <FormGrid>
              <Field label="Department" htmlFor="j-dept">
                <Input id="j-dept" name="department" data-type="nullable" maxLength={120} defaultValue={job?.department ?? ''} placeholder="e.g. Engineering" />
              </Field>
              <Field label="Employment type" htmlFor="j-type">
                <Select id="j-type" name="employmentType" defaultValue={job?.employmentType ?? 'FULL_TIME'}>
                  <option value="FULL_TIME">Full-time</option>
                  <option value="PART_TIME">Part-time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERNSHIP">Internship</option>
                  <option value="TEMPORARY">Temporary</option>
                </Select>
              </Field>
              <Field label="Work arrangement" htmlFor="j-arr">
                <Select id="j-arr" name="workArrangement" data-type="nullable" defaultValue={job?.workArrangement ?? ''}>
                  <option value="">Not specified</option>
                  <option value="REMOTE">Remote</option>
                  <option value="HYBRID">Hybrid</option>
                  <option value="ON_SITE">On-site</option>
                </Select>
              </Field>
              <Field label="Location" htmlFor="j-loc">
                <Input id="j-loc" name="locationText" data-type="nullable" maxLength={200} defaultValue={job?.locationText ?? ''} placeholder="Approved location or region" />
              </Field>
            </FormGrid>
            <Field label="Compensation" htmlFor="j-comp" hint="Optional — add only if approved for publication.">
              <Input id="j-comp" name="compensationText" data-type="nullable" maxLength={200} defaultValue={job?.compensationText ?? ''} />
            </Field>
            <Field label="Short summary" htmlFor="j-summary">
              <Textarea id="j-summary" name="summary" data-type="nullable" maxLength={1000} defaultValue={job?.summary ?? ''} placeholder="A brief summary of the role (shown in job listings)." style={{ minHeight: 80 }} />
            </Field>
            <Field label="Job description" htmlFor="j-desc">
              <MarkdownField id="j-desc" name="description" placeholder="Write the full job description. You can use headings, lists, images, and links." blocks={JOB_SECTIONS} defaultValue={job?.description ?? ''} />
            </Field>
          </Card>
          <Stack>
            <Panel title="Publishing" description="Control visibility and status.">
              <Field label="Status" htmlFor="j-status">
                <Select id="j-status" name="status" defaultValue={job?.status ?? 'DRAFT'}>
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="CLOSED">Closed (no new applications)</option>
                  <option value="ARCHIVED">Archived</option>
                </Select>
              </Field>
              {job?.publishedAt && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Published {new Date(job.publishedAt).toLocaleDateString()}</p>}
              <div className={s.row}>
                <span>Show on careers page</span>
                <Toggle label="Show on careers page" defaultChecked={job?.showOnCareersPage ?? true} name="showOnCareersPage" />
              </div>
            </Panel>
            <Panel title="Application Settings" description="Configure the application workflow.">
              <Field label="Application deadline" htmlFor="j-deadline" hint="Optional.">
                <Input id="j-deadline" name="applicationDeadline" type="date" data-type="date" defaultValue={job?.applicationDeadline?.slice(0, 10) ?? ''} />
              </Field>
              <div className={s.row}>
                <span>Require résumé or CV</span>
                <Toggle label="Require résumé or CV" defaultChecked={job?.requireResume ?? true} name="requireResume" />
              </div>
              <div className={s.row}>
                <span>Require cover letter</span>
                <Toggle label="Require cover letter" defaultChecked={job?.requireCoverLetter ?? false} name="requireCoverLetter" />
              </div>
            </Panel>
            <Panel title="Metadata" description="Optional public-page metadata.">
              <Field label="SEO title" htmlFor="j-seo">
                <Input id="j-seo" name="seoTitle" data-type="nullable" maxLength={300} defaultValue={job?.seoTitle ?? ''} />
              </Field>
              <Field label="Meta description" htmlFor="j-meta">
                <Textarea id="j-meta" name="metaDescription" data-type="nullable" maxLength={500} defaultValue={job?.metaDescription ?? ''} style={{ minHeight: 70 }} />
              </Field>
            </Panel>
          </Stack>
        </div>
      </ApiForm>
    </>
  );
}
