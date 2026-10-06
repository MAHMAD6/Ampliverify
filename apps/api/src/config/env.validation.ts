export function validateEnv(config: Record<string, unknown>) {
  const required = [
    'DATABASE_URL',
    'BETTER_AUTH_JWKS_URL',
    'BETTER_AUTH_ISSUER',
    'BETTER_AUTH_AUDIENCE',
    'AUTH_SYNC_SECRET',
  ] as const;

  for (const key of required) {
    const value = config[key];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  const syncSecret = String(config.AUTH_SYNC_SECRET);
  if (syncSecret.length < 32) {
    throw new Error('AUTH_SYNC_SECRET must be at least 32 characters long.');
  }

  return config;
}
