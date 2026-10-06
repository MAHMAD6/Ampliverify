import Link from 'next/link';
import { FileText, ImageIcon, LayoutGrid, Link2, List, Plus, RefreshCw, Download, Search, Trash2, Upload } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import { AdminHeader } from '@/components/admin/AdminParts';
import s from '@/components/admin/media.module.css';

export const metadata = { title: 'Media Library' };

const TABS = [
  ['all', 'All Media'],
  ['images', 'Images'],
  ['videos', 'Videos'],
  ['documents', 'Documents'],
] as const;

/**
 * Media Library (chat design 2026-10-06). Assets live in `media_assets` with
 * storage keys; there is no admin media API or upload pipeline (validation,
 * scanning, storage) yet, so upload and file actions are disabled.
 */
export default async function MediaLibraryPage({ searchParams }: { searchParams: Promise<{ tab?: string; view?: string }> }) {
  const { tab = 'all', view = 'grid' } = await searchParams;
  return (
    <>
      <AdminHeader
        section="Content Management"
        title="Media Library"
        description="Upload, organize, and manage images, videos, and documents for your content."
        actions={
          <Button icon={<Plus size={18} />} disabled title="Uploads need the media API (storage, validation and scanning).">
            Upload Media
          </Button>
        }
      />
      <section className={s.panel}>
        <nav className={s.tabs} aria-label="Media type">
          {TABS.map(([k, l]) => (
            <Link key={k} href={k === 'all' ? '/admin/media' : `/admin/media?tab=${k}`} className={k === tab ? s.on : undefined} aria-current={k === tab ? 'page' : undefined}>
              {l}
            </Link>
          ))}
        </nav>
        <div className={s.filters}>
          <Input icon={<Search size={16} />} placeholder="Search files..." aria-label="Search files" disabled />
          <Select disabled aria-label="Type">
            <option>All Types</option>
          </Select>
          <Select disabled aria-label="Usage">
            <option>All Usage</option>
          </Select>
          <Select disabled aria-label="Sort">
            <option>Newest First</option>
          </Select>
          <span className={s.views}>
            <Link href={`/admin/media?${new URLSearchParams({ ...(tab !== 'all' && { tab }), view: 'grid' })}`} aria-label="Grid view" className={view === 'grid' ? s.viewOn : undefined}>
              <LayoutGrid size={18} />
            </Link>
            <Link href={`/admin/media?${new URLSearchParams({ ...(tab !== 'all' && { tab }), view: 'list' })}`} aria-label="List view" className={view === 'list' ? s.viewOn : undefined}>
              <List size={18} />
            </Link>
          </span>
        </div>
        <div className={s.body}>
          <div className={s.drop} aria-disabled="true">
            <span className={s.dropIcon}>
              <ImageIcon size={40} />
            </span>
            <b>No media files yet</b>
            <p>Upload images, videos, or documents to use in your blog posts, resources, and other content.</p>
            <Button icon={<Upload size={18} />} disabled>
              Upload Media
            </Button>
            <span>Or drag and drop files here</span>
            <small>Supported formats: JPG, PNG, GIF, WebP, MP4, MOV, PDF and more.</small>
          </div>
          <aside className={s.details}>
            <span className={s.fileIcon}>
              <FileText size={36} />
            </span>
            <b>No file selected</b>
            <p>Select a file from the library to view details and manage options.</p>
            <dl>
              {['File name', 'File type', 'File size', 'Dimensions', 'Uploaded', 'Used in'].map((k) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>—</dd>
                </div>
              ))}
            </dl>
            <Button variant="secondary" block disabled icon={<Link2 size={16} />}>
              Copy URL
            </Button>
            <div className={s.actions}>
              <Button variant="secondary" size="sm" disabled icon={<RefreshCw size={14} />}>
                Replace
              </Button>
              <Button variant="secondary" size="sm" disabled icon={<Download size={14} />}>
                Download
              </Button>
              <Button variant="secondary" size="sm" disabled icon={<Trash2 size={14} />}>
                Delete
              </Button>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
