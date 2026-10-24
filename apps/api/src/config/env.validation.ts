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
  for (const key of ['GOOGLE_TOKEN_ENCRYPTION_KEY'] as const) {
    const v = config[key];
    if (typeof v === 'string' && v !== '' && v.length < 32) throw new Error(`${key} must be at least 32 characters long.`);
  }
  const redirect = config.GOOGLE_REDIRECT_URI;
  if (typeof redirect === 'string' && redirect !== '') {
    let u: URL | null = null;
    try {
      u = new URL(redirect);
    } catch {
      throw new Error('GOOGLE_REDIRECT_URI must be an absolute URL.');
    }
    if (config.NODE_ENV === 'production' && u.protocol !== 'https:') throw new Error('GOOGLE_REDIRECT_URI must use https in production.');
  }
  const redis = config.REDIS_URL;
  if (typeof redis === 'string' && redis !== '' && !/^rediss?:\/\//.test(redis)) throw new Error('REDIS_URL must start with redis:// or rediss://.');
  if (config.STORAGE_DRIVER === 's3') {
    for (const key of ['S3_BUCKET'] as const) if (typeof config[key] !== 'string' || config[key] === '') throw new Error(`${key} is required when STORAGE_DRIVER=s3.`);
    const endpoint = config.S3_ENDPOINT;
    if (typeof endpoint === 'string' && endpoint !== '' && !/^https?:\/\//.test(endpoint)) throw new Error('S3_ENDPOINT must be an http(s) URL.');
  }

  const encryptionKey = config.INTEGRATION_ENCRYPTION_KEY;
  if (typeof encryptionKey === 'string' && encryptionKey !== '' && encryptionKey.length < 32) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY must be at least 32 characters long.');
  }

  return config;
}
