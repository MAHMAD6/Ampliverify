'use client';

import { RouteError } from '@/components/app/RouteStates';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <RouteError title="Failed to load recommendations" reset={reset} />;
}
