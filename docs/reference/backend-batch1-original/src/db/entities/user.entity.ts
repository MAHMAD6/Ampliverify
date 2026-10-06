import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserStatus } from './enums';
import { OrganizationMembership } from './organization-membership.entity';
import { WorkspaceMembership } from './workspace-membership.entity';
import { RoleAssignment } from './role-assignment.entity';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'auth_subject', type: 'varchar', length: 191 })
  authSubject: string;

  @Index({ unique: true })
  @Column({ type: 'citext' })
  email: string;

  @Column({ name: 'display_name', type: 'varchar', length: 160, nullable: true })
  displayName: string | null;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => OrganizationMembership, (membership) => membership.user)
  organizationMemberships: OrganizationMembership[];

  @OneToMany(() => WorkspaceMembership, (membership) => membership.user)
  workspaceMemberships: WorkspaceMembership[];

  @OneToMany(() => RoleAssignment, (assignment) => assignment.user)
  roleAssignments: RoleAssignment[];
}
