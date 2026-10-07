import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Db, PrismaService } from '../prisma/prisma.service';

export type JobHandler = (payload: Record<string, unknown>, job: { id: string; attempts: number }) => Promise<void>;

type ClaimedJob = { id: string; queue: string; payload_ref: string | null; attempts: number };

const MAX_ATTEMPTS = 3;
const STALE_RUNNING_MS = 15 * 60 * 1000;

/**
 * PostgreSQL-backed job queue on `background_jobs`. Workers claim jobs with
 * `FOR UPDATE SKIP LOCKED`, so several API instances can run side by side.
 * Failed jobs retry with backoff, then become DEAD. Set JOBS_WORKER=off to
 * disable the in-process worker (tests drain queues explicitly).
 */
@Injectable()
export class JobsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private readonly handlers = new Map<string, JobHandler>();
  private readonly periodic: { name: string; everyMs: number; fn: () => Promise<void>; last: number }[] = [];
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  register(queue: string, handler: JobHandler) {
    this.handlers.set(queue, handler);
  }

  /** Runs `fn` roughly every `everyMs` on the worker tick (schedulers for GEO checks, reports…). */
  registerPeriodic(name: string, everyMs: number, fn: () => Promise<void>) {
    this.periodic.push({ name, everyMs, fn, last: 0 });
  }

  async enqueue(queue: string, payload: Record<string, unknown>, opts: { jobKey?: string; runAt?: Date } = {}, db: Db = this.prisma) {
    if (opts.jobKey) {
      const existing = await db.backgroundJob.findUnique({ where: { jobKey: opts.jobKey } });
      if (existing) return existing;
    }
    return db.backgroundJob.create({
      data: { queue, jobKey: opts.jobKey ?? null, payloadRef: JSON.stringify(payload), runAt: opts.runAt ?? new Date() },
    });
  }

  onApplicationBootstrap() {
    if ((this.config.get<string>('JOBS_WORKER') ?? 'on') === 'off') return;
    const interval = Number(this.config.get<string>('JOBS_POLL_MS') ?? 2000);
    this.timer = setInterval(() => void this.tick(), interval);
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      const now = Date.now();
      for (const p of this.periodic) {
        if (now - p.last < p.everyMs) continue;
        p.last = now;
        await p.fn().catch((err) => this.logger.error(`Periodic task ${p.name} failed: ${err}`));
      }
      await this.recoverStale();
      // Drain a bounded batch per tick so one queue cannot starve the loop.
      for (let i = 0; i < 10 && !this.stopped; i++) {
        if (!(await this.runNext())) break;
      }
    } catch (err) {
      this.logger.error(`Job worker tick failed: ${err}`);
    } finally {
      this.running = false;
    }
  }

  /** Claims and runs one due job. Returns false when nothing was due. */
  async runNext(queues: string[] = [...this.handlers.keys()]): Promise<boolean> {
    if (queues.length === 0) return false;
    const rows = await this.prisma.$queryRaw<ClaimedJob[]>`
      UPDATE "background_jobs" SET "status" = 'RUNNING', "attempts" = "attempts" + 1, "updated_at" = now()
       WHERE "id" = (
         SELECT "id" FROM "background_jobs"
          WHERE "status" = 'QUEUED' AND "run_at" <= now() AND "queue" IN (${Prisma.join(queues)})
          ORDER BY "run_at"
          FOR UPDATE SKIP LOCKED
          LIMIT 1)
      RETURNING "id", "queue", "payload_ref", "attempts"`;
    const job = rows[0];
    if (!job) return false;

    const handler = this.handlers.get(job.queue);
    try {
      if (!handler) throw new Error(`No handler for queue ${job.queue}`);
      await handler(job.payload_ref ? JSON.parse(job.payload_ref) : {}, { id: job.id, attempts: job.attempts });
      await this.prisma.backgroundJob.update({ where: { id: job.id }, data: { status: 'SUCCEEDED', lastError: null } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const dead = job.attempts >= MAX_ATTEMPTS;
      this.logger.warn(`Job ${job.queue}/${job.id} failed (attempt ${job.attempts}): ${message}`);
      await this.prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: dead ? 'DEAD' : 'QUEUED',
          lastError: message.slice(0, 2000),
          runAt: new Date(Date.now() + 30_000 * 2 ** (job.attempts - 1)),
        },
      });
    }
    return true;
  }

  /** Test helper: run due jobs on the given queues until none remain. */
  async drain(queues?: string[], max = 100) {
    let count = 0;
    while (count < max && (await this.runNext(queues))) count++;
    return count;
  }

  private recoverStale() {
    return this.prisma.backgroundJob.updateMany({
      where: { status: 'RUNNING', updatedAt: { lt: new Date(Date.now() - STALE_RUNNING_MS) } },
      data: { status: 'QUEUED' },
    });
  }
}
