import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Db, PrismaService } from '../prisma/prisma.service';
import { RequestMeta } from '../common/types/request-meta.type';

export type AuditRecordInput = {
  actorUserId?: string | null;
  actorRole?: string | null;
  organizationId?: string | null;
  workspaceId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  beforeState?: Prisma.InputJsonObject | null;
  afterState?: Prisma.InputJsonObject | null;
  reason?: string | null;
  requestMeta?: RequestMeta;
};

/**
 * Writes the authoritative audit trail (audit_logs). Rows are append-only at
 * the database layer. Pass the transaction client so the audit record commits
 * or rolls back together with the mutation it describes.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: AuditRecordInput, db: Db = this.prisma) {
    const { requestMeta } = input;
    return db.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        actorRole: input.actorRole ?? null,
        organizationId: input.organizationId ?? null,
        workspaceId: input.workspaceId ?? null,
        eventType: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        beforeJson: input.beforeState ?? Prisma.DbNull,
        afterJson: input.afterState ?? Prisma.DbNull,
        reason: input.reason ?? null,
        ipAddress: requestMeta?.ipAddress ?? null,
        deviceMetadata: requestMeta?.userAgent
          ? { userAgent: requestMeta.userAgent }
          : Prisma.DbNull,
      },
    });
  }

  list(limit = 100) {
    const safeLimit = Math.min(Math.max(limit, 1), 500);
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
    });
  }
}
