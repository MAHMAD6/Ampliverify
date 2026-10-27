'use client';

import { Toaster as SonnerToaster } from 'sonner';

/** App-wide toast host (Sonner). Toasts confirm actions; inline messages stay for form errors. */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      duration={4000}
      toastOptions={{ style: { fontFamily: 'var(--font-inter), system-ui, sans-serif', borderRadius: 'var(--radius)' } }}
    />
  );
}
