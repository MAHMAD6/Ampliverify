import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { promises as fs } from 'fs';
import { isAbsolute, join, normalize, resolve, sep } from 'path';

/**
 * Object storage for large bodies referenced by *_ref / storage_key columns
 * (guide §2: the database keeps metadata and keys, not large payloads).
 *
 * Drivers: local filesystem (STORAGE_DIR, default) for development and tests,
 * or any S3-compatible bucket — AWS S3, Cloudflare R2 (S3_REGION=auto,
 * S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com) — with STORAGE_DRIVER=s3 (S3_BUCKET, S3_REGION,
 * optional S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY). Objects are
 * private; after its own authorization checks the API streams them (local) or
 * hands out a short-lived signed URL (S3, S3_SIGNED_URL_SECONDS, default 300).
 */
@Injectable()
export class ContentStorageService {
  private readonly logger = new Logger(ContentStorageService.name);
  private readonly root: string;
  private readonly s3: S3Client | null = null;
  private readonly bucket: string | null = null;
  private readonly signedSeconds: number;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>('STORAGE_DIR') ?? 'storage');
    this.signedSeconds = Number(config.get<string>('S3_SIGNED_URL_SECONDS') ?? 300);
    if (config.get<string>('STORAGE_DRIVER') === 's3') {
      this.bucket = config.get<string>('S3_BUCKET') ?? null;
      if (!this.bucket) throw new Error('S3_BUCKET is required when STORAGE_DRIVER=s3.');
      const endpoint = config.get<string>('S3_ENDPOINT');
      const accessKeyId = config.get<string>('S3_ACCESS_KEY_ID');
      const secretAccessKey = config.get<string>('S3_SECRET_ACCESS_KEY');
      this.s3 = new S3Client({
        region: config.get<string>('S3_REGION') ?? 'us-east-1',
        ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
        // S3-compatible stores (Cloudflare R2, MinIO…) reject the SDK's default
        // flexible checksums on some operations; send them only when required.
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
        ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
      });
    }
  }

  get driver() {
    return this.s3 ? 's3' : 'local';
  }

  /** Returns the UTF-8 body for `key`, or null when it does not exist. */
  async readText(key: string): Promise<string | null> {
    const buf = await this.readBuffer(key);
    return buf ? buf.toString('utf8') : null;
  }

  async writeText(key: string, body: string): Promise<void> {
    await this.writeBuffer(key, Buffer.from(body, 'utf8'), 'text/markdown; charset=utf-8');
  }

  async readBuffer(key: string): Promise<Buffer | null> {
    this.validate(key);
    if (this.s3) {
      try {
        const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket!, Key: key }));
        return Buffer.from(await res.Body!.transformToByteArray());
      } catch (error) {
        const name = (error as { name?: string }).name;
        if (name !== 'NoSuchKey' && name !== 'NotFound') this.logger.error(`Failed to read storage key "${key}": ${(error as Error).message}`);
        return null;
      }
    }
    try {
      return await fs.readFile(this.pathFor(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error(`Failed to read storage key "${key}": ${(error as Error).message}`);
      }
      return null;
    }
  }

  async writeBuffer(key: string, body: Buffer, contentType = 'application/octet-stream'): Promise<void> {
    this.validate(key);
    if (this.s3) {
      await this.s3.send(new PutObjectCommand({ Bucket: this.bucket!, Key: key, Body: body, ContentType: contentType }));
      return;
    }
    const path = this.pathFor(key);
    await fs.mkdir(join(path, '..'), { recursive: true });
    await fs.writeFile(path, body);
  }

  /**
   * Short-lived signed GET URL for a private object (V1 manual §11: least
   * privilege + short-lived signed URLs). Null on the local driver, where the
   * API streams the file itself.
   */
  async signedUrl(key: string, opts: { filename?: string; contentType?: string; inline?: boolean; expiresInSeconds?: number } = {}): Promise<{ url: string; expiresAt: Date } | null> {
    this.validate(key);
    if (!this.s3) return null;
    const seconds = Math.min(Math.max(opts.expiresInSeconds ?? this.signedSeconds, 30), 3600);
    const disposition = opts.filename ? `${opts.inline ? 'inline' : 'attachment'}; filename="${opts.filename.replace(/["\\\r\n]/g, '')}"` : undefined;
    const url = await getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket!, Key: key, ...(disposition ? { ResponseContentDisposition: disposition } : {}), ...(opts.contentType ? { ResponseContentType: opts.contentType } : {}) }), { expiresIn: seconds });
    return { url, expiresAt: new Date(Date.now() + seconds * 1000) };
  }

  async delete(key: string): Promise<void> {
    this.validate(key);
    if (this.s3) {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket!, Key: key }));
      return;
    }
    await fs.rm(this.pathFor(key), { force: true });
  }

  /** Keys are relative, slash-separated and may not escape the storage root. */
  private validate(key: string) {
    if (!/^[A-Za-z0-9][A-Za-z0-9/_.-]*$/.test(key) || key.includes('..') || isAbsolute(key)) {
      throw new Error(`Invalid storage key "${key}".`);
    }
  }

  private pathFor(key: string) {
    this.validate(key);
    const path = normalize(join(this.root, key));
    if (!path.startsWith(this.root + sep)) throw new Error(`Invalid storage key "${key}".`);
    return path;
  }
}
