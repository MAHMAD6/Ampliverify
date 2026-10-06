import { humanize } from '@/lib/format';
import type { JobSummary } from '@/lib/types';

/** Public facts about a role, in display order. */
export function jobChips(job: JobSummary) {
  return [job.department, job.locationText, humanize(job.employmentType), job.workArrangement && humanize(job.workArrangement)].filter(Boolean) as string[];
}
