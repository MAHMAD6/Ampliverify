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

  // Production safety: settings that are only acceptable for local development.
  if (config.NODE_ENV === 'production') {
    if (config.AUDIT_ALLOW_PRIVATE_HOSTS === 'true') {
      throw new Error('AUDIT_ALLOW_PRIVATE_HOSTS must not be enabled in production (it lets audits and integrations reach internal addresses).');
    }
    if (config.EMAIL_LOG_ONLY === 'true') {
      throw new Error('EMAIL_LOG_ONLY must not be enabled in production.');
    }
  }
  const encryptionKey = config.INTEGRATION_ENCRYPTION_KEY;
  if (typeof encryptionKey === 'string' && encryptionKey !== '' && encryptionKey.length < 32) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY must be at least 32 characters long.');
  }

  return config;
}
