import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplicationStatus, JobStatus, Prisma, WorkArrangement } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { AuditService } from '../audit/audit.service';
import { JobsService } from '../jobs/jobs.service';
import { ContentStorageService } from '../storage/content-storage.service';
import { EmailService } from '../notifications/email.service';
import { RequestMeta } from '../common/types/request-meta.type';
import { slugify } from '../common/utils/slug';
import { detectFileType, DOCUMENT_TYPES, scanWithClamAv } from '../storage/file-safety';

export type JobInput = {
  title?: string;
  slug?: string;
  department?: string | null;
  locationText?: string | null;
  employmentType?: string;
  workArrangement?: WorkArrangement | null;
  compensationText?: string | null;
  summary?: string | null;
  description?: string;
  showOnCareersPage?: boolean;
  applicationDeadline?: string | null;
  requireResume?: boolean;
  requireCoverLetter?: boolean;
  seoTitle?: string | null;
  metaDescription?: string | null;
  status?: JobStatus;
};

export type ApplicationInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  message?: string;
  website?: string;
};

type UploadedFile = { buffer: Buffer; size: number; originalname: string };

const MAX_FILE = 10 * 1024 * 1024;

/**
 * Careers: job openings (Super Admin, `careers.manage`) and public job
 * applications with résumé / cover-letter uploads. Files are type-checked by
 * content, size-limited, stored under random keys and malware-scanned
 * (ClamAV) before an administrator can download them.
 */
@Injectable()
export class CareersService implements OnModuleInit {
  private readonly logger = new Logger(CareersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly auditLog: AuditService,
    private readonly jobs: JobsService,
    private readonly storage: ContentStorageService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.jobs.register('careers.scan', async (p) => this.scan(String(p.fileId)));
  }

  private guard(userId: string) {
    return this.rbac.assertGlobalPermission(userId, 'careers.manage');
  }

  // ── Openings ───────────────────────────────────────────────────────────

