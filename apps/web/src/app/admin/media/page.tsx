import { Image as ImageIcon, Upload } from 'lucide-react';
import { AdminHeader, Dropzone, Guidelines, ListPanel, MetricRow } from '@/components/admin/AdminParts';
import { Button, Grid, Panel } from '@/components/ui';

export const metadata = { title: 'Media Library' };

export default function MediaLibraryPage() {
  return (
    <>
      <AdminHeader
        section="Content Management"
        title="Media Library"
        description="Upload, organize, and reuse approved media assets across AmpliVerify content."
        actions={
          <Button icon={<Upload size={16} />} disabled>
            Upload Media
          </Button>
        }
      />
      <MetricRow
        items={[
          { label: 'Media Files', note: 'No files uploaded yet' },
          { label: 'Images', note: 'No image assets yet' },
          { label: 'Documents', note: 'No documents yet' },
          { label: 'Storage Used', note: 'Calculated from stored files' },
        ]}
      />
      <Grid cols={2} style={{ marginBottom: 16 }}>
        <Panel title="Upload Media" description="Add approved files for use across content workflows." flushHead>
          <Dropzone icon={<Upload size={28} />} title="Drop files here or choose files" hint="Allowed file types and size limits are enforced on upload." />
        </Panel>
        <Guidelines
          title="Library Guidance"
          description="Keep reusable assets organized and traceable."
          items={[
            'Use descriptive file names and alt text where applicable.',
            'Do not expose internal or unapproved files on public pages.',
            'Uploader, file type, size, and usage references are recorded automatically.',
            'Assets in use cannot be deleted without an explicit replacement.',
          ]}
        />
      </Grid>
      <ListPanel
        title="Media Library"
        description="Uploaded assets will appear here."
        search="Search media..."
        selects={['All file types', 'Newest first']}
        emptyIcon={<ImageIcon size={26} />}
        emptyTitle="No media files yet"
        emptyText="Upload an approved file to start the library."
      />
    </>
  );
}
