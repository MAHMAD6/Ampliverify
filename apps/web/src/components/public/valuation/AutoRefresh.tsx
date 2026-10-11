'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Re-renders the server page every few seconds while a valuation is calculating. */
export function AutoRefresh({ everyMs = 4000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(t);
  }, [router, everyMs]);
  return null;
}
