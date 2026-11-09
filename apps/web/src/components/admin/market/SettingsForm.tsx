'use client';

import type { ReactNode } from 'react';
import { ApiForm } from '@/components/ui/actions';

/** Commission is edited as a percentage and stored in basis points. */
export function SettingsForm({ children }: { children: ReactNode }) {
  return (
    <ApiForm
      method="PUT"
      path="/admin/marketplace/settings"
      submitLabel="Save settings"
      successMessage="Marketplace settings saved."
      transform={(d) => ({ ...d, commissionBps: Math.round(Number(d.commissionBps) * 100) })}
    >
      {children}
    </ApiForm>
  );
}
