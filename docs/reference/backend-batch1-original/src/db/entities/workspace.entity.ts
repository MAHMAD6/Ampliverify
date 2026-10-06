import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { EntityStatus } from './enums';
import { Organization } from './organization.entity';
import { WorkspaceMembership } from './workspace-membership.entity';
import { Project } from './project.entity';

@Entity({ name: 'workspaces' })
@Unique('uq_workspaces_org_slug', ['organizationId', 'slug'])
@Unique('uq_workspaces_id_org', ['id', 'organizationId'])
export class Workspace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, (organization) => organization.workspaces, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 120 })
  slug: string;

  @Column({ type: 'enum', enum: EntityStatus, default: EntityStatus.ACTIVE })
  status: EntityStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => WorkspaceMembership, (membership) => membership.workspace)
  memberships: WorkspaceMembership[];

  @OneToMany(() => Project, (project) => project.workspace)
  projects: Project[];
}
