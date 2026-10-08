'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { Badge, Button, Field, FormGrid, Input, Panel, SettingRow } from '@/components/ui';
import { ActionMessage } from '@/components/ui/actions';
import { authClient } from '@/lib/auth-client';
import { apiAction } from '@/lib/actions';

type Session = { id: string; token: string; createdAt: string | Date; updatedAt: string | Date; userAgent?: string | null; ipAddress?: string | null };
type Passkey = { id: string; name?: string | null; createdAt: string | Date; deviceType?: string };

const when = (d: string | Date) => new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
const device = (ua?: string | null) => {
  if (!ua) return 'Unknown device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : '';
  return `${browser}${os ? ` on ${os}` : ''}`;
};

/** Profile name (Better Auth + API profile). */
export function ProfileForm({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const displayName = String(new FormData(e.currentTarget).get('name') ?? '').trim();
        setBusy(true);
        setMsg({});
        const { error } = await authClient.updateUser({ name: displayName });
        const api = await apiAction('PATCH', '/user/me', { displayName });
        setBusy(false);
        if (error || !api.ok) return setMsg({ error: error?.message ?? (!api.ok ? api.message : 'Could not save.') });
        setMsg({ ok: 'Profile saved.' });
        router.refresh();
      }}
    >
      <FormGrid>
        <Field label="Full Name" htmlFor="a-name">
          <Input id="a-name" name="name" defaultValue={name} required maxLength={120} />
        </Field>
        <Field label="Email Address" htmlFor="a-email" hint="Contact support to change your sign-in email.">
          <Input id="a-email" value={email} readOnly disabled />
        </Field>
      </FormGrid>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save Profile'}
        </Button>
        <ActionMessage error={msg.error} success={msg.ok} />
      </div>
    </form>
  );
}

