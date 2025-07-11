import { Module } from '@nestjs/common';
import { CustomerAuthModule } from './auth/auth.module';
import { StatsModule } from './stats/stats.module';
import { RecordingsModule } from './recordings/recordings.module';
import { CustomerApiKeysModule } from './api-keys/api-keys.module';
import { BillingModule } from './billing/billing.module';

@Module({
  imports: [
    CustomerAuthModule,
    StatsModule,
    RecordingsModule,
    CustomerApiKeysModule,
    BillingModule,
  ],
  exports: [
    CustomerAuthModule,
    StatsModule,
    RecordingsModule,
    CustomerApiKeysModule,
    BillingModule,
  ],
})
export class CustomerModulesModule {}
