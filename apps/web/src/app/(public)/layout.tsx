import { Plus_Jakarta_Sans } from 'next/font/google';
import { SiteFooter } from '@/components/public/SiteFooter';
import { SiteHeader } from '@/components/public/SiteHeader';
import s from '@/components/public/site.module.css';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${s.site} ${jakarta.variable}`}>
      <SiteHeader />
      <main className={s.main}>{children}</main>
      <SiteFooter />
    </div>
  );
}