/** Password, MFA (TOTP + backup codes), passkeys and active sessions via Better Auth. */
export function AccountSecurity({ twoFactorEnabled, passkeysAllowed = true }: { twoFactorEnabled: boolean; passkeysAllowed?: boolean }) {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [panel, setPanel] = useState<'password' | 'mfa' | null>(null);
  const [mfa, setMfa] = useState<{ qr: string; secret: string; backupCodes: string[] } | null>(null);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [s, p, me] = await Promise.all([
      authClient.listSessions(),
      authClient.$fetch<Passkey[]>('/passkey/list-user-passkeys', { method: 'GET' }),
      authClient.getSession(),
    ]);
    setSessions((s.data as Session[] | null) ?? []);
    setPasskeys((p.data as Passkey[] | null) ?? []);
    setCurrent((me.data?.session as { token?: string } | undefined)?.token ?? null);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<{ error?: { message?: string } | null } | void>, ok: string) => {
    setBusy(true);
    setMsg({});
    try {
      const r = await fn();
      if (r && r.error) setMsg({ error: r.error.message ?? 'Something went wrong.' });
      else {
        setMsg({ ok });
        await load();
        router.refresh();
      }
    } catch {
      setMsg({ error: 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  };

  const changePassword = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const next = String(f.get('newPassword'));
    if (next !== String(f.get('confirm'))) return setMsg({ error: 'The new passwords do not match.' });
    void act(() => authClient.changePassword({ currentPassword: String(f.get('currentPassword')), newPassword: next, revokeOtherSessions: true }), 'Password changed. Other sessions were signed out.');
    setPanel(null);
  };

  const startMfa = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get('password'));
    void act(async () => {
      const r = await authClient.twoFactor.enable({ password });
      if (r.error || !r.data) return r;
      if (r.data.method !== 'totp') return { error: { message: 'Authenticator setup is not available.' } };
      const uri = r.data.totpURI;
      const secret = new URL(uri).searchParams.get('secret') ?? '';
      setMfa({ qr: await QRCode.toDataURL(uri), secret, backupCodes: r.data.backupCodes });
      return r;
    }, 'Scan the code, then enter a code from your app to finish.');
  };

  return (
    <Panel title="Security" description="Manage the sign-in methods available for your account.">
      <SettingRow title="Password" description="Change your password. Other sessions are signed out." control={<Button variant="outline" onClick={() => setPanel(panel === 'password' ? null : 'password')}>Change Password</Button>} />
      {panel === 'password' && (
        <form onSubmit={changePassword} style={{ display: 'grid', gap: 10, maxWidth: 420, margin: '8px 0 16px' }}>
          <Input type="password" name="currentPassword" placeholder="Current password" autoComplete="current-password" required />
          <Input type="password" name="newPassword" placeholder="New password (8+ characters)" autoComplete="new-password" minLength={8} required />
          <Input type="password" name="confirm" placeholder="Confirm new password" autoComplete="new-password" minLength={8} required />
          <Button type="submit" disabled={busy}>
            Update Password
          </Button>
        </form>
      )}

      <SettingRow
        title="Multi-Factor Authentication (MFA)"
        description="Require a code from an authenticator app when signing in."
        control={
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Badge tone={twoFactorEnabled ? 'green' : undefined}>{twoFactorEnabled ? 'Enabled' : 'Not enabled'}</Badge>
            <Button variant="outline" onClick={() => setPanel(panel === 'mfa' ? null : 'mfa')}>
              {twoFactorEnabled ? 'Disable' : 'Enable'}
            </Button>
          </div>
        }
      />
      {panel === 'mfa' && !mfa && (
        <form
          onSubmit={(e) => {
            if (!twoFactorEnabled) return startMfa(e);
            e.preventDefault();
            const password = String(new FormData(e.currentTarget).get('password'));
            void act(() => authClient.twoFactor.disable({ password }), 'Multi-factor authentication disabled.');
            setPanel(null);
          }}
          style={{ display: 'flex', gap: 10, maxWidth: 480, margin: '8px 0 16px' }}
        >
          <Input type="password" name="password" placeholder="Confirm your password" autoComplete="current-password" required />
          <Button type="submit" disabled={busy}>
            {twoFactorEnabled ? 'Disable MFA' : 'Continue'}
          </Button>
        </form>
      )}
      {mfa && (
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, margin: '8px 0 16px', alignItems: 'start' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mfa.qr} alt="Authenticator QR code" width={180} height={180} />
          <div style={{ display: 'grid', gap: 8 }}>
            <small>
              Can’t scan? Enter this key: <code>{mfa.secret}</code>
            </small>
            <small>Save these backup codes somewhere safe — each works once if you lose your device:</small>
            <code style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{mfa.backupCodes.join('   ')}</code>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const code = String(new FormData(e.currentTarget).get('code')).replace(/\s+/g, '');
                void act(async () => {
                  const r = await authClient.twoFactor.verifyTotp({ code });
                  if (!r.error) {
                    setMfa(null);
                    setPanel(null);
                  }
                  return r;
                }, 'Multi-factor authentication is now enabled.');
              }}
              style={{ display: 'flex', gap: 10 }}
            >
              <Input name="code" inputMode="numeric" placeholder="6-digit code" required />
              <Button type="submit" disabled={busy}>
                Verify & Enable
              </Button>
            </form>
          </div>
        </div>
      )}

      {passkeysAllowed && <SettingRow
        title="Passkeys"
        description="Sign in with your device’s fingerprint, face or screen lock."
        control={
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Badge tone={passkeys.length ? 'green' : undefined}>{passkeys.length ? `${passkeys.length} added` : 'Not added'}</Badge>
            <Button variant="outline" disabled={busy} onClick={() => act(() => authClient.passkey.addPasskey({ name: `${device(navigator.userAgent)}` }), 'Passkey added.')}>
              Add Passkey
            </Button>
          </div>
        }
      />}
      {passkeys.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '0 0 12px', padding: 0, display: 'grid', gap: 6 }}>
          {passkeys.map((p) => (
            <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span>
                {p.name ?? 'Passkey'} · added {when(p.createdAt)}
              </span>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => authClient.$fetch('/passkey/delete-passkey', { method: 'POST', body: { id: p.id } }), 'Passkey removed.')}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <SettingRow
        title="Active Sessions"
        description="Devices currently signed in to your account."
        control={
          <Button variant="outline" disabled={busy || sessions.length < 2} onClick={() => act(() => authClient.revokeOtherSessions(), 'Signed out of all other sessions.')}>
            Sign Out Other Sessions
          </Button>
        }
      />
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
        {sessions.map((s) => (
          <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14 }}>
            <span>
              {device(s.userAgent)} {s.token === current && <Badge tone="green">This device</Badge>}
              <br />
              <small style={{ color: 'var(--muted)' }}>Last active {when(s.updatedAt)}</small>
            </span>
            {s.token !== current && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => authClient.revokeSession({ token: s.token }), 'Session signed out.')}>
                Sign out
              </Button>
            )}
          </li>
        ))}
      </ul>
      <ActionMessage error={msg.error} success={msg.ok} />
    </Panel>
  );
}
