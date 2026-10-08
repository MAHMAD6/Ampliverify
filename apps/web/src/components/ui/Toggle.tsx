'use client';

import { useState } from 'react';
import s from './ui.module.css';

/**
 * Switch control. Uncontrolled by default; pass `disabled` when the setting
 * has no backend to persist it yet so the UI never pretends to save.
 */
export function Toggle({
  label,
  defaultChecked = false,
  checked,
  onChange,
  disabled,
  name,
}: {
  label: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
  name?: string;
}) {
  const [internal, setInternal] = useState(defaultChecked);
  const on = checked ?? internal;
  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        className={s.toggle}
        disabled={disabled}
        onClick={() => {
          const next = !on;
          if (checked === undefined) setInternal(next);
          onChange?.(next);
        }}
      />
      {name && <input type="hidden" name={name} data-type="bool" value={on ? 'on' : 'off'} />}
    </>
  );
}
