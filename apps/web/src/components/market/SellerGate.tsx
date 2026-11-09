import { Store } from 'lucide-react';
import { ButtonLink } from '../ui';
import { Empty } from './parts';

/** Seller-only pages before onboarding: a neutral prompt instead of seller data. */
export function SellerGate() {
  return <Empty icon={<Store size={40} />} title="Start selling first" description="Create your seller profile to list assets, receive inquiries and get paid." action={<ButtonLink href="/seller">Start Selling</ButtonLink>} />;
}
