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
