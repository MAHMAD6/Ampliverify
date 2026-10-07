import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * AES-256-GCM envelope for third-party credentials stored in the database
 * (`integration_tokens.*_secret_ref`). The key comes from
 * INTEGRATION_ENCRYPTION_KEY (any length; hashed to 32 bytes). Secrets are
 * never returned to the browser.
 */
export class SecretBox {
  private readonly key: Buffer;

  constructor(secret: string) {
    if (!secret || secret.length < 32) throw new Error('INTEGRATION_ENCRYPTION_KEY must be at least 32 characters.');
    this.key = createHash('sha256').update(secret).digest();
  }

  seal(plain: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${body.toString('base64url')}`;
  }

  open(sealed: string) {
    const [version, iv, tag, body] = sealed.split('.');
    if (version !== 'v1' || !iv || !tag || !body) throw new Error('Unsupported secret format.');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
  }
}
