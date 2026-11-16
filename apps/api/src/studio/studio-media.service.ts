import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { ContentStorageService } from '../storage/content-storage.service';
import { detectFileType, scanWithClamAv } from '../storage/file-safety';
import { publicOrigin, STUDIO_PERMISSION, text, UUID, validIdentifier } from './studio.security';

/**
 * Editor media pipeline (V13.2 guide §6). States only move forward:
 *   pending → uploading → quarantine → processing → approved | rejected | failed
 *
 * A. init: authorized session, declared type/size checks, short-lived signed upload target.
 * B. upload: the browser posts the file without the AmpliVerify token; the signed target binds it to one media row.
 * C. complete: object size verified, media enters quarantine (never served).
 * D. process (background job): magic bytes, image decompression limits, ClamAV malware scan.
 * E. approve: copied to delivery storage, served at /media/e/<id>.<ext> over HTTPS.
 * F. resolve: links an article's local media block to the approved media.
 */

export const MEDIA_LIMITS = { image: 15 * 1024 * 1024, video: 100 * 1024 * 1024 };
const TYPES: Record<string, { kind: 'image' | 'video'; ext: string[] }> = {
  'image/png': { kind: 'image', ext: ['png'] },
  'image/jpeg': { kind: 'image', ext: ['jpg', 'jpeg'] },
  'image/webp': { kind: 'image', ext: ['webp'] },
  'image/gif': { kind: 'image', ext: ['gif'] },
  'video/mp4': { kind: 'video', ext: ['mp4'] },
  'video/webm': { kind: 'video', ext: ['webm'] },
};
const MAX_PIXELS = 50_000_000;
const MAX_SIDE = 16_384;
const UPLOAD_TTL_MS = 15 * 60 * 1000;
const MAX_OPEN_UPLOADS = 20;
export const MEDIA_QUEUE = 'editor.media.process';

const EXT_OF: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm' };

/** Pixel size from the image header (no decoding). */
export function imageSize(b: Buffer, mime: string): { width: number; height: number } | null {
  try {
    if (mime === 'image/png' && b.length >= 24) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
    if (mime === 'image/gif' && b.length >= 10) return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
    if (mime === 'image/webp' && b.length >= 30) {
      const chunk = b.subarray(12, 16).toString('latin1');
      if (chunk === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
      if (chunk === 'VP8L') {
        const bits = b.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    }
    if (mime === 'image/jpeg') {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) return null;
        const marker = b[i + 1];
        const len = b.readUInt16BE(i + 2);
        if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
          return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
        }
        i += 2 + len;
      }
    }
  } catch {
    return null;
  }
  return null;
}

type Media = NonNullable<Awaited<ReturnType<PrismaService['editorMedia']['findUnique']>>>;

@Injectable()
export class StudioMediaService implements OnModuleInit {
  private readonly logger = new Logger(StudioMediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
    private readonly jobs: JobsService,
    private readonly storage: ContentStorageService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.jobs.register(MEDIA_QUEUE, async (payload) => this.process(String(payload.mediaId)));
    this.jobs.registerPeriodic('editor.media.expire', 30 * 60 * 1000, () => this.expireUploads());
  }

  private secret() {
    const raw = this.config.get<string>('EDITOR_UPLOAD_SECRET') || this.config.get<string>('INTEGRATION_ENCRYPTION_KEY') || this.config.get<string>('AUTH_SYNC_SECRET') || '';
    if (raw.length < 16) throw new ForbiddenException({ code: 'UPLOADS_NOT_CONFIGURED', message: 'Media uploads are not available yet.' });
    return createHash('sha256').update(`editor-upload:${raw}`).digest();
  }

  private sign(id: string, expires: number) {
    return createHmac('sha256', this.secret()).update(`${id}.${expires}`).digest('base64url');
  }

  view(m: Media) {
    return {
      upload_id: m.id,
      media_id: m.id,
      status: m.state,
      kind: m.kind,
      mime: m.detectedMime ?? m.declaredMime,
      size: m.sizeBytes,
      width: m.width,
      height: m.height,
      filename: m.originalFilename,
      url: m.state === 'approved' ? this.deliveryUrl(m) : null,
      error: m.errorCode ? { code: m.errorCode, message: m.errorMessage } : null,
      created_at: m.createdAt,
      approved_at: m.approvedAt,
    };
  }

  deliveryUrl(m: Pick<Media, 'id' | 'detectedMime' | 'declaredMime'>) {
    return `${publicOrigin()}/media/e/${m.id}.${EXT_OF[m.detectedMime ?? m.declaredMime] ?? 'bin'}`;
  }

