import { Field, FormGrid, Input, Textarea } from '../ui';
import { ApiForm } from '../ui/actions';
import type { SellerProfile } from '@/lib/marketplace';

export function SellerProfileForm({ p, redirectTo }: { p: SellerProfile | null; redirectTo?: string }) {
  return (
    <ApiForm method="PUT" path="/user/marketplace/seller" submitLabel={p ? 'Save profile' : 'Create seller profile'} successMessage={p ? 'Profile saved.' : 'Seller profile created. Next: verify your identity.'} redirectTo={redirectTo}>
      <FormGrid>
        <Field label="Display name" htmlFor="sp-name" hint="Shown to buyers on your listings.">
          <Input id="sp-name" name="displayName" required minLength={2} maxLength={80} defaultValue={p?.displayName} />
        </Field>
        <Field label="Headline (optional)" htmlFor="sp-head">
          <Input id="sp-head" name="headline" maxLength={140} defaultValue={p?.headline ?? ''} placeholder="Founder of two SaaS tools" />
        </Field>
        <Field label="Website (optional)" htmlFor="sp-web">
          <Input id="sp-web" name="website" maxLength={200} defaultValue={p?.website ?? ''} />
        </Field>
        <Field label="Location (optional)" htmlFor="sp-loc">
          <Input id="sp-loc" name="location" maxLength={80} defaultValue={p?.location ?? ''} />
        </Field>
      </FormGrid>
      <Field label="About you (optional)" htmlFor="sp-bio">
        <Textarea id="sp-bio" name="bio" maxLength={2000} rows={4} defaultValue={p?.bio ?? ''} />
      </Field>
    </ApiForm>
  );
}
