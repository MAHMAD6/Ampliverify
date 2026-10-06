import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditEvent } from '../db/entities';

export type AuditRecordInput = {
  actorUserId?: string | null;
  actorRole?: string | null;
  organizationId?: string | null;
  workspaceId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  reason?: string | null;
  ipAddress?: string | null;
  deviceMetadata?: Record<string, unknown> | null;
};

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditEvent)
    private readonly auditEvents: Repository<AuditEvent>,
  ) {}

  record(input: AuditRecordInput) {
    return this.auditEvents.save(this.auditEvents.create(input));
  }

  recordWithManager(manager: EntityManager, input: AuditRecordInput) {
    const repo = manager.getRepository(AuditEvent);
    return repo.save(repo.create(input));
  }

  list(limit = 100) {
    const safeLimit = Math.min(Math.max(limit, 1), 500);
    return this.auditEvents.find({
      order: { createdAt: 'DESC' },
      take: safeLimit,
    });
  }
}
