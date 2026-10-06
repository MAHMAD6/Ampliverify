import { SiteFooter } from '@/components/public/SiteFooter';
import { SiteHeader } from '@/components/public/SiteHeader';
import s from '@/components/public/public.module.css';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.site}>
      <SiteHeader />
      <main className={s.main}>{children}</main>
      <SiteFooter />
    </div>
  );
}