  /** Phase A: authorized, declared-type and size-limited upload session. */
  async init(userId: string, workspaceId: string, body: Record<string, unknown>) {
    await this.rbac.requireWorkspace(userId, workspaceId, STUDIO_PERMISSION.editor);
    const filename = text(body.filename, 255).trim();
    const mime = String(body.content_type ?? '');
    const size = Number(body.size);
    const type = TYPES[mime];
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    if (!type || !type.ext.includes(ext)) throw new BadRequestException({ code: 'UNSUPPORTED_MEDIA', message: 'Choose a PNG, JPEG, WebP or GIF image, or an MP4 or WebM video.' });
    if (!Number.isSafeInteger(size) || size <= 0 || size > MEDIA_LIMITS[type.kind]) {
      throw new BadRequestException({ code: 'MEDIA_TOO_LARGE', message: type.kind === 'image' ? 'Images can be up to 15 MB.' : 'Videos can be up to 100 MB.' });
    }
    const open = await this.prisma.editorMedia.count({ where: { workspaceId, uploadedBy: userId, state: { in: ['pending', 'uploading'] }, uploadExpiresAt: { gt: new Date() } } });
    if (open >= MAX_OPEN_UPLOADS) throw new ConflictException({ code: 'TOO_MANY_UPLOADS', message: 'Finish or wait for your current uploads first.' });
    const expires = Date.now() + UPLOAD_TTL_MS;
    const media = await this.prisma.editorMedia.create({
      data: { workspaceId, uploadedBy: userId, kind: type.kind, originalFilename: filename.replace(/[^\w.\- ]+/g, '_'), declaredMime: mime, sizeBytes: size, stagingKey: 'pending', uploadExpiresAt: new Date(expires) },
    });
    const stagingKey = `editor-media/staging/${workspaceId}/${media.id}.${EXT_OF[mime]}`;
    await this.prisma.editorMedia.update({ where: { id: media.id }, data: { stagingKey } });
    return {
      upload_id: media.id,
      method: 'POST',
      upload_url: `${publicOrigin()}/api/editor-uploads/${media.id}`,
      fields: { expires: String(expires), signature: this.sign(media.id, expires) },
      max_bytes: size,
      expires_at: new Date(expires).toISOString(),
    };
  }

  /** Phase B: signed direct upload (no AmpliVerify token). The file must match the declared size. */
  async receive(id: string, fields: Record<string, unknown>, file: { buffer: Buffer; size: number } | undefined) {
    if (!UUID.test(id)) throw new NotFoundException({ code: 'UPLOAD_NOT_FOUND', message: 'Upload not found.' });
    const expires = Number(fields.expires);
    const given = Buffer.from(String(fields.signature ?? ''), 'utf8');
    const expected = Buffer.from(Number.isSafeInteger(expires) ? this.sign(id, expires) : '', 'utf8');
    if (!given.length || given.length !== expected.length || !timingSafeEqual(given, expected)) throw new ForbiddenException({ code: 'UPLOAD_SIGNATURE_INVALID', message: 'This upload link is not valid.' });
    if (expires < Date.now()) throw new ForbiddenException({ code: 'UPLOAD_EXPIRED', message: 'This upload link has expired. Start the upload again.' });
    const media = await this.prisma.editorMedia.findUnique({ where: { id } });
    if (!media || media.state !== 'pending') throw new ConflictException({ code: 'UPLOAD_USED', message: 'This upload link was already used.' });
    if (!file?.buffer?.length) throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Attach the file.' });
    if (file.size !== media.sizeBytes) throw new BadRequestException({ code: 'UPLOAD_MISMATCH', message: 'The file does not match the declared size.' });
    const claimed = await this.prisma.editorMedia.updateMany({ where: { id, state: 'pending' }, data: { state: 'uploading' } });
    if (claimed.count !== 1) throw new ConflictException({ code: 'UPLOAD_USED', message: 'This upload link was already used.' });
    try {
      await this.storage.writeBuffer(media.stagingKey, file.buffer, 'application/octet-stream');
    } catch (e) {
      await this.prisma.editorMedia.update({ where: { id }, data: { state: 'failed', errorCode: 'STORAGE_FAILED', errorMessage: 'The file could not be stored.' } });
      throw e;
    }
    return { received: true };
  }

