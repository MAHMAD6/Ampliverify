import { validateEnv } from '../../src/config/env.validation';

describe('validateEnv', () => {
  const valid = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    BETTER_AUTH_JWKS_URL: 'http://localhost:3000/api/auth/jwks',
    BETTER_AUTH_ISSUER: 'http://localhost:3000',
    BETTER_AUTH_AUDIENCE: 'ampliverify-api',
    AUTH_SYNC_SECRET: 'a'.repeat(32),
  };

  it('accepts the required environment', () => {
    expect(validateEnv({ ...valid })).toEqual(valid);
  });

  it('rejects a missing required variable', () => {
    expect(() => validateEnv({ ...valid, DATABASE_URL: '' })).toThrow('DATABASE_URL');
  });

  it('rejects a short sync secret', () => {
    expect(() => validateEnv({ ...valid, AUTH_SYNC_SECRET: 'too-short' })).toThrow('at least 32');
  });
});

describe('validateEnv production guards', () => {
  const base = { DATABASE_URL: 'postgres://x', BETTER_AUTH_JWKS_URL: 'http://web/jwks', BETTER_AUTH_ISSUER: 'i', BETTER_AUTH_AUDIENCE: 'a', AUTH_SYNC_SECRET: 's'.repeat(32) };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { validateEnv } = require('../../src/config/env.validation') as typeof import('../../src/config/env.validation');

  it('refuses development-only switches in production', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production', AUDIT_ALLOW_PRIVATE_HOSTS: 'true' })).toThrow(/AUDIT_ALLOW_PRIVATE_HOSTS/);
    expect(() => validateEnv({ ...base, NODE_ENV: 'production', EMAIL_LOG_ONLY: 'true' })).toThrow(/EMAIL_LOG_ONLY/);
    expect(() => validateEnv({ ...base, NODE_ENV: 'development', AUDIT_ALLOW_PRIVATE_HOSTS: 'true' })).not.toThrow();
  });

  it('requires a long integration encryption key when set', () => {
    expect(() => validateEnv({ ...base, INTEGRATION_ENCRYPTION_KEY: 'short' })).toThrow(/INTEGRATION_ENCRYPTION_KEY/);
  });

  it('validates Google, Redis and S3 settings', () => {
    expect(() => validateEnv({ ...base, GOOGLE_TOKEN_ENCRYPTION_KEY: 'short' })).toThrow(/GOOGLE_TOKEN_ENCRYPTION_KEY/);
    expect(() => validateEnv({ ...base, NODE_ENV: 'production', GOOGLE_REDIRECT_URI: 'http://ampliverify.com/cb' })).toThrow(/https/);
    expect(() => validateEnv({ ...base, GOOGLE_REDIRECT_URI: 'not a url' })).toThrow(/absolute URL/);
    expect(() => validateEnv({ ...base, REDIS_URL: 'localhost:6379' })).toThrow(/REDIS_URL/);
    expect(() => validateEnv({ ...base, STORAGE_DRIVER: 's3' })).toThrow(/S3_BUCKET/);
    expect(validateEnv({ ...base, NODE_ENV: 'production', GOOGLE_REDIRECT_URI: 'https://ampliverify.com/app/integrations/google/callback', REDIS_URL: 'redis://127.0.0.1:6379/5', STORAGE_DRIVER: 's3', S3_BUCKET: 'b', S3_REGION: 'auto', S3_ENDPOINT: 'https://acc.r2.cloudflarestorage.com' })).toBeTruthy();
  });
});
