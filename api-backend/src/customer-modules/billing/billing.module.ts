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
import { MonthlySubscriptionService } from './monthly-subscription.service';
import { CustomerPayment } from '../../database/models/customer/customer-payment.model';

@Module({
  imports: [
    ConfigModule,
    SequelizeModule.forFeature([
      Customer,
      CustomerBot,
      CustomerUsage,
      CustomerPayment,
    ]),
    CustomerAuthModule,
  ],
  providers: [LavaPaymentsService, MonthlySubscriptionService],
  controllers: [BillingController, LavaWebhookController],
  exports: [LavaPaymentsService, MonthlySubscriptionService],
})
export class BillingModule {}
