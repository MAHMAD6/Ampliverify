import { Plus_Jakarta_Sans } from 'next/font/google';
import s from '@/components/public/site.module.css';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });

/** Full-screen auth layout (no site header/footer), public-website-v2/12-Sign-Up. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${s.site} ${jakarta.variable}`}>{children}</div>;
}