  /** Phase C: verifies the stored object and quarantines it; processing runs in the background. */
  async complete(userId: string, workspaceId: string, body: Record<string, unknown>) {
    await this.rbac.requireWorkspace(userId, workspaceId, STUDIO_PERMISSION.editor);
    const id = String(body.upload_id ?? '');
    const media = UUID.test(id) ? await this.prisma.editorMedia.findFirst({ where: { id, workspaceId, uploadedBy: userId } }) : null;
    if (!media) throw new NotFoundException({ code: 'UPLOAD_NOT_FOUND', message: 'Upload not found.' });
    if (media.state !== 'uploading') {
      if (['quarantine', 'processing', 'approved'].includes(media.state)) return { ...this.view(media), message: this.message(media.state) };
      throw new ConflictException({ code: 'UPLOAD_NOT_RECEIVED', message: media.state === 'pending' ? 'The file has not been uploaded yet.' : 'This upload cannot be completed.' });
    }
    if (String(body.content_type ?? '') !== media.declaredMime || Number(body.size) !== media.sizeBytes) throw new BadRequestException({ code: 'UPLOAD_MISMATCH', message: 'The upload does not match the session.' });
    const stored = await this.storage.readBuffer(media.stagingKey);
    if (!stored || stored.length !== media.sizeBytes) {
      await this.prisma.editorMedia.update({ where: { id }, data: { state: 'failed', errorCode: 'OBJECT_MISMATCH', errorMessage: 'The stored file does not match the upload.' } });
      throw new BadRequestException({ code: 'OBJECT_MISMATCH', message: 'The stored file does not match the upload.' });
    }
    const next = await this.prisma.$transaction(async (tx) => {
      const moved = await tx.editorMedia.updateMany({ where: { id, state: 'uploading' }, data: { state: 'quarantine', sha256: createHash('sha256').update(stored).digest('hex') } });
      if (moved.count === 1) await this.jobs.enqueue(MEDIA_QUEUE, { mediaId: id }, { jobKey: `editor-media:${id}` }, tx);
      return tx.editorMedia.findUniqueOrThrow({ where: { id } });
    });
    await this.audit.record({ actorUserId: userId, workspaceId, action: 'editor.media.upload', targetType: 'editor_media', targetId: id, afterState: { kind: media.kind, size: media.sizeBytes } });
    return { ...this.view(next), message: this.message(next.state) };
  }

  private message(state: string) {
    if (state === 'approved') return 'Media approved.';
    return 'Upload received. It is quarantined until it has been verified and scanned; it is not playable until approved.';
  }

  async status(userId: string, workspaceId: string, id: string) {
    await this.rbac.requireWorkspace(userId, workspaceId, STUDIO_PERMISSION.viewer);
    const media = UUID.test(id) ? await this.prisma.editorMedia.findFirst({ where: { id, workspaceId } }) : null;
    if (!media) throw new NotFoundException({ code: 'MEDIA_NOT_FOUND', message: 'Media not found.' });
    return this.view(media);
  }

  /** Phase F: records which article block now uses the approved media. */
  async resolve(userId: string, workspaceId: string, id: string, body: Record<string, unknown>) {
    await this.rbac.requireWorkspace(userId, workspaceId, STUDIO_PERMISSION.editor);
    const articleKey = validIdentifier(body.article_key, 'article key');
    const localRef = validIdentifier(body.local_ref, 'media reference');
    const media = UUID.test(id) ? await this.prisma.editorMedia.findFirst({ where: { id, workspaceId } }) : null;
    if (!media) throw new NotFoundException({ code: 'MEDIA_NOT_FOUND', message: 'Media not found.' });
    if (media.state !== 'approved') throw new ConflictException({ code: 'MEDIA_NOT_APPROVED', message: 'This media has not been approved yet.' });
    await this.prisma.articleAssetReference.upsert({
      where: { workspaceId_articleKey_localRef: { workspaceId, articleKey, localRef } },
      create: { workspaceId, articleKey, localRef, mediaId: id },
      update: { mediaId: id },
    });
    return this.view(media);
  }

