import { SeoEditor } from '@/components/app/editor/SeoEditor';
import { getAppContext } from '@/lib/project';

export const metadata = { title: 'On-Page SEO Editor' };

export default async function EditorPage() {
  const { selectedProject } = await getAppContext();
  return <SeoEditor projectId={selectedProject?.id ?? null} projectName={selectedProject?.name ?? null} />;
}
