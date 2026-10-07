import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { RbacModule } from './rbac/rbac.module';
import { AuditModule } from './audit/audit.module';
import { ProjectsModule } from './projects/projects.module';
import { AdminModule } from './admin/admin.module';
import { JwksAuthGuard } from './auth/jwks-auth.guard';
import { HealthController } from './health.controller';
import { StorageModule } from './storage/storage.module';
import { PublicContentModule } from './public-content/public-content.module';
import { JobsModule } from './jobs/jobs.module';
import { CommerceModule } from './commerce/commerce.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditsModule } from './audits/audits.module';
import { OptimizationModule } from './optimization/optimization.module';
import { BillingModule } from './billing/billing.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { SupportModule } from './support/support.module';
import { AiModule } from './ai/ai.module';
import { GeoModule } from './geo/geo.module';
import { KeywordsModule } from './keywords/keywords.module';
import { ContentModule } from './content/content.module';
import { EditorModule } from './editor/editor.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    StorageModule,
    UsersModule,
    AuthModule,
    OrganizationsModule,
    RbacModule,
    AuditModule,
    ProjectsModule,
    AdminModule,
    PublicContentModule,
    JobsModule,
    CommerceModule,
    NotificationsModule,
    AuditsModule,
    OptimizationModule,
    BillingModule,
    WorkspacesModule,
    SupportModule,
    AiModule,
    GeoModule,
    KeywordsModule,
    ContentModule,
    EditorModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwksAuthGuard,
    },
  ],
})
export class AppModule {}
