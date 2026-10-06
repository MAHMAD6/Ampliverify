import Link from 'next/link';
import {
  Briefcase,
  CalendarDays,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Layers,
  LibraryBig,
  PlayCircle,
  Plus,
  Tags,
  UserPen,
  Zap,
} from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminParts';
import { ButtonLink, Card, Grid, IconCircle, Panel, Select, type Tone } from '@/components/ui';
import s from '@/components/admin/content.module.css';

export const metadata = { title: 'Content Management' };

type Module = { key: string; title: string; text: string; cta: string; href: string; icon: React.ReactNode; tone: Tone };

const MODULES: Module[] = [
  { key: 'blog', title: 'Blog Posts', text: 'Create and manage blog articles to share insights and updates.', cta: 'Manage Blog Posts', href: '/admin/blog', icon: <FileText size={24} />, tone: 'blue' },
  { key: 'categories', title: 'Categories & Tags', text: 'Organize content with categories and tags.', cta: 'Manage Categories', href: '/admin/categories', icon: <Tags size={24} />, tone: 'green' },
  { key: 'authors', title: 'Authors', text: 'Manage author profiles and contributions.', cta: 'Manage Authors', href: '/admin/authors', icon: <UserPen size={24} />, tone: 'purple' },
  { key: 'videos', title: 'Videos', text: 'Upload and manage videos for your content library.', cta: 'Manage Videos', href: '/admin/videos', icon: <PlayCircle size={24} />, tone: 'red' },
  { key: 'events', title: 'Webinars & Events', text: 'Create and manage webinars, virtual events, and recordings.', cta: 'Manage Events', href: '/admin/events', icon: <CalendarDays size={24} />, tone: 'blue' },
  { key: 'resources', title: 'Resources & Downloads', text: 'Manage downloadable resources such as guides, templates, and tools.', cta: 'Manage Resources', href: '/admin/resources', icon: <LibraryBig size={24} />, tone: 'amber' },
  { key: 'case-studies', title: 'Case Studies', text: 'Showcase customer stories and success examples.', cta: 'Manage Case Studies', href: '/admin/case-studies', icon: <Layers size={24} />, tone: 'blue' },
  { key: 'media', title: 'Media Library', text: 'Manage images, files, and other media assets.', cta: 'Manage Media', href: '/admin/media', icon: <ImageIcon size={24} />, tone: 'green' },
  { key: 'careers', title: 'Careers / Job Openings', text: 'Create and manage job openings and applications.', cta: 'Manage Careers', href: '/admin/careers', icon: <Briefcase size={24} />, tone: 'purple' },
];

const STATS: { label: string; note: string; icon: React.ReactNode; tone: Tone }[] = [
  { label: 'Blog Posts', note: 'Published', icon: <FileText size={22} />, tone: 'blue' },
  { label: 'Resources', note: 'Published', icon: <LibraryBig size={22} />, tone: 'green' },
  { label: 'Webinars & Events', note: 'Published', icon: <CalendarDays size={22} />, tone: 'purple' },
  { label: 'Videos', note: 'Published', icon: <PlayCircle size={22} />, tone: 'red' },
  { label: 'Case Studies', note: 'Published', icon: <Layers size={22} />, tone: 'amber' },
  { label: 'Job Openings', note: 'Active', icon: <Briefcase size={22} />, tone: 'blue' },
];

const QUICK = [
  ['New Blog Post', '/admin/blog/new'],
  ['New Video', '/admin/videos'],
  ['New Resource', '/admin/blog/new?type=guide'],
  ['New Event', '/admin/events'],
  ['New Case Study', '/admin/case-studies'],
  ['New Job Opening', '/admin/careers/new'],
];

/** Counts and activity come from the admin content API (not built yet), so they show "—" / "No activity yet". */
export default function ContentManagementPage() {
  return (
    <>
      <AdminHeader
        section="Content Management"
        page="Content Overview"
        title="Content Management"
        description="Create, manage, and organize all website content across blogs, resources, webinars, case studies, media, and careers."
        actions={
          <>
            <ButtonLink href="/" variant="outline" icon={<ExternalLink size={16} />}>
              View Website
            </ButtonLink>
            <Select aria-label="Date range" defaultValue="30" style={{ width: 170 }} disabled>
              <option value="30">Last 30 days</option>
            </Select>
          </>
        }
      />
      <div className={s.stats}>
        {STATS.map((st) => (
          <Card key={st.label} className={s.stat}>
            <IconCircle tone={st.tone} size={48}>
              {st.icon}
            </IconCircle>
            <div>
              <span>{st.label}</span>
              <strong>—</strong>
              <small>{st.note}</small>
            </div>
          </Card>
        ))}
      </div>

      <div className={s.layout}>
        <div>
          <h2 style={{ fontSize: 22, margin: '4px 0 14px' }}>Content Management Modules</h2>
          <Grid cols={3}>
            {MODULES.map((m) => (
              <Card key={m.key} className={s.module}>
                <Link href={m.href} className={s.moduleHead}>
                  <IconCircle tone={m.tone} size={52}>
                    {m.icon}
                  </IconCircle>
                  <strong>{m.title}</strong>
                  <ChevronRight size={18} />
                </Link>
                <p>{m.text}</p>
                <ButtonLink href={m.href} variant="outline" block>
                  {m.cta}
                </ButtonLink>
              </Card>
            ))}
          </Grid>
        </div>
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <Panel title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Zap size={20} color="var(--amber)" /> Quick Actions</span>} flushHead>
            <div className={s.quick}>
              {QUICK.map(([label, href]) => (
                <ButtonLink key={label} href={href} variant="outline" icon={<Plus size={16} />}>
                  {label}
                </ButtonLink>
              ))}
            </div>
          </Panel>
          <Panel title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Clock3 size={20} color="var(--blue)" /> Recent Content Activity</span>} flushHead>
            {STATS.map((st) => (
              <div key={st.label} className={s.activity}>
                <IconCircle tone={st.tone} size={40}>
                  {st.icon}
                </IconCircle>
                <div>
                  <strong>{st.label === 'Resources' ? 'Resources & Downloads' : st.label}</strong>
                  <span>No activity yet</span>
                </div>
              </div>
            ))}
          </Panel>
        </div>
      </div>

      <div className={s.banner}>
        <IconCircle tone="blue" size={64}>
          <ImageIcon size={28} />
        </IconCircle>
        <div>
          <h3>Manage your website content</h3>
          <p>Use the modules above to create, organize, and publish content across your website. All content is managed here and appears on the live site when published.</p>
        </div>
        <ButtonLink href="/" icon={<ExternalLink size={16} />}>
          View Live Website
        </ButtonLink>
      </div>
    </>
  );
}
