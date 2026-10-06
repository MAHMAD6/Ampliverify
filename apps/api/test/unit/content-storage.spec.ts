import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { ContentStorageService } from '../../src/storage/content-storage.service';

describe('ContentStorageService (local driver)', () => {
  const root = mkdtempSync(join(tmpdir(), 'av-storage-'));
  const storage = new ContentStorageService(new ConfigService({ STORAGE_DIR: root }));

  it('round-trips text and returns null for missing keys', async () => {
    await storage.writeText('cms/blog/hello.md', '# Hello');
    await expect(storage.readText('cms/blog/hello.md')).resolves.toBe('# Hello');
    await expect(storage.readText('cms/blog/missing.md')).resolves.toBeNull();
  });

  it.each(['../etc/passwd', '/etc/passwd', 'cms/../../x', '', '.hidden'])('rejects unsafe key %p', async (key) => {
    await expect(storage.readText(key)).rejects.toThrow('Invalid storage key');
  });
});
