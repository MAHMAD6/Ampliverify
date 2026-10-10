import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PlatformModule } from './platform/platform.module';
import { RetentionModule } from './retention/retention.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { PlatformGuard } from './platform/platform.guard';
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
import { ReportsModule } from './reports/reports.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { CmsModule } from './cms/cms.module';
import { InsightsModule } from './insights/insights.module';

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
    ReportsModule,
    IntegrationsModule,
    CmsModule,
    InsightsModule,
    PlatformModule,
    RetentionModule,
    // Per-user (or per-IP when anonymous) request budget; see RateLimitGuard.
    ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 600) }] }),
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwksAuthGuard,
    },
    // After authentication: maintenance mode and admin MFA.
    {
      provide: APP_GUARD,
      useClass: PlatformGuard,
    },
  ],
})
export class AppModule {}