  /** Phases D–E (background job). */
  async process(id: string) {
    const claimed = await this.prisma.editorMedia.updateMany({ where: { id, state: 'quarantine' }, data: { state: 'processing', attempts: { increment: 1 } } });
    if (claimed.count !== 1) return;
    const media = (await this.prisma.editorMedia.findUnique({ where: { id } }))!;
    const fail = async (state: 'rejected' | 'failed', errorCode: string, errorMessage: string) => {
      await this.prisma.editorMedia.update({ where: { id }, data: { state, errorCode, errorMessage } });
      await this.audit.record({ actorUserId: media.uploadedBy, workspaceId: media.workspaceId, action: `editor.media.${state}`, targetType: 'editor_media', targetId: id, afterState: { code: errorCode } });
      if (state === 'rejected') await this.storage.delete(media.stagingKey).catch(() => undefined);
    };
    const bytes = await this.storage.readBuffer(media.stagingKey);
    if (!bytes || bytes.length !== media.sizeBytes) return fail('failed', 'OBJECT_MISSING', 'The uploaded file is no longer available.');
    if (createHash('sha256').update(bytes).digest('hex') !== media.sha256) return fail('rejected', 'OBJECT_CHANGED', 'The stored file changed after upload.');
    const detected = detectFileType(bytes, [media.declaredMime]);
    if (!detected) return fail('rejected', 'TYPE_MISMATCH', 'The file content does not match its type.');
    let dims: { width: number; height: number } | null = null;
    if (media.kind === 'image') {
      dims = imageSize(bytes, media.declaredMime);
      if (!dims || !dims.width || !dims.height) return fail('rejected', 'IMAGE_UNREADABLE', 'The image header could not be read.');
      if (dims.width > MAX_SIDE || dims.height > MAX_SIDE || dims.width * dims.height > MAX_PIXELS) return fail('rejected', 'IMAGE_TOO_LARGE', 'The image dimensions are too large (50 megapixels at most).');
    }
    const scanner = this.config.get<string>('CLAMAV_HOST');
    const scan = await scanWithClamAv(bytes, scanner, Number(this.config.get('CLAMAV_PORT') ?? 3310));
    if (scan === 'INFECTED') return fail('rejected', 'MALWARE_DETECTED', 'The file was rejected by the malware scan.');
    if (scan === 'FAILED') {
      if (media.attempts < 3) {
        await this.prisma.editorMedia.update({ where: { id }, data: { state: 'quarantine' } });
        throw new Error('Malware scan failed; will retry.');
      }
      return fail('failed', 'SCAN_FAILED', 'The malware scan could not be completed.');
    }
    if (scan === null && this.config.get<string>('EDITOR_MEDIA_SCAN') !== 'off') {
      return fail('failed', 'SCANNER_UNAVAILABLE', 'Malware scanning is not configured, so the file stays private.');
    }
    const deliveryKey = `editor-media/public/${media.workspaceId}/${media.id}.${EXT_OF[media.declaredMime]}`;
    await this.storage.writeBuffer(deliveryKey, bytes, media.declaredMime);
    await this.prisma.editorMedia.update({
      where: { id },
      data: { state: 'approved', detectedMime: detected.mime, deliveryKey, width: dims?.width ?? null, height: dims?.height ?? null, scanResult: scan ?? 'NOT_SCANNED', approvedAt: new Date(), errorCode: null, errorMessage: null },
    });
    await this.storage.delete(media.stagingKey).catch(() => undefined);
    await this.audit.record({ actorUserId: media.uploadedBy, workspaceId: media.workspaceId, action: 'editor.media.approved', targetType: 'editor_media', targetId: id, afterState: { scan: scan ?? 'NOT_SCANNED' } });
  }

  /** Expired, never-completed uploads are failed and their staging objects removed. */
  async expireUploads() {
    const stale = await this.prisma.editorMedia.findMany({ where: { state: { in: ['pending', 'uploading'] }, uploadExpiresAt: { lt: new Date(Date.now() - 60_000) } }, take: 200 });
    for (const m of stale) {
      const moved = await this.prisma.editorMedia.updateMany({ where: { id: m.id, state: m.state }, data: { state: 'failed', errorCode: 'UPLOAD_EXPIRED', errorMessage: 'The upload was not completed in time.' } });
      if (moved.count === 1 && m.state === 'uploading') await this.storage.delete(m.stagingKey).catch(() => undefined);
    }
  }

  /** Approved media for public delivery (published articles reference these URLs). */
  async deliverable(file: string) {
    const match = /^([0-9a-f-]{36})\.(png|jpg|webp|gif|mp4|webm)$/.exec(file);
    if (!match || !UUID.test(match[1])) throw new NotFoundException({ code: 'MEDIA_NOT_FOUND', message: 'Not found.' });
    const media = await this.prisma.editorMedia.findUnique({ where: { id: match[1] } });
    if (!media || media.state !== 'approved' || !media.deliveryKey || EXT_OF[media.detectedMime ?? media.declaredMime] !== match[2]) throw new NotFoundException({ code: 'MEDIA_NOT_FOUND', message: 'Not found.' });
    return media;
  }

  /** Approved media of this workspace referenced by the article HTML (for exports). */
  async referenced(workspaceId: string, urls: string[], maxBytes = 250 * 1024 * 1024) {
    const prefix = `${publicOrigin()}/media/e/`;
    const ids = [...new Set(urls.filter((u) => u.startsWith(prefix)).map((u) => u.slice(prefix.length).split('.')[0]))].filter((id) => UUID.test(id));
    const rows = ids.length ? await this.prisma.editorMedia.findMany({ where: { id: { in: ids }, workspaceId, state: 'approved' } }) : [];
    const out = new Map<string, { bytes: Buffer; mime: string; width: number | null; height: number | null; name: string }>();
    let total = 0;
    for (const m of rows) {
      if (total + m.sizeBytes > maxBytes) break;
      const bytes = m.deliveryKey ? await this.storage.readBuffer(m.deliveryKey) : null;
      if (!bytes) continue;
      total += bytes.length;
      out.set(this.deliveryUrl(m), { bytes, mime: m.detectedMime ?? m.declaredMime, width: m.width, height: m.height, name: m.originalFilename });
    }
    return out;
  }
}
