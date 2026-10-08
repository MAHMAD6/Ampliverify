import 'server-only';
import { apiGet } from './api';

export type PlatformInfo = { platformName: string; platformUrl: string | null; supportEmail: string | null; allowSignup: boolean; allowPasskeys: boolean; maintenance: { enabled: boolean; message: string | null } };

const DEFAULTS: PlatformInfo = { platformName: 'AmpliVerify', platformUrl: null, supportEmail: null, allowSignup: true, allowPasskeys: true, maintenance: { enabled: false, message: null } };

/** Public platform settings (Super Admin → Settings), cached briefly; defaults when the API is unreachable. */
export async function getPlatformInfo(): Promise<PlatformInfo> {
  const r = await apiGet<PlatformInfo>('/public/platform', { revalidate: 30 });
  return r.ok ? r.data : DEFAULTS;
}
