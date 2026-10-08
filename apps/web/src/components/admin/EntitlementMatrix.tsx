'use client';

import { ApiForm } from '../ui/actions';
import type { AdminFeature } from '@/lib/admin-data';
import s from './entitlements.module.css';

type Row = { feature: AdminFeature; enabled: boolean; limit: string | null };

const key = (k: string) => k.replace(/\./g, '~');

/**
 * Editable entitlement matrix for one plan: enabled per feature, and a usage
 * limit for LIMIT features (blank = unlimited). Saved as one
 * PUT /admin/plans/:code/entitlements, audited with before/after values.
 */
export function EntitlementMatrix({ planCode, rows }: { planCode: string; rows: Row[] }) {
  return (
    <ApiForm
      method="PUT"
      path={`/admin/plans/${encodeURIComponent(planCode)}/entitlements`}
      submitLabel="Save Changes"
      successMessage="Entitlements saved."
      transform={(values) => ({
        entitlements: rows.map((r) => {
          const k = key(r.feature.key);
          const raw = values[`limit_${k}`];
          return {
            featureKey: r.feature.key,
            enabled: values[`on_${k}`] === true,
            ...(r.feature.valueType === 'LIMIT' ? { limit: raw === null || raw === undefined || raw === '' ? null : Number(raw) } : {}),
          };
        }),
      })}
    >
      <div className={s.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Feature</th>
              <th>Module</th>
              <th>Type</th>
              <th>Enabled</th>
              <th>Usage Limit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const k = key(r.feature.key);
              return (
                <tr key={r.feature.key}>
                  <td>
                    <b>{r.feature.name}</b>
                    <small style={{ display: 'block', color: 'var(--muted)' }}>{r.feature.key}</small>
                  </td>
                  <td className={s.desc}>{r.feature.moduleKey ?? '—'}</td>
                  <td className={s.desc}>{r.feature.valueType === 'LIMIT' ? 'Limit' : r.feature.valueType === 'CONFIG' ? 'Config' : 'Access'}</td>
                  <td>
                    <input type="checkbox" name={`on_${k}`} defaultChecked={r.enabled} aria-label={`${r.feature.name} enabled`} />
                  </td>
                  <td>
                    {r.feature.valueType === 'LIMIT' ? (
                      <input
                        type="number"
                        name={`limit_${k}`}
                        data-type="number"
                        min={0}
                        step="any"
                        defaultValue={r.limit ?? ''}
                        placeholder="Unlimited"
                        aria-label={`${r.feature.name} limit`}
                        className={s.search}
                        style={{ maxWidth: 140 }}
                      />
                    ) : (
                      <span className={s.muted}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ApiForm>
  );
}
