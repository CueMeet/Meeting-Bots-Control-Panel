import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LavaPaymentsService } from './lavapayments.service';
import { BillingController } from './billing.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { Customer } from '../../database/models/customer/customer.model';
import { CustomerAuthModule } from '../auth/auth.module';
import { CustomerUsage } from '../../database/models/customer/customer-usage.model';
import { CustomerBot } from '../../database/models/customer/customer-bot.model';
import { LavaWebhookController } from './lava-webhook.controller';

@Module({
  imports: [
    ConfigModule,
    SequelizeModule.forFeature([Customer, CustomerBot, CustomerUsage]),
    CustomerAuthModule,
  ],
  providers: [LavaPaymentsService],
  controllers: [BillingController, LavaWebhookController],
  exports: [LavaPaymentsService],
})
export class BillingModule {}
