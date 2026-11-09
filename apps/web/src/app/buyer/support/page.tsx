import { BookOpen, LifeBuoy, Mail, ShieldAlert } from 'lucide-react';
import { ButtonLink, Grid, PageHeader, Panel } from '@/components/ui';
import { getPlatformInfo } from '@/lib/platform';
import m from '@/components/market/market.module.css';

export const metadata = { title: 'Support · Marketplace' };

export default async function BuyerSupportPage() {
  const platform = await getPlatformInfo();
  return (
    <>
      <PageHeader title="Marketplace Support" description="Help with buying, selling, payments and downloads." />
      <Grid cols={2}>
        <Panel title="How the Marketplace works" actions={<BookOpen size={18} aria-hidden />}>
          <p className={m.muted}>Introductions, offers, due diligence, digital-product checkout and refunds explained.</p>
          <div className={m.actions}>
            <ButtonLink href="/marketplace/how-it-works" variant="outline" size="sm">
              How it works
            </ButtonLink>
            <ButtonLink href="/marketplace/faq" variant="outline" size="sm">
              Marketplace FAQ
            </ButtonLink>
          </div>
        </Panel>
        <Panel title="A problem with a purchase?" actions={<ShieldAlert size={18} aria-hidden />}>
          <p className={m.muted}>Open the purchase or transaction and use Report an Issue / Request Refund. Our team reviews every request.</p>
          <ButtonLink href="/buyer/transactions" variant="outline" size="sm">
            My Transactions
          </ButtonLink>
        </Panel>
        <Panel title="Help Center" actions={<LifeBuoy size={18} aria-hidden />}>
          <p className={m.muted}>Guides for your account, security and billing.</p>
          <ButtonLink href="/help" variant="outline" size="sm">
            Open Help Center
          </ButtonLink>
        </Panel>
        <Panel title="Contact us" actions={<Mail size={18} aria-hidden />}>
          <p className={m.muted}>{platform.supportEmail ? `Email ${platform.supportEmail} or use the contact form.` : 'Use the contact form and we will reply by email.'}</p>
          <ButtonLink href="/contact" variant="outline" size="sm">
            Contact support
          </ButtonLink>
        </Panel>
      </Grid>
    </>
  );
}
