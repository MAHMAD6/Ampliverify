import { validateEnv } from '../src/config/env.validation';

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
    const invalid = { ...valid, DATABASE_URL: '' };
    expect(() => validateEnv(invalid)).toThrow('DATABASE_URL');
  });

  it('rejects a short sync secret', () => {
    const invalid = { ...valid, AUTH_SYNC_SECRET: 'too-short' };
    expect(() => validateEnv(invalid)).toThrow('at least 32');
  });
});
