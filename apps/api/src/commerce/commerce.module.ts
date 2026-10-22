import { Global, Module } from '@nestjs/common';
import { CreditsService } from './credits.service';
import { EntitlementsService } from './entitlements.service';
import { SettingsService } from './settings.service';
import { ProviderBudgetService } from './provider-budget.service';

/** Credits, entitlements and platform settings, shared by every product module. */
@Global()
@Module({
  providers: [SettingsService, CreditsService, EntitlementsService, ProviderBudgetService],
  exports: [SettingsService, CreditsService, EntitlementsService, ProviderBudgetService],
})
export class CommerceModule {}
