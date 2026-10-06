import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'audit_events' })
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ name: 'actor_role', type: 'varchar', length: 120, nullable: true })
  actorRole: string | null;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  @Index()
  @Column({ name: 'workspace_id', type: 'uuid', nullable: true })
  workspaceId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 160 })
  action: string;

  @Column({ name: 'target_type', type: 'varchar', length: 120 })
  targetType: string;

  @Column({ name: 'target_id', type: 'uuid', nullable: true })
  targetId: string | null;

  @Column({ name: 'before_state', type: 'jsonb', nullable: true })
  beforeState: Record<string, unknown> | null;

  @Column({ name: 'after_state', type: 'jsonb', nullable: true })
  afterState: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress: string | null;

  @Column({ name: 'device_metadata', type: 'jsonb', nullable: true })
  deviceMetadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
