'use client';

import { RotateCcw } from 'lucide-react';
import { Button, Panel } from '../ui';
import { StateView } from '../ui/StateView';

/** `loading.tsx` body: shown while a module's server data is fetched. */
export function RouteLoading({ label }: { label: string }) {
  return (
    <Panel>
      <StateView kind="loading" title={label} />
    </Panel>
  );
}

/** `error.tsx` body: the module failed to render or its data failed to load. */
export function RouteError({ title, description, reset }: { title: string; description?: string; reset: () => void }) {
  return (
    <Panel>
      <StateView
        kind="error"
        title={title}
        description={description ?? 'Please check your connection and try again.'}
        action={
          <Button onClick={reset} icon={<RotateCcw size={16} />}>
            Try Again
          </Button>
        }
      />
    </Panel>
  );
}
