'use client';

import { useRef, useState } from 'react';
import { Markdown } from '../public/Markdown';
import { Textarea } from '../ui';
import s from './parts.module.css';

const TOOLS: { label: string; title: string; before: string; after?: string; line?: boolean; block?: string }[] = [
  { label: 'H2', title: 'Heading', before: '## ', line: true },
  { label: 'H3', title: 'Subheading', before: '### ', line: true },
  { label: 'B', title: 'Bold', before: '**', after: '**' },
  { label: 'I', title: 'Italic', before: '*', after: '*' },
  { label: '• List', title: 'Bulleted list', before: '- ', line: true },
  { label: '1. List', title: 'Numbered list', before: '1. ', line: true },
  { label: '❝', title: 'Quote', before: '> ', line: true },
  { label: 'Link', title: 'Link', before: '[', after: '](https://)' },
  { label: 'Image', title: 'Image', before: '![', after: '](https://)' },
  { label: '</>', title: 'Code', before: '`', after: '`' },
  { label: 'Table', title: 'Table', before: '', block: '| Column | Column |\n| --- | --- |\n| Value | Value |' },
  { label: '—', title: 'Divider', before: '', block: '---' },
];

export type ContentBlock = { label: string; hint: string; icon: React.ReactNode; markdown: string };

/**
 * Markdown body editor with Write / Preview (rendered exactly like the public
 * site), word count and optional insertable content blocks. Raw HTML is never
 * rendered.
 */
export function MarkdownField({ id, name, placeholder, blocks, minHeight = 260 }: { id: string; name: string; placeholder: string; blocks?: ContentBlock[]; minHeight?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState('');
  const [past, setPast] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;

  const commit = (next: string) => {
    setPast((p) => [...p.slice(-50), value]);
    setFuture([]);
    setValue(next);
  };
  const insertBlock = (block: string) => {
    const el = ref.current;
    const at = el ? el.selectionEnd : value.length;
    const before = value.slice(0, at);
    const sep = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
    commit(before + sep + block + '\n\n' + value.slice(at));
    setPreview(false);
  };
  const apply = (tool: (typeof TOOLS)[number]) => {
    if (tool.block) return insertBlock(tool.block);
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    if (tool.line) {
      const start = value.lastIndexOf('\n', a - 1) + 1;
      commit(value.slice(0, start) + tool.before + value.slice(start));
    } else {
      commit(value.slice(0, a) + tool.before + (value.slice(a, b) || 'text') + (tool.after ?? '') + value.slice(b));
    }
    requestAnimationFrame(() => el.focus());
  };

  return (
    <>
      <div className={s.editor}>
        <div className={s.toolbar} role="toolbar" aria-label="Formatting">
          {TOOLS.map((t) => (
            <button key={t.label} type="button" className={s.tool} title={t.title} aria-label={t.title} onClick={() => apply(t)} disabled={preview}>
              {t.label}
            </button>
          ))}
          <button
            type="button"
            className={s.tool}
            disabled={!past.length || preview}
            aria-label="Undo"
            onClick={() => {
              setFuture((f) => [value, ...f]);
              setValue(past[past.length - 1]);
              setPast((p) => p.slice(0, -1));
            }}
          >
            ↶
          </button>
          <button
            type="button"
            className={s.tool}
            disabled={!future.length || preview}
            aria-label="Redo"
            onClick={() => {
              setPast((p) => [...p, value]);
              setValue(future[0]);
              setFuture((f) => f.slice(1));
            }}
          >
            ↷
          </button>
          <span className={s.modes} role="tablist">
            <button type="button" role="tab" aria-selected={!preview} className={!preview ? s.modeOn : undefined} onClick={() => setPreview(false)}>
              Write
            </button>
            <button type="button" role="tab" aria-selected={preview} className={preview ? s.modeOn : undefined} onClick={() => setPreview(true)}>
              Preview
            </button>
          </span>
        </div>
        {preview ? (
          <div className={s.preview} style={{ minHeight }}>
            {value.trim() ? <Markdown source={value} /> : <p className={s.previewEmpty}>Nothing to preview yet.</p>}
          </div>
        ) : null}
        <Textarea
          ref={ref}
          id={id}
          name={name}
          value={value}
          hidden={preview}
          style={{ minHeight }}
          onChange={(e) => commit(e.target.value)}
          placeholder={placeholder}
        />
        <div className={s.count}>{words.toLocaleString('en-US')} words</div>
      </div>
      {blocks && blocks.length > 0 && (
        <div className={s.blocks}>
          <b>
            Content Blocks <span>(Optional)</span>
          </b>
          <small>Quickly add pre-formatted sections to improve readability and engagement.</small>
          <div className={s.blockGrid}>
            {blocks.map((bl) => (
              <button key={bl.label} type="button" className={s.block} onClick={() => insertBlock(bl.markdown)}>
                {bl.icon}
                <span>
                  <b>{bl.label}</b>
                  <small>{bl.hint}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