  async list(userId: string, status?: JobStatus) {
    await this.guard(userId);
    return this.prisma.jobOpening.findMany({
      where: status ? { status } : {},
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { applications: true } } },
    });
  }

  async get(userId: string, id: string) {
    await this.guard(userId);
    const job = await this.prisma.jobOpening.findUnique({ where: { id }, include: { _count: { select: { applications: true } } } });
    if (!job) throw new NotFoundException({ code: 'JOB_NOT_FOUND', message: 'Job opening not found.' });
    const { descriptionRef, ...rest } = job;
    return { ...rest, description: (await this.storage.readText(descriptionRef)) ?? '' };
  }

  private async slug(wanted: string, exceptId?: string) {
    let slug = slugify(wanted, `job-${Date.now()}`);
    for (let i = 2; i < 50; i++) {
      const found = await this.prisma.jobOpening.findUnique({ where: { slug } });
      if (!found || found.id === exceptId) return slug;
      slug = `${slugify(wanted, 'job')}-${i}`;
    }
    throw new ConflictException({ code: 'SLUG_TAKEN', message: 'Choose a different URL slug.' });
  }

  private statusFields(input: JobInput, current?: { status: JobStatus; publishedAt: Date | null; closedAt: Date | null }) {
    if (!input.status) return {};
    return {
      status: input.status,
      publishedAt: input.status === 'PUBLISHED' ? current?.publishedAt ?? new Date() : current?.publishedAt ?? null,
      closedAt: input.status === 'CLOSED' ? new Date() : input.status === 'PUBLISHED' ? null : current?.closedAt ?? null,
    };
  }

  async create(userId: string, input: JobInput, meta?: RequestMeta) {
    await this.guard(userId);
    if (!input.title?.trim() || !input.employmentType) throw new BadRequestException({ code: 'JOB_INVALID', message: 'Title and employment type are required.' });
    const id = randomUUID();
    const descriptionRef = `careers/${id}.md`;
    await this.storage.writeText(descriptionRef, input.description ?? '');
    const job = await this.prisma.jobOpening.create({
      data: {
        id,
        title: input.title.trim(),
        slug: await this.slug(input.slug || input.title),
        department: input.department ?? null,
        locationText: input.locationText ?? null,
        employmentType: input.employmentType,
        workArrangement: input.workArrangement ?? null,
        compensationText: input.compensationText ?? null,
        summary: input.summary ?? null,
        descriptionRef,
        showOnCareersPage: input.showOnCareersPage ?? true,
        applicationDeadline: input.applicationDeadline ? new Date(input.applicationDeadline) : null,
        requireResume: input.requireResume ?? true,
        requireCoverLetter: input.requireCoverLetter ?? false,
        seoTitle: input.seoTitle ?? null,
        metaDescription: input.metaDescription ?? null,
        ...this.statusFields(input),
      },
    });
    await this.auditLog.record({ actorUserId: userId, actorRole: 'admin', action: 'job.create', targetType: 'job_opening', targetId: id, afterState: { title: job.title, status: job.status }, requestMeta: meta });
    return this.get(userId, id);
  }

  async update(userId: string, id: string, input: JobInput, meta?: RequestMeta) {
    await this.guard(userId);
    const current = await this.prisma.jobOpening.findUnique({ where: { id } });
    if (!current) throw new NotFoundException({ code: 'JOB_NOT_FOUND', message: 'Job opening not found.' });
    if (input.description !== undefined) await this.storage.writeText(current.descriptionRef, input.description);
    const data: Prisma.JobOpeningUpdateInput = {
      ...(input.title !== undefined && { title: input.title.trim() }),
      ...(input.slug !== undefined && { slug: await this.slug(input.slug, id) }),
      ...(input.department !== undefined && { department: input.department }),
      ...(input.locationText !== undefined && { locationText: input.locationText }),
      ...(input.employmentType !== undefined && { employmentType: input.employmentType }),
      ...(input.workArrangement !== undefined && { workArrangement: input.workArrangement }),
      ...(input.compensationText !== undefined && { compensationText: input.compensationText }),
      ...(input.summary !== undefined && { summary: input.summary }),
      ...(input.showOnCareersPage !== undefined && { showOnCareersPage: input.showOnCareersPage }),
      ...(input.applicationDeadline !== undefined && { applicationDeadline: input.applicationDeadline ? new Date(input.applicationDeadline) : null }),
      ...(input.requireResume !== undefined && { requireResume: input.requireResume }),
      ...(input.requireCoverLetter !== undefined && { requireCoverLetter: input.requireCoverLetter }),
      ...(input.seoTitle !== undefined && { seoTitle: input.seoTitle }),
      ...(input.metaDescription !== undefined && { metaDescription: input.metaDescription }),
      ...this.statusFields(input, current),
      updatedAt: new Date(),
    };
    const saved = await this.prisma.jobOpening.update({ where: { id }, data });
    await this.auditLog.record({ actorUserId: userId, actorRole: 'admin', action: input.status && input.status !== current.status ? `job.${input.status.toLowerCase()}` : 'job.update', targetType: 'job_opening', targetId: id, beforeState: { status: current.status }, afterState: { status: saved.status }, requestMeta: meta });
    return this.get(userId, id);
  }

  async remove(userId: string, id: string, meta?: RequestMeta) {
    await this.guard(userId);
    const job = await this.prisma.jobOpening.findUnique({ where: { id }, include: { _count: { select: { applications: true } } } });
    if (!job) throw new NotFoundException({ code: 'JOB_NOT_FOUND', message: 'Job opening not found.' });
    if (job._count.applications) throw new ConflictException({ code: 'JOB_HAS_APPLICATIONS', message: 'Archive this opening instead; it has applications.' });
    await this.prisma.jobOpening.delete({ where: { id } });
    await this.storage.delete(job.descriptionRef).catch(() => undefined);
    await this.auditLog.record({ actorUserId: userId, actorRole: 'admin', action: 'job.delete', targetType: 'job_opening', targetId: id, requestMeta: meta });
    return { id, deleted: true };
  }

  // ── Applications (admin) ───────────────────────────────────────────────

  async applications(userId: string, filters: { jobId?: string; status?: ApplicationStatus; q?: string } = {}) {
    await this.guard(userId);
    return this.prisma.jobApplication.findMany({
      where: {
        ...(filters.jobId ? { jobId: filters.jobId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.q ? { OR: [{ email: { contains: filters.q, mode: 'insensitive' } }, { lastName: { contains: filters.q, mode: 'insensitive' } }, { firstName: { contains: filters.q, mode: 'insensitive' } }] } : {}),
      },
      orderBy: { submittedAt: 'desc' },
      take: 500,
      include: { job: { select: { id: true, title: true } }, files: { select: { id: true, mimeType: true, sizeBytes: true, malwareScanStatus: true } } },
    });
  }

  async application(userId: string, id: string) {
    await this.guard(userId);
    const app = await this.prisma.jobApplication.findUnique({
      where: { id },
      include: {
        job: { select: { id: true, title: true, slug: true } },
        files: { select: { id: true, mimeType: true, sizeBytes: true, malwareScanStatus: true, createdAt: true } },
        events: { orderBy: { createdAt: 'asc' } },
        notes: { orderBy: { createdAt: 'desc' }, include: { author: { select: { displayName: true, email: true } } } },
      },
    });
    if (!app) throw new NotFoundException({ code: 'APPLICATION_NOT_FOUND', message: 'Application not found.' });
    return app;
  }

  async setApplicationStatus(userId: string, id: string, status: ApplicationStatus, meta?: RequestMeta) {
    await this.guard(userId);
    const app = await this.prisma.jobApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException({ code: 'APPLICATION_NOT_FOUND', message: 'Application not found.' });
    await this.prisma.$transaction([
      this.prisma.jobApplication.update({ where: { id }, data: { status } }),
      this.prisma.applicationEvent.create({ data: { applicationId: id, actorUserId: userId, eventType: 'status_changed', metadata: { from: app.status, to: status } } }),
    ]);
    await this.auditLog.record({ actorUserId: userId, actorRole: 'admin', action: 'job.application.status', targetType: 'job_application', targetId: id, beforeState: { status: app.status }, afterState: { status }, requestMeta: meta });
    return this.application(userId, id);
  }

  async addNote(userId: string, id: string, note: string) {
    await this.guard(userId);
    await this.prisma.hiringNote.create({ data: { applicationId: id, authorUserId: userId, note: note.trim() } });
    return this.application(userId, id);
  }

  /** Download is allowed only for files that passed the malware scan. */
  async downloadFile(userId: string, fileId: string, meta?: RequestMeta) {
    await this.guard(userId);
    const file = await this.prisma.applicantFile.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException({ code: 'FILE_NOT_FOUND', message: 'File not found.' });
    if (file.malwareScanStatus !== 'CLEAN') {
      throw new ForbiddenException({ code: 'FILE_NOT_SCANNED', message: file.malwareScanStatus === 'INFECTED' ? 'This file failed the malware scan.' : 'This file has not passed a malware scan yet.' });
    }
    const body = await this.storage.readBuffer(file.storageKey);
    if (!body) throw new NotFoundException({ code: 'FILE_NOT_FOUND', message: 'File not found.' });
    await this.auditLog.record({ actorUserId: userId, actorRole: 'admin', action: 'job.application.file_download', targetType: 'applicant_file', targetId: fileId, requestMeta: meta });
    return { body, mimeType: file.mimeType, filename: `application-${file.applicationId.slice(0, 8)}.${file.storageKey.split('.').pop()}` };
  }

  async rescan(userId: string, fileId: string) {
    await this.guard(userId);
    await this.prisma.applicantFile.update({ where: { id: fileId }, data: { malwareScanStatus: 'PENDING' } });
    await this.jobs.enqueue('careers.scan', { fileId }, { jobKey: `scan:${fileId}:${Date.now()}` });
    return { id: fileId, status: 'PENDING' };
  }

  // ── Public application ─────────────────────────────────────────────────

  private validUrl(v: string | undefined, hosts?: RegExp) {
    if (!v) return null;
    try {
      const u = new URL(v);
      if (u.protocol !== 'https:') return undefined;
      if (hosts && !hosts.test(u.hostname)) return undefined;
      return u.toString();
    } catch {
      return undefined;
    }
  }

  private acceptFile(f: UploadedFile | undefined, label: string) {
    if (!f) return null;
    if (f.size > MAX_FILE) throw new BadRequestException({ code: 'FILE_TOO_LARGE', message: `${label} must be 10 MB or smaller.` });
    const type = detectFileType(f.buffer, DOCUMENT_TYPES);
    if (!type) throw new BadRequestException({ code: 'UNSUPPORTED_FILE', message: `${label} must be a PDF or Word document.` });
    return { ...type, buffer: f.buffer, size: f.size };
  }

  async apply(slug: string, input: ApplicationInput, files: { resume?: UploadedFile; coverLetter?: UploadedFile }, ip: string | undefined) {
    if (input.website) return { received: true, receipt: null };
    const job = await this.prisma.jobOpening.findFirst({
      where: { slug, status: 'PUBLISHED', publishedAt: { lte: new Date() }, showOnCareersPage: true, OR: [{ applicationDeadline: null }, { applicationDeadline: { gt: new Date() } }] },
    });
    if (!job) throw new NotFoundException({ code: 'JOB_NOT_OPEN', message: 'This role is no longer accepting applications.' });

    const linkedinUrl = this.validUrl(input.linkedinUrl, /(^|\.)linkedin\.com$/i);
    const portfolioUrl = this.validUrl(input.portfolioUrl);
    if (linkedinUrl === undefined) throw new BadRequestException({ code: 'INVALID_LINKEDIN', message: 'Enter a valid https://linkedin.com profile URL.' });
    if (portfolioUrl === undefined) throw new BadRequestException({ code: 'INVALID_PORTFOLIO', message: 'Enter a valid https:// portfolio URL.' });
    const resume = this.acceptFile(files.resume, 'Résumé');
    const cover = this.acceptFile(files.coverLetter, 'Cover letter');
    if (job.requireResume && !resume) throw new BadRequestException({ code: 'RESUME_REQUIRED', message: 'Attach your résumé.' });
    if (job.requireCoverLetter && !cover && !input.message?.trim()) throw new BadRequestException({ code: 'COVER_LETTER_REQUIRED', message: 'Attach a cover letter or write a message.' });

    const email = input.email.trim().toLowerCase();
    const recent = await this.prisma.jobApplication.count({ where: { email, submittedAt: { gt: new Date(Date.now() - 3_600_000) } } });
    const duplicate = await this.prisma.jobApplication.findFirst({ where: { email, jobId: job.id, status: { notIn: ['WITHDRAWN', 'REJECTED'] } } });
    if (recent >= 5) throw new HttpException({ code: 'RATE_LIMITED', message: 'Too many applications. Please try again later.' }, HttpStatus.TOO_MANY_REQUESTS);
    if (duplicate) throw new ConflictException({ code: 'ALREADY_APPLIED', message: 'You have already applied for this role.' });

    const stored: { key: string; mime: string; size: number; checksum: string }[] = [];
    for (const f of [resume, cover].filter((x): x is NonNullable<typeof resume> => !!x)) {
      const key = `applications/${job.id}/${randomUUID()}.${f.ext}`;
      await this.storage.writeBuffer(key, f.buffer, f.mime);
      stored.push({ key, mime: f.mime, size: f.size, checksum: createHash('sha256').update(f.buffer).digest('hex') });
    }

    let app;
    try {
      app = await this.prisma.$transaction(async (tx) => {
        const created = await tx.jobApplication.create({
          data: {
            jobId: job.id,
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            email,
            phone: input.phone?.trim() || null,
            linkedinUrl,
            portfolioUrl,
            message: input.message?.trim() || null,
            files: { create: stored.map((s) => ({ storageKey: s.key, mimeType: s.mime, sizeBytes: BigInt(s.size), checksum: s.checksum })) },
            events: { create: { eventType: 'submitted', metadata: { ipHash: ip ? createHash('sha256').update(`apply:${ip}`).digest('hex') : null } } },
          },
          include: { files: true },
        });
        for (const f of created.files) await this.jobs.enqueue('careers.scan', { fileId: f.id }, { jobKey: `scan:${f.id}` }, tx);
        return created;
      });
    } catch (err) {
      for (const s of stored) await this.storage.delete(s.key).catch(() => undefined);
      // The database trigger rejects applications for closed roles (race with the check above).
      if (String(err).includes('not accepting applications')) {
        throw new NotFoundException({ code: 'JOB_NOT_OPEN', message: 'This role is no longer accepting applications.' });
      }
      throw err;
    }

    if (this.email.configured) {
      await this.email
        .send({ to: email, subject: `We received your application for ${job.title}`, text: `Hi ${input.firstName.trim()},\n\nThank you for applying for ${job.title} at AmpliVerify. Your reference is ${app.id.slice(0, 8).toUpperCase()}.\n\nThe AmpliVerify team` })
        .catch((e) => this.logger.warn(`Application confirmation email failed: ${e}`));
    }
    return { received: true, receipt: app.id };
  }

  /** Confirms a receipt for the success page (the receipt is the full, unguessable id). */
  async receipt(slug: string, receipt: string) {
    const app = await this.prisma.jobApplication.findFirst({ where: { id: receipt, job: { slug } }, select: { id: true, submittedAt: true, job: { select: { title: true } } } });
    if (!app) throw new NotFoundException({ code: 'RECEIPT_NOT_FOUND', message: 'Application not found.' });
    return { reference: app.id.slice(0, 8).toUpperCase(), submittedAt: app.submittedAt, jobTitle: app.job.title };
  }

  private async scan(fileId: string) {
    const file = await this.prisma.applicantFile.findUnique({ where: { id: fileId } });
    if (!file || file.malwareScanStatus !== 'PENDING') return;
    const body = await this.storage.readBuffer(file.storageKey);
    if (!body) {
      await this.prisma.applicantFile.update({ where: { id: fileId }, data: { malwareScanStatus: 'FAILED' } });
      return;
    }
    const result = await scanWithClamAv(body, this.config.get<string>('CLAMAV_HOST'), Number(this.config.get('CLAMAV_PORT') ?? 3310));
    if (result === null) return; // No scanner configured: stays PENDING (download blocked).
    await this.prisma.applicantFile.update({ where: { id: fileId }, data: { malwareScanStatus: result } });
    await this.prisma.applicationEvent.create({ data: { applicationId: file.applicationId, eventType: 'file_scanned', metadata: { fileId, result } } });
    if (result === 'INFECTED') await this.storage.delete(file.storageKey).catch(() => undefined);
  }
}
