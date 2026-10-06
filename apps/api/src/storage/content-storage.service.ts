import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { isAbsolute, join, normalize, resolve, sep } from 'path';

/**
 * Object storage for large bodies referenced by *_ref / storage_key columns
 * (guide §2: the database keeps metadata and keys, not large payloads).
 *
 * This is the local-filesystem driver used in development and tests
 * (STORAGE_DIR). A cloud driver (S3/GCS) can implement the same two methods.
 */
@Injectable()
export class ContentStorageService {
  private readonly logger = new Logger(ContentStorageService.name);
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>('STORAGE_DIR') ?? 'storage');
  }

  /** Returns the UTF-8 body for `key`, or null when it does not exist. */
  async readText(key: string): Promise<string | null> {
    const path = this.pathFor(key);
    try {
      return await fs.readFile(path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error(`Failed to read storage key "${key}": ${(error as Error).message}`);
      }
      return null;
    }
  }

  async writeText(key: string, body: string): Promise<void> {
    const path = this.pathFor(key);
    await fs.mkdir(join(path, '..'), { recursive: true });
    await fs.writeFile(path, body, 'utf8');
  }

  /** Keys are relative, slash-separated and may not escape the storage root. */
  private pathFor(key: string) {
    if (!/^[A-Za-z0-9][A-Za-z0-9/_.-]*$/.test(key) || key.includes('..') || isAbsolute(key)) {
      throw new Error(`Invalid storage key "${key}".`);
    }
    const path = normalize(join(this.root, key));
    if (!path.startsWith(this.root + sep)) throw new Error(`Invalid storage key "${key}".`);
    return path;
  }
}
