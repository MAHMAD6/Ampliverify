import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'AmpliVerify — SEO Engineering', template: '%s · AmpliVerify' },
  description: 'Audit, optimize and verify your SEO and AI search visibility in one structured workflow.',
  icons: { icon: '/brand/mark-transparent.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
