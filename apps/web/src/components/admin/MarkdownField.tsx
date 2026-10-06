'use client';

import { useRef, useState } from 'react';
import { Textarea } from '../ui';
import s from './parts.module.css';

const TOOLS: { label: string; before: string; after?: string; line?: boolean }[] = [
  { label: 'H2', before: '## ', line: true },
  { label: 'H3', before: '### ', line: true },
  { label: 'B', before: '**', after: '**' },
  { label: 'I', before: '*', after: '*' },
  { label: 'Link', before: '[', after: '](https://)' },
  { label: '• List', before: '- ', line: true },
  { label: '1. List', before: '1. ', line: true },
  { label: 'Quote', before: '> ', line: true },
];

/** Markdown body editor; the public site renders the same markdown. */
export function MarkdownField({ id, name, placeholder }: { id: string; name: string; placeholder: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState('');
  const [past, setPast] = useState<string[]>([]);

  const apply = (tool: (typeof TOOLS)[number]) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    let next: string;
    if (tool.line) {
      const start = value.lastIndexOf('\n', a - 1) + 1;
      next = value.slice(0, start) + tool.before + value.slice(start);
    } else {
      next = value.slice(0, a) + tool.before + (value.slice(a, b) || 'text') + (tool.after ?? '') + value.slice(b);
    }
    setPast((p) => [...p.slice(-30), value]);
    setValue(next);
    requestAnimationFrame(() => el.focus());
  };

  return (
    <div className={s.editor}>
      <div className={s.toolbar} role="toolbar" aria-label="Formatting">
        {TOOLS.map((t) => (
          <button key={t.label} type="button" className={s.tool} onClick={() => apply(t)}>
            {t.label}
          </button>
        ))}
        <button
          type="button"
          className={s.tool}
          disabled={!past.length}
          onClick={() => {
            setValue(past[past.length - 1]);
            setPast((p) => p.slice(0, -1));
          }}
        >
          Undo
        </button>
      </div>
      <Textarea
        ref={ref}
        id={id}
        name={name}
        value={value}
        onChange={(e) => {
          setPast((p) => [...p.slice(-30), value]);
          setValue(e.target.value);
        }}
        placeholder={placeholder}
      />
    </div>
  );
}
