import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import { isAbsolute, join, normalize, resolve, sep } from 'path';

/**
 * Object storage for large bodies referenced by *_ref / storage_key columns
 * (guide §2: the database keeps metadata and keys, not large payloads).
 *
 * Drivers: local filesystem (STORAGE_DIR, default) for development and tests,
 * or any S3-compatible bucket with STORAGE_DRIVER=s3 (S3_BUCKET, S3_REGION,
 * optional S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY). Objects are
 * private; the API streams them after its own authorization checks.
 */
@Injectable()
export class ContentStorageService {
  private readonly logger = new Logger(ContentStorageService.name);
  private readonly root: string;
  private readonly s3: S3Client | null = null;
  private readonly bucket: string | null = null;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>('STORAGE_DIR') ?? 'storage');
    if (config.get<string>('STORAGE_DRIVER') === 's3') {
      this.bucket = config.get<string>('S3_BUCKET') ?? null;
      if (!this.bucket) throw new Error('S3_BUCKET is required when STORAGE_DRIVER=s3.');
      const endpoint = config.get<string>('S3_ENDPOINT');
      const accessKeyId = config.get<string>('S3_ACCESS_KEY_ID');
      const secretAccessKey = config.get<string>('S3_SECRET_ACCESS_KEY');
      this.s3 = new S3Client({
        region: config.get<string>('S3_REGION') ?? 'us-east-1',
        ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
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
