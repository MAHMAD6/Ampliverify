import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreditReason, Prisma } from '@prisma/client';
import { Db, PrismaService } from '../prisma/prisma.service';
import { SETTING, SettingsService } from './settings.service';

export type LedgerEntryInput = {
  workspaceId: string;
  delta: Prisma.Decimal | number | string;
  reason: CreditReason;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey: string;
  createdBy?: string | null;
  /** Admin corrections may take a balance below zero; usage never may. */
  allowNegative?: boolean;
};

export type ChargeInput = {
  workspaceId: string;
  projectId?: string | null;
  featureKey: string;
  units?: number;
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
  actorId?: string | null;
};

/**
 * Credit wallet + append-only ledger. The wallet row is locked for every
 * entry so concurrent charges cannot overdraw; `balance_cache` always equals
 * SUM(delta). Entries are idempotent on `idempotency_key`.
 */
@Injectable()
export class CreditsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async ensureWallet(workspaceId: string, db: Db = this.prisma) {
    return db.creditWallet.upsert({ where: { workspaceId }, create: { workspaceId }, update: {} });
  }

  async balance(workspaceId: string) {
    const wallet = await this.prisma.creditWallet.findUnique({ where: { workspaceId } });
    return wallet?.balanceCache ?? new Prisma.Decimal(0);
  }

  async costOf(featureKey: string, units = 1, db: Db = this.prisma) {
    const costs = await this.settings.get<Record<string, number>>(SETTING.creditCosts, {}, db);
    return new Prisma.Decimal(costs[featureKey] ?? 0).mul(units);
  }

  /** Applies one ledger entry inside `tx`. Returns the entry (existing one on idempotent replay). */
  async applyEntry(tx: Prisma.TransactionClient, input: LedgerEntryInput) {
    const existing = await tx.creditLedger.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existing;

    const wallet = await this.ensureWallet(input.workspaceId, tx);
    const [locked] = await tx.$queryRaw<{ balance_cache: Prisma.Decimal }[]>`
      SELECT "balance_cache" FROM "credit_wallets" WHERE "id" = ${wallet.id}::uuid FOR UPDATE`;
    const delta = new Prisma.Decimal(input.delta);
    const next = new Prisma.Decimal(locked.balance_cache).add(delta);
    if (delta.isNegative() && next.isNegative() && !input.allowNegative) {
      throw new HttpException(
        { code: 'INSUFFICIENT_CREDITS', message: 'You do not have enough credits for this action.' },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    const entry = await tx.creditLedger.create({
      data: {
        walletId: wallet.id,
        delta,
        reason: input.reason,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        idempotencyKey: input.idempotencyKey,
        createdBy: input.createdBy ?? null,
      },
    });
    await tx.creditWallet.update({ where: { id: wallet.id }, data: { balanceCache: next } });
    return entry;
  }

  /**
   * Records usage and debits its credit cost (if any) atomically.
   * Throws 402 INSUFFICIENT_CREDITS before anything is written.
   */
  async charge(input: ChargeInput, db?: Prisma.TransactionClient) {
    const run = async (tx: Prisma.TransactionClient) => {
      const units = input.units ?? 1;
      const cost = await this.costOf(input.featureKey, units, tx);
      const usageKey = `usage:${input.idempotencyKey}`;
      const already = await tx.usageEvent.findUnique({ where: { idempotencyKey: usageKey } });
      if (already) return { cost, usageEventId: already.id };
      if (cost.greaterThan(0)) {
        await this.applyEntry(tx, {
          workspaceId: input.workspaceId,
          delta: cost.negated(),
          reason: 'USAGE',
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          idempotencyKey: `charge:${input.idempotencyKey}`,
          createdBy: input.actorId ?? null,
        });
      }
      const usage = await tx.usageEvent.create({
        data: {
          workspaceId: input.workspaceId,
          projectId: input.projectId ?? null,
          featureKey: input.featureKey,
          units,
          idempotencyKey: usageKey,
        },
      });
      return { cost, usageEventId: usage.id };
    };
    return db ? run(db) : this.prisma.$transaction(run);
  }

  /** Returns the credits of a failed operation (no-op if nothing was charged). */
  async refund(workspaceId: string, idempotencyKey: string, reason = 'operation failed') {
    return this.prisma.$transaction(async (tx) => {
      const charge = await tx.creditLedger.findUnique({ where: { idempotencyKey: `charge:${idempotencyKey}` } });
      if (!charge) return null;
      return this.applyEntry(tx, {
        workspaceId,
        delta: new Prisma.Decimal(charge.delta).negated(),
        reason: 'REVERSAL',
        referenceType: charge.referenceType ?? reason,
        referenceId: charge.referenceId ?? undefined,
        idempotencyKey: `refund:${idempotencyKey}`,
      });
    });
  }

  /**
   * Holds credits for a queued job (manual §06): the cost is debited now and
   * recorded as RESERVED. `settle` marks it used exactly once; `release`
   * returns it. Replays with the same key return the existing reservation.
   */
  async reserve(input: { workspaceId: string; featureKey: string; units?: number; amount?: number; referenceType: string; referenceId: string; idempotencyKey: string; actorId?: string | null; ttlMinutes?: number }, db?: Prisma.TransactionClient) {
    const run = async (tx: Prisma.TransactionClient) => {
      const existing = await tx.creditReservation.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return existing;
      const amount = input.amount !== undefined ? new Prisma.Decimal(input.amount) : await this.costOf(input.featureKey, input.units ?? 1, tx);
      if (amount.greaterThan(0)) {
        await this.applyEntry(tx, {
          workspaceId: input.workspaceId,
          delta: amount.negated(),
          reason: 'USAGE',
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          idempotencyKey: `reserve:${input.idempotencyKey}`,
          createdBy: input.actorId ?? null,
        });
      }
      return tx.creditReservation.create({
        data: {
          workspaceId: input.workspaceId,
          featureKey: input.featureKey,
          amount,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          idempotencyKey: input.idempotencyKey,
          expiresAt: new Date(Date.now() + (input.ttlMinutes ?? 120) * 60_000),
        },
      });
    };
    return db ? run(db) : this.prisma.$transaction(run);
  }

  /** Marks a reservation used and records the usage event. Idempotent. */
  async settle(reservationId: string, opts: { projectId?: string | null; units?: number } = {}) {
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.creditReservation.findUnique({ where: { id: reservationId } });
      if (!r || r.status !== 'RESERVED') return r;
      const usageKey = `usage:${r.idempotencyKey}`;
      if (!(await tx.usageEvent.findUnique({ where: { idempotencyKey: usageKey } }))) {
        await tx.usageEvent.create({ data: { workspaceId: r.workspaceId, projectId: opts.projectId ?? null, featureKey: r.featureKey, units: opts.units ?? 1, idempotencyKey: usageKey } });
      }
      return tx.creditReservation.update({ where: { id: r.id }, data: { status: 'SETTLED', settledAt: new Date() } });
    });
  }

  /** Returns a reservation's credits (failure, cancellation or expiry). Idempotent. */
  async release(reservationId: string, reason = 'operation failed') {
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.creditReservation.findUnique({ where: { id: reservationId } });
      if (!r || r.status !== 'RESERVED') return r;
      if (new Prisma.Decimal(r.amount).greaterThan(0)) {
        await this.applyEntry(tx, {
          workspaceId: r.workspaceId,
          delta: r.amount,
          reason: 'REVERSAL',
          referenceType: `${r.referenceType}:${reason}`.slice(0, 120),
          referenceId: r.referenceId,
          idempotencyKey: `release:${r.idempotencyKey}`,
        });
      }
      return tx.creditReservation.update({ where: { id: r.id }, data: { status: 'RELEASED', settledAt: new Date() } });
    });
  }

  /** Releases reservations whose job never finished (orphan reconciliation). */
  async releaseExpiredReservations(now = new Date()) {
    const stale = await this.prisma.creditReservation.findMany({ where: { status: 'RESERVED', expiresAt: { lt: now } }, select: { id: true }, take: 500 });
    for (const r of stale) await this.release(r.id, 'expired');
    return stale.length;
  }

  /** Available balance plus credits currently held by queued jobs. */
  async balanceDetail(workspaceId: string) {
    const [available, reserved] = await Promise.all([
      this.balance(workspaceId),
      this.prisma.creditReservation.aggregate({ where: { workspaceId, status: 'RESERVED' }, _sum: { amount: true } }),
    ]);
    return { available, reserved: reserved._sum.amount ?? new Prisma.Decimal(0) };
  }

  ledger(workspaceId: string, limit = 100) {
    return this.prisma.creditLedger.findMany({
      where: { wallet: { workspaceId } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
    });
  }

  usageSince(workspaceId: string, since: Date) {
    return this.prisma.usageEvent.groupBy({
      by: ['featureKey'],
      where: { workspaceId, occurredAt: { gte: since } },
      _sum: { units: true },
    });
  }
}
