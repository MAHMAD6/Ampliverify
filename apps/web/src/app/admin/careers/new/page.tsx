import { JobEditor } from '@/components/admin/JobEditor';

export const metadata = { title: 'Create Job Opening' };

export default function NewJobOpeningPage() {
  return <JobEditor job={null} />;
}
