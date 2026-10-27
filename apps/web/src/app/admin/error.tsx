'use client';

import { RouteError } from '@/components/app/RouteStates';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError title="This page could not be loaded" reset={reset} />;
}
