'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, ChevronRight, Info, X } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { Toggle } from '@/components/ui/Toggle';
import s from './dashboard.module.css';

export type Step = { key: string; title: string; text: string; href: string; cta: string; icon: React.ReactNode; tone: string; done: boolean };

const HIDE_KEY = 'av-dashboard:hide-completed';
const NOTE_KEY = 'av-dismissed:dashboard-steps-note';

function read(key: string) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
function write(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // storage unavailable: the preference lasts for this page view only
  }
}

/**
 * Next Steps from the Dashboard design. Completion is derived on the server
 * from real data; "Hide completed" and the dismissed note are per-browser
 * conveniences.
 */
export function NextSteps({ steps, numbered }: { steps: Step[]; numbered: boolean }) {
  const [hideCompleted, setHideCompleted] = useState(true);
  const [noteHidden, setNoteHidden] = useState(false);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HIDE_KEY);
      if (stored !== null) setHideCompleted(stored === '1');
    } catch {
      // keep default
    }
    setNoteHidden(read(NOTE_KEY));
  }, []);

  const visible = hideCompleted ? steps.filter((st) => !st.done) : steps;

  return (
    <section className={s.panel}>
      <header className={s.panelHead}>
        <div>
          <h2>Next Steps</h2>
          <p>Complete these steps to get the most from AmpliVerify.</p>
        </div>
        <div className={s.toggleRow}>
          <span>Hide completed</span>
          <Toggle
            label="Hide completed steps"
            checked={hideCompleted}
            onChange={(v) => {
              setHideCompleted(v);
              write(HIDE_KEY, v);
            }}
          />
        </div>
      </header>
      <ol className={`${s.steps} ${numbered ? s.stepsNumbered : ''}`}>
        {visible.map((st, i) => (
          <li key={st.key} className={st.done ? s.stepDone : undefined}>
            {numbered && <span className={s.stepNum} data-tone={st.tone}>{st.done ? <Check size={14} /> : i + 1}</span>}
            <span className={s.stepIcon} data-tone={st.tone}>
              {st.icon}
            </span>
            <span className={s.stepBody}>
              <b>{st.title}</b>
              <small>{st.text}</small>
            </span>
            {numbered ? (
              <ButtonLink href={st.href} variant="secondary" size="sm" className={s.stepBtn}>
                {st.cta}
              </ButtonLink>
            ) : (
              <Link href={st.href} className={s.stepLink} aria-label={st.cta}>
                <ChevronRight size={18} />
              </Link>
            )}
          </li>
        ))}
        {visible.length === 0 && <li className={s.allDone}>All steps are complete.</li>}
      </ol>
      {!noteHidden && (
        <div className={s.note}>
          <Info size={18} />
          <span>These steps will update automatically as you complete them.</span>
          <button
            aria-label="Dismiss"
            onClick={() => {
              setNoteHidden(true);
              write(NOTE_KEY, true);
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </section>
  );
}
