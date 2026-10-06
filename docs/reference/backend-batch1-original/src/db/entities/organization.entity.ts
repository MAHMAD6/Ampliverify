import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityStatus } from './enums';
import { Workspace } from './workspace.entity';
import { OrganizationMembership } from './organization-membership.entity';
import { Project } from './project.entity';

@Entity({ name: 'organizations' })
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 120 })
  slug: string;

  @Column({ type: 'enum', enum: EntityStatus, default: EntityStatus.ACTIVE })
  status: EntityStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => Workspace, (workspace) => workspace.organization)
  workspaces: Workspace[];

  @OneToMany(() => OrganizationMembership, (membership) => membership.organization)
  memberships: OrganizationMembership[];

  @OneToMany(() => Project, (project) => project.organization)
  projects: Project[];
}
