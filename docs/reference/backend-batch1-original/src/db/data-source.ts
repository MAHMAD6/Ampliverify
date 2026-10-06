import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import {
  AuditEvent,
  Organization,
  OrganizationMembership,
  Permission,
  Project,
  Role,
  RoleAssignment,
  RolePermission,
  User,
  Workspace,
  WorkspaceMembership,
} from './entities';

loadEnv();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    User,
    Organization,
    Workspace,
    OrganizationMembership,
    WorkspaceMembership,
    Project,
    Role,
    Permission,
    RolePermission,
    RoleAssignment,
    AuditEvent,
  ],
  migrations: [resolve(__dirname, 'migrations/*{.ts,.js}')],
  synchronize: false,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
});
