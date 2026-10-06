import { BookOpen } from 'lucide-react';
import { ConnectWebsite } from '@/components/app/cms/ConnectWebsite';
import { ButtonLink, PageHeader } from '@/components/ui';
import { appCrumbs } from '@/lib/nav';

export const metadata = { title: 'Connect Your Website' };

export default function CmsConnectionPage() {
  return (
    <>
      <PageHeader
        title="Connect Your Website"
        description="Connect your website or CMS to publish optimized content directly from AmpliVerify."
        crumbs={appCrumbs({ label: 'Settings', href: '/app/settings/account' }, { label: 'Integrations', href: '/app/settings/integrations' }, { label: 'CMS Connection' })}
        actions={
          <ButtonLink href="/help?q=connect%20website" variant="outline" icon={<BookOpen size={18} />}>
            View Help Guide
          </ButtonLink>
        }
      />
      <ConnectWebsite />
    </>
  );
}
