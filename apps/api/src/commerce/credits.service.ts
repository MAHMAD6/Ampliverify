import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreditGrantSource, CreditReason, Prisma } from '@prisma/client';
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
  /** For positive entries: the credit lot's source and expiry (defaults from `reason`). */
  grant?: { source: CreditGrantSource; expiresAt?: Date | null };
};

/** Lot consumption order (Hybrid guide §5): subscription credits first, purchased credits last. */
const LOT_ORDER: Record<CreditGrantSource, number> = { SUBSCRIPTION: 0, SIGNUP: 1, PROMOTIONAL: 1, ADJUSTMENT: 2, PURCHASE: 3 };
const LOT_SOURCE: Partial<Record<CreditReason, CreditGrantSource>> = { PLAN_GRANT: 'SUBSCRIPTION', PURCHASE: 'PURCHASE', PROMOTIONAL: 'PROMOTIONAL', ADJUSTMENT_CREDIT: 'ADJUSTMENT' };

export type CreditLot = { id: string; source: CreditGrantSource; amount: number; remaining: number; expiresAt: Date | null; createdAt: Date };

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
    const source = delta.greaterThan(0) ? (input.grant?.source ?? LOT_SOURCE[input.reason]) : undefined;
    if (source) {
      await tx.creditGrant.create({ data: { workspaceId: input.workspaceId, source, amount: delta, ledgerEntryId: entry.id, referenceType: input.referenceType ?? null, referenceId: input.referenceId ?? null, expiresAt: input.grant?.expiresAt ?? null } });
    }
    return entry;
  }

  /**
   * Credit lots with their remaining amounts. The ledger is authoritative; net
   * consumption (granted − balance) is assigned to lots in policy order —
   * subscription credits (earliest expiry) first, purchased credits last — so
   * remaining amounts never depend on which job spent them.
   */
  async lots(workspaceId: string, db: Db = this.prisma): Promise<CreditLot[]> {
    const [rows, wallet] = await Promise.all([
      db.creditGrant.findMany({ where: { workspaceId, expiredAt: null } }),
      db.creditWallet.findUnique({ where: { workspaceId } }),
    ]);
    const balance = Number(wallet?.balanceCache ?? 0);
    const sorted = rows.sort(
      (a, b) =>
        LOT_ORDER[a.source] - LOT_ORDER[b.source] ||
        (a.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
    let consumed = Math.max(0, sorted.reduce((t, l) => t + Number(l.amount), 0) - balance);
    return sorted.map((l) => {
      const amount = Number(l.amount);
      const used = Math.min(amount, consumed);
      consumed -= used;
      return { id: l.id, source: l.source, amount, remaining: Math.round((amount - used) * 10_000) / 10_000, expiresAt: l.expiresAt, createdAt: l.createdAt };
    });
  }

  /** Expires lots past their expiry date: their remaining credits leave the balance (EXPIRATION). */
  async expireLots(now = new Date()) {
    const due = await this.prisma.creditGrant.findMany({ where: { expiredAt: null, expiresAt: { lt: now } }, select: { workspaceId: true }, distinct: ['workspaceId'], take: 500 });
    let expired = 0;
    for (const { workspaceId } of due) {
      await this.prisma.$transaction(async (tx) => {
        const wallet = await this.ensureWallet(workspaceId, tx);
        await tx.$queryRaw`SELECT "id" FROM "credit_wallets" WHERE "id" = ${wallet.id}::uuid FOR UPDATE`;
        for (const lot of (await this.lots(workspaceId, tx)).filter((l) => l.expiresAt && l.expiresAt < now)) {
          if (lot.remaining > 0) {
            await this.applyEntry(tx, { workspaceId, delta: -lot.remaining, reason: 'EXPIRATION', referenceType: 'credit_grant', referenceId: lot.id, idempotencyKey: `expire:${lot.id}`, allowNegative: true });
          }
          await tx.creditGrant.update({ where: { id: lot.id }, data: { expiredAt: now } });
          expired++;
        }
      });
    }
    return expired;
  }

  /**
   * Subscription credits for the current billing period (`credits.monthly_grant`),
   * granted exactly once per period and expiring at the period end unless
   * rollover is enabled. Called on invoice.paid and by a periodic sweep.
   */
  async grantPeriodCredits(subscriptionId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId }, include: { plan: { include: { entitlements: { include: { feature: true } } } } } });
    if (!sub || !['ACTIVE', 'TRIALING'].includes(sub.status)) return null;
    const ent = sub.plan.entitlements.find((e) => e.feature.key === 'credits.monthly_grant' && e.enabled);
    const amount = Number(ent?.limitNumeric ?? 0);
    if (amount <= 0) return null;
    const policy = await this.settings.get<{ rollover?: boolean }>(SETTING.creditPolicy, {});
    return this.prisma.$transaction((tx) =>
      this.applyEntry(tx, {
        workspaceId: sub.workspaceId,
        delta: amount,
        reason: 'PLAN_GRANT',
        referenceType: 'subscription',
        referenceId: sub.id,
        idempotencyKey: `plan-grant:${sub.id}:${sub.currentPeriodStart.toISOString()}`,
        grant: { source: 'SUBSCRIPTION', expiresAt: policy.rollover ? null : sub.currentPeriodEnd },
      }),
    );
  }

  async grantDuePeriodCredits() {
    const subs = await this.prisma.subscription.findMany({ where: { status: { in: ['ACTIVE', 'TRIALING'] }, currentPeriodStart: { lte: new Date() }, currentPeriodEnd: { gt: new Date() } }, select: { id: true } });
    for (const s of subs) await this.grantPeriodCredits(s.id).catch(() => undefined);
    return subs.length;
  }

  /**
   * Quote before execution (Hybrid guide §2): cost, current balance and the
   * estimated balance afterwards. Nothing is reserved.
   */
  async quote(workspaceId: string, featureKey: string, units = 1, amount?: number) {
    const cost = amount !== undefined ? new Prisma.Decimal(amount) : await this.costOf(featureKey, units);
    const { available, reserved } = await this.balanceDetail(workspaceId);
    const after = new Prisma.Decimal(available).sub(cost);
    return { featureKey, units, cost: Number(cost), available: Number(available), reserved: Number(reserved), after: Number(after), sufficient: !after.isNegative() };
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
          units: input.units ?? 1,
          expiresAt: new Date(Date.now() + (input.ttlMinutes ?? 120) * 60_000),
        },
      });
    };
    return db ? run(db) : this.prisma.$transaction(run);
  }

  /**
   * Marks a reservation used and records the usage event. With `actualAmount`
   * below the reserved amount, the unused part is returned (V1 manual §3:
   * settle actual usage, release the rest). Idempotent.
   */
  async settle(reservationId: string, opts: { projectId?: string | null; units?: number; actualAmount?: Prisma.Decimal } = {}) {
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.creditReservation.findUnique({ where: { id: reservationId } });
      if (!r || r.status !== 'RESERVED') return r;
      const unused = opts.actualAmount !== undefined ? new Prisma.Decimal(r.amount).sub(opts.actualAmount) : new Prisma.Decimal(0);
      if (unused.greaterThan(0)) {
        await this.applyEntry(tx, { workspaceId: r.workspaceId, delta: unused, reason: 'REVERSAL', referenceType: `${r.referenceType}:unused`.slice(0, 120), referenceId: r.referenceId, idempotencyKey: `settle-return:${r.idempotencyKey}` });
      }
      const usageKey = `usage:${r.idempotencyKey}`;
      const usage = (await tx.usageEvent.findUnique({ where: { idempotencyKey: usageKey } })) ?? (await tx.usageEvent.create({ data: { workspaceId: r.workspaceId, projectId: opts.projectId ?? null, featureKey: r.featureKey, units: opts.units ?? 1, idempotencyKey: usageKey } }));
      const settled = await tx.creditReservation.update({ where: { id: r.id }, data: { status: 'SETTLED', settledAt: new Date() } });
      return { ...settled, usageEventId: usage.id };
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
    const lots = await this.lots(workspaceId);
    const by = (s: CreditGrantSource[]) => lots.filter((l) => s.includes(l.source)).reduce((t, l) => t + l.remaining, 0);
    const soon = new Date(Date.now() + 7 * 86_400_000);
    return {
      available,
      reserved: reserved._sum.amount ?? new Prisma.Decimal(0),
      subscription: by(['SUBSCRIPTION']),
      purchased: by(['PURCHASE']),
      other: by(['SIGNUP', 'PROMOTIONAL', 'ADJUSTMENT']),
      expiringSoon: lots.filter((l) => l.expiresAt && l.expiresAt < soon).reduce((t, l) => t + l.remaining, 0),
      nextExpiry: lots.filter((l) => l.expiresAt && l.remaining > 0).map((l) => l.expiresAt!).sort((a, b) => a.getTime() - b.getTime())[0] ?? null,
    };
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
