import { AdminHeader } from '@/components/admin/AdminParts';
import { MarkdownField } from '@/components/admin/MarkdownField';
import { SlugFields } from '@/components/admin/SlugFields';
import { Button, ButtonLink, Card, Field, FormGrid, Input, Notice, Panel, Select, Stack, Textarea } from '@/components/ui';
import { Toggle } from '@/components/ui/Toggle';
import s from '@/components/admin/parts.module.css';

export const metadata = { title: 'Create Job Opening' };

/** Fields map 1:1 to job_openings. Save/publish need the admin careers API (not built yet). */
export default function NewJobOpeningPage() {
  return (
    <form>
      <AdminHeader
        section="Content Management"
        parent={{ label: 'Careers / Job Openings', href: '/admin/careers' }}
        page="Editor"
        title="Create Job Opening"
        description="Create or edit a role using the same controlled content workflow used across AmpliVerify."
        actions={
          <>
            <ButtonLink href="/admin/careers" variant="secondary">
              Cancel
            </ButtonLink>
            <Button variant="secondary" disabled title="Saving requires the careers API">
              Save Draft
            </Button>
            <Button disabled title="Publishing requires the careers API">
              Publish
            </Button>
          </>
        }
      />
      <div style={{ marginBottom: 16 }}>
        <Notice title="Draft editor.">Nothing becomes public until the opening is explicitly published. Required fields are validated by the API.</Notice>
      </div>
      <div className={s.twocol}>
        <Card>
          <SlugFields titleLabel="Job title" titlePlaceholder="Enter job title" />
          <FormGrid>
            <Field label="Department" htmlFor="j-dept">
              <Input id="j-dept" name="department" placeholder="Select or enter department" />
            </Field>
            <Field label="Employment type" htmlFor="j-type">
              <Select id="j-type" name="employmentType" defaultValue="">
                <option value="" disabled>
                  Select employment type
                </option>
                <option value="FULL_TIME">Full-time</option>
                <option value="PART_TIME">Part-time</option>
                <option value="CONTRACT">Contract</option>
                <option value="INTERNSHIP">Internship</option>
              </Select>
            </Field>
            <Field label="Work arrangement" htmlFor="j-arr">
              <Select id="j-arr" name="workArrangement" defaultValue="">
                <option value="">Remote / Hybrid / On-site</option>
                <option value="REMOTE">Remote</option>
                <option value="HYBRID">Hybrid</option>
                <option value="ON_SITE">On-site</option>
              </Select>
            </Field>
            <Field label="Location" htmlFor="j-loc">
              <Input id="j-loc" name="locationText" placeholder="Enter approved location or region" />
            </Field>
          </FormGrid>
          <Field label="Compensation" htmlFor="j-comp" hint="Optional — add only if approved for publication.">
            <Input id="j-comp" name="compensationText" placeholder="Optional" />
          </Field>
          <Field label="Short summary" htmlFor="j-summary">
            <Textarea id="j-summary" name="summary" placeholder="Briefly describe the role and what it contributes to AmpliVerify." style={{ minHeight: 80 }} />
          </Field>
          <Field label="Job description" htmlFor="j-desc">
            <MarkdownField id="j-desc" name="description" placeholder="Write responsibilities, qualifications, expectations, and other approved details here…" />
          </Field>
        </Card>
        <Stack>
          <Panel title="Publishing" description="Control visibility and status.">
            <Field label="Status" htmlFor="j-status">
              <Select id="j-status" name="status" defaultValue="DRAFT">
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="CLOSED">Closed</option>
              </Select>
            </Field>
            <Field label="Publish date" htmlFor="j-pub">
              <Input id="j-pub" value="Set automatically on publish" readOnly disabled />
            </Field>
            <div className={s.row}>
              <span>Show on careers page</span>
              <Toggle label="Show on careers page" defaultChecked name="showOnCareersPage" />
            </div>
          </Panel>
          <Panel title="Application Settings" description="Configure the application workflow.">
            <Field label="Application destination" htmlFor="j-dest">
              <Select id="j-dest" defaultValue="internal">
                <option value="internal">Internal application form</option>
              </Select>
            </Field>
            <Field label="Application deadline" htmlFor="j-deadline" hint="Optional.">
              <Input id="j-deadline" name="applicationDeadline" type="date" />
            </Field>
            <div className={s.row}>
              <span>Require résumé or CV</span>
              <Toggle label="Require résumé or CV" defaultChecked name="requireResume" />
            </div>
            <div className={s.row}>
              <span>Require cover letter</span>
              <Toggle label="Require cover letter" name="requireCoverLetter" />
            </div>
          </Panel>
          <Panel title="Metadata" description="Optional public-page metadata.">
            <Field label="SEO title" htmlFor="j-seo">
              <Input id="j-seo" name="seoTitle" placeholder="Optional" />
            </Field>
            <Field label="Meta description" htmlFor="j-meta">
              <Textarea id="j-meta" name="metaDescription" placeholder="Optional" style={{ minHeight: 70 }} />
            </Field>
          </Panel>
        </Stack>
      </div>
    </form>
  );
}
