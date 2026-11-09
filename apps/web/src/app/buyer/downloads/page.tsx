import Link from 'next/link';
import { Download } from 'lucide-react';
import { ButtonLink, DataTable, PageHeader, Panel } from '@/components/ui';
import { Empty, LoadError } from '@/components/market/parts';
import { apiGet } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { type Download as Row, fileSize } from '@/lib/marketplace';

export const metadata = { title: 'My Downloads · Marketplace' };

/** Only files you are entitled to; each download is checked and logged, and links expire after a few minutes. */
export default async function DownloadsPage() {
  const res = await apiGet<Row[]>('/user/marketplace/my/downloads', { auth: true });
  return (
    <>
      <PageHeader title="My Downloads" description="Files from your paid digital-product orders. Access ends if an order is fully refunded." />
      {!res.ok ? (
        <LoadError what="Your downloads" />
      ) : res.data.length === 0 ? (
        <Empty icon={<Download size={40} />} title="No downloads yet" description="Files from your digital-product purchases appear here after payment is confirmed." action={<ButtonLink href="/buyer/browse?kind=DIGITAL_PRODUCT">Browse digital products</ButtonLink>} />
      ) : (
        <Panel bodyless>
          <DataTable
            columns={['File', 'Product', 'Size', 'Downloads', 'Access', '']}
            rows={res.data.map((d) => [
              d.filename,
              <Link key="p" href={`/buyer/purchases/${d.orderId}`}>
                {d.listing.title}
              </Link>,
              fileSize(d.sizeBytes),
              d.downloads,
              d.state === 'AVAILABLE' ? 'Available' : d.state === 'REVOKED' ? 'Access ended' : 'Unavailable',
              d.state === 'AVAILABLE' ? (
                <ButtonLink key="d" href={`/api/files/user/marketplace/downloads/${d.id}/file`} size="sm" variant="outline" icon={<Download size={14} />}>
                  Download
                </ButtonLink>
              ) : (
                formatDateTime(d.createdAt)
              ),
            ])}
          />
        </Panel>
      )}
    </>
  );
}
