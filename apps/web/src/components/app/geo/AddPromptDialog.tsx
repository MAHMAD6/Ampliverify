'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageSquareText, Plus, X } from 'lucide-react';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';
import { ApiForm } from '@/components/ui/actions';
import type { GeoPlatformStatus } from '@/lib/app-types';
import b from '@/components/app/billing/billing.module.css';
import s from './geo.module.css';

/**
 * Add Prompt dialog. Creates a tracked prompt (POST geo/prompts) and opens
 * its detail page. Platforms without a configured provider are shown but
 * cannot be selected; the credit estimate comes from the plan's `geo.check`
 * cost per platform.
 */
export function AddPromptDialog({
  projectId,
  platforms,
  defaultPlatforms,
  defaultCountry,
  creditPerPlatform,
  label = 'Add Prompt',
  size = 'lg',
}: {
  projectId: string;
  platforms: GeoPlatformStatus[];
  defaultPlatforms?: string[];
  defaultCountry?: string | null;
  creditPerPlatform: number | null;
  label?: string;
  size?: 'md' | 'lg';
}) {
  const [open, setOpen] = useState(false);
  const usable = platforms.filter((p) => p.configured);
  const initial = new Set((defaultPlatforms?.length ? defaultPlatforms : usable.map((p) => p.key)).filter((k) => usable.some((p) => p.key === k)));
  const [picked, setPicked] = useState(initial.size);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  const estimate = creditPerPlatform === null ? null : creditPerPlatform * picked;

  return (
    <>
      <Button size={size} icon={<Plus size={18} />} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <dialog ref={dialog} className={b.dialog} style={{ width: 'min(640px, calc(100vw - 32px))' }} onClose={() => setOpen(false)} aria-labelledby="add-prompt-title">
        <div className={b.dialogHead}>
          <span className={b.dbIcon}>
            <MessageSquareText size={22} />
          </span>
          <div>
            <h2 id="add-prompt-title">Add Prompt</h2>
            <p>Track how AI search platforms answer a question your customers ask.</p>
          </div>
          <button className={b.close} aria-label="Close" onClick={() => setOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: '6px 22px 22px' }}>
          {open && (
            <ApiForm
              path={`/user/projects/${projectId}/geo/prompts`}
              submitLabel="Add Prompt"
              successMessage={null}
              redirectTo="/app/geo/prompts/{id}"
            >
              <div style={{ display: 'grid', gap: 14 }}>
                <Field label="Prompt or question" htmlFor="geo-prompt">
                  <Textarea id="geo-prompt" name="prompt" rows={3} required minLength={3} maxLength={500} placeholder="e.g. What is the best SEO audit tool for small businesses?" />
                </Field>
                <fieldset className={s.platformPick}>
                  <legend>Platforms</legend>
                  {platforms.length === 0 && <small>No AI search platforms are enabled yet.</small>}
                  {platforms.map((p) => (
                    <label key={p.key} title={p.configured ? undefined : 'This platform is not available yet.'}>
                      <input
                        type="checkbox"
                        name="platformKeys"
                        data-type="array"
                        value={p.key}
                        defaultChecked={initial.has(p.key)}
                        disabled={!p.configured}
                        onChange={(e) => setPicked((n) => n + (e.currentTarget.checked ? 1 : -1))}
                      />
                      {p.name}
                      {!p.configured && <small> (unavailable)</small>}
                    </label>
                  ))}
                </fieldset>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                  <Field label="Check frequency" htmlFor="geo-cadence">
                    <Select id="geo-cadence" name="cadence" defaultValue="WEEKLY">
                      <option value="MANUAL">Manual only</option>
                      <option value="DAILY">Daily</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                    </Select>
                  </Field>
                  <Field label="Country (optional)" htmlFor="geo-country" hint="2-letter code, e.g. US">
                    <Input id="geo-country" name="country" data-type="code" maxLength={2} defaultValue={defaultCountry ?? ''} placeholder="US" />
                  </Field>
                  <Field label="Tags (optional)" htmlFor="geo-tags" hint="Comma separated">
                    <Input id="geo-tags" name="tags" data-type="list" placeholder="brand, pricing" />
                  </Field>
                </div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                  <input type="checkbox" name="runNow" defaultChecked />
                  Run the first check now
                  {estimate !== null && (
                    <small style={{ color: 'var(--muted)' }}>
                      ({estimate} credit{estimate === 1 ? '' : 's'} for {picked} platform{picked === 1 ? '' : 's'})
                    </small>
                  )}
                </label>
              </div>
            </ApiForm>
          )}
        </div>
      </dialog>
    </>
  );
}
