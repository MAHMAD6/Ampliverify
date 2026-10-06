import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ScopeType } from './enums';
import { User } from './user.entity';
import { Role } from './role.entity';
import { Organization } from './organization.entity';
import { Workspace } from './workspace.entity';
import { Project } from './project.entity';

@Entity({ name: 'role_assignments' })
@Check(
  'ck_role_assignments_scope',
  `(
    (scope_type = 'GLOBAL' AND organization_id IS NULL AND workspace_id IS NULL AND project_id IS NULL) OR
    (scope_type = 'ORGANIZATION' AND organization_id IS NOT NULL AND workspace_id IS NULL AND project_id IS NULL) OR
    (scope_type = 'WORKSPACE' AND organization_id IS NULL AND workspace_id IS NOT NULL AND project_id IS NULL) OR
    (scope_type = 'PROJECT' AND organization_id IS NULL AND workspace_id IS NULL AND project_id IS NOT NULL)
  )`,
)
export class RoleAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.roleAssignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index()
  @Column({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @ManyToOne(() => Role, (role) => role.assignments, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Index()
  @Column({ name: 'scope_type', type: 'enum', enum: ScopeType })
  scopeType: ScopeType;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @Column({ name: 'workspace_id', type: 'uuid', nullable: true })
  workspaceId: string | null;

  @ManyToOne(() => Workspace, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace | null;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @ManyToOne(() => Project, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Index()
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;
}
