'use client';

import type { ComponentProps } from 'react';
import { Select } from '.';

/** A select that submits its parent GET form on change (falls back to the hidden submit button without JS). */
export function AutoSubmitSelect(props: ComponentProps<'select'>) {
  return <Select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
