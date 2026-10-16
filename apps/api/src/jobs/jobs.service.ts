import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { Db, PrismaService } from '../prisma/prisma.service';
import { createRedis } from '../redis/redis';

export type JobHandler = (payload: Record<string, unknown>, job: { id: string; attempts: number }) => Promise<void>;

type ClaimedJob = { id: string; queue: string; payload_ref: string | null; attempts: number };

const MAX_ATTEMPTS = 3;
const STALE_RUNNING_MS = 15 * 60 * 1000;
/** A dispatched job not picked up by a worker within this lease is dispatched again. */
const DISPATCH_LEASE_MS = 5 * 60 * 1000;
const WORK_QUEUE = 'ampliverify-jobs';
const DEAD_LETTER_QUEUE = 'ampliverify-dead-letter';

/**
 * Background jobs. `background_jobs` (PostgreSQL) is the durable record and
 * transactional outbox: jobs are enqueued in the same transaction as the work
 * that creates them, carry an idempotent `jobKey`, retry with backoff and end
 * DEAD after MAX_ATTEMPTS.
 *
 * With REDIS_URL (production, V1 manual §1) a relay dispatches due jobs to a
 * Redis-backed BullMQ queue and BullMQ workers run them on every instance;
 * dead jobs are also copied to a dead-letter queue. Without Redis the worker
 * claims rows directly with `FOR UPDATE SKIP LOCKED`. Set JOBS_WORKER=off to
 * disable workers (tests drain queues explicitly).
 */
@Injectable()
export class JobsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private readonly handlers = new Map<string, JobHandler>();
  private readonly periodic: { name: string; everyMs: number; fn: () => Promise<void>; last: number }[] = [];
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopped = false;
  private redis: Redis | null = null;
  private queue: Queue | null = null;
  private deadLetter: Queue | null = null;
  private worker: Worker | null = null;

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

  get mode() {
    return this.queue ? 'redis' : 'postgres';
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
    const url = this.config.get<string>('REDIS_URL');
    if (url) {
      this.redis = createRedis(url, 'jobs');
      const connection = this.redis;
      this.queue = new Queue(WORK_QUEUE, { connection, defaultJobOptions: { removeOnComplete: true, removeOnFail: true, attempts: 1 } });
      this.deadLetter = new Queue(DEAD_LETTER_QUEUE, { connection, defaultJobOptions: { removeOnComplete: 1000, removeOnFail: 1000 } });
      this.worker = new Worker(WORK_QUEUE, async (job) => void (await this.runClaimed(String(job.data.id))), {
        connection: createRedis(url, 'jobs-worker'),
        concurrency: Number(this.config.get<string>('JOBS_CONCURRENCY') ?? 5),
      });
      this.worker.on('error', (err) => this.logger.error(`Queue worker error: ${err.message}`));
      this.logger.log('Background jobs: Redis queue (BullMQ) with PostgreSQL outbox.');
    }
    const interval = Number(this.config.get<string>('JOBS_POLL_MS') ?? (url ? 1000 : 2000));
    this.timer = setInterval(() => void this.tick(), interval);
  }

  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await Promise.allSettled([this.worker?.close(), this.queue?.close(), this.deadLetter?.close()]);
    this.redis?.disconnect();
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
      if (this.queue) {
        await this.dispatch();
      } else {
        // Drain a bounded batch per tick so one queue cannot starve the loop.
        for (let i = 0; i < 10 && !this.stopped; i++) {
          if (!(await this.runNext())) break;
        }
      }
    } catch (err) {
      this.logger.error(`Job worker tick failed: ${err}`);
    } finally {
      this.running = false;
    }
  }

  /** Outbox relay: hands due jobs to the Redis queue and leases them so they are not dispatched twice. */
  private async dispatch() {
    const queues = [...this.handlers.keys()];
    if (!queues.length) return;
    const rows = await this.prisma.$queryRaw<{ id: string; queue: string; attempts: number }[]>`
      UPDATE "background_jobs" SET "run_at" = now() + (${DISPATCH_LEASE_MS} * interval '1 millisecond'), "updated_at" = now()
       WHERE "id" IN (
         SELECT "id" FROM "background_jobs"
          WHERE "status" = 'QUEUED' AND "run_at" <= now() AND "queue" IN (${Prisma.join(queues)})
          ORDER BY "run_at"
          FOR UPDATE SKIP LOCKED
          LIMIT 100)
      RETURNING "id", "queue", "attempts"`;
    if (!rows.length) return;
    await this.queue!.addBulk(rows.map((r) => ({ name: r.queue, data: { id: r.id }, opts: { jobId: `${r.id}:${r.attempts}` } })));
  }

  /** Claims and runs one due job (PostgreSQL mode and tests). Returns false when nothing was due. */
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
    await this.execute(job);
    return true;
  }

  /** Redis mode: a worker received a dispatched job; claim the row so it runs at most once. */
  private async runClaimed(id: string) {
    const rows = await this.prisma.$queryRaw<ClaimedJob[]>`
      UPDATE "background_jobs" SET "status" = 'RUNNING', "attempts" = "attempts" + 1, "updated_at" = now()
       WHERE "id" = ${id}::uuid AND "status" = 'QUEUED'
      RETURNING "id", "queue", "payload_ref", "attempts"`;
    if (rows[0]) await this.execute(rows[0]);
  }

  private async execute(job: ClaimedJob) {
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
      if (dead) await this.deadLetter?.add(job.queue, { id: job.id, error: message.slice(0, 500) }).catch(() => undefined);
    }
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
