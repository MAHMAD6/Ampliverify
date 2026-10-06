import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, CircleAlert, Loader, Lock, Sparkles, UsersRound } from 'lucide-react';
import { ButtonLink } from '.';
import s from './state.module.css';

/**
 * The approved page states (docs/design/user-app-batch2a). `default` is the
 * page itself; every other state renders through this component so wording,
 * tone and actions stay consistent across modules:
 *
 * - empty: no data yet, with the module's first action
 * - loading: fetching data
 * - processing: background work (optional progress and step list)
 * - success: work finished
 * - error: failed, with Try Again
 * - lowCredits: only when the user starts a credit-using action
 * - planRestricted: feature not on the current plan → View Plans
 * - permissionRestricted: insufficient role → contact the workspace admin
 */
export type StateKind =
  | 'empty'
  | 'loading'
  | 'processing'
  | 'success'
  | 'error'
  | 'lowCredits'
  | 'planRestricted'
  | 'permissionRestricted';

const ICONS: Record<StateKind, ReactNode> = {
  empty: null,
  loading: <Loader size={34} className={s.spin} />,
  processing: <Sparkles size={30} />,
  success: <CheckCircle2 size={34} />,
  error: <AlertCircle size={34} />,
  lowCredits: <CircleAlert size={32} />,
  planRestricted: <Lock size={32} />,
  permissionRestricted: <UsersRound size={32} />,
};

export type StateStep = { label: string; percent?: number };

export function StateView({
  kind,
  title,
  description,
  icon,
  action,
  secondary,
  progress,
  steps,
  compact,
}: {
  kind: StateKind;
  title: ReactNode;
  description?: ReactNode;
  /** Overrides the state's default icon (used by `empty`). */
  icon?: ReactNode;
  action?: ReactNode;
  secondary?: ReactNode;
  /** 0–100, processing only. Omitted when the backend reports no progress. */
  progress?: number;
  steps?: StateStep[];
  compact?: boolean;
}) {
  return (
    <div
      className={`${s.state} ${s[kind]} ${compact ? s.compact : ''}`}
      role={kind === 'error' ? 'alert' : kind === 'loading' || kind === 'processing' ? 'status' : undefined}
      aria-live={kind === 'loading' || kind === 'processing' ? 'polite' : undefined}
    >
      <div className={s.icon}>{icon ?? ICONS[kind]}</div>
      <div className={s.title}>{title}</div>
      {description && <p className={s.text}>{description}</p>}
      {typeof progress === 'number' && (
        <div className={s.bar} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}
      {steps && steps.length > 0 && (
        <ul className={s.steps}>
          {steps.map((step) => (
            <li key={step.label}>
              <span>{step.label}</span>
              {typeof step.percent === 'number' && <b>{step.percent}%</b>}
            </li>
          ))}
        </ul>
      )}
      {(action || secondary) && (
        <div className={s.actions}>
          {action}
          {secondary}
        </div>
      )}
    </div>
  );
}

/** Plan restriction with the standard View Plans action. */
export function PlanRestricted({ feature }: { feature: string }) {
  return (
    <StateView
      kind="planRestricted"
      title="Upgrade required"
      description={`${feature} ${feature.endsWith('s') ? 'are' : 'is'} available on higher plans.`}
      action={<ButtonLink href="/app/billing">View Plans</ButtonLink>}
    />
  );
}

/** Insufficient role for the current scope. */
export function PermissionRestricted({ action }: { action: string }) {
  return <StateView kind="permissionRestricted" title={`You don’t have permission to ${action}.`} description="Contact your workspace admin." />;
}

/**
 * Low credits: shown only when the user starts a credit-using action and the
 * balance from the API is below the action's cost.
 */
export function LowCredits({ title, cost, balance }: { title: string; cost: number; balance: number }) {
  return (
    <StateView
      kind="lowCredits"
      title={title}
      description={`This action requires ${cost.toLocaleString()} credits. You have ${balance.toLocaleString()} credits remaining.`}
      action={<ButtonLink href="/app/usage" variant="outline">Add Credits</ButtonLink>}
    />
  );
}
