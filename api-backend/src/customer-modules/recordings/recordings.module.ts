import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Customer } from '../../database/models/customer/customer.model';
import { CustomerBot } from '../../database/models/customer/customer-bot.model';
import { CustomerApiKey } from '../../database/models/customer/customer-api-key.model';
import { ApiKey } from '../../database/models/api-key.model';
import { CustomerPayment } from '../../database/models/customer/customer-payment.model';
import { RecordingsService } from './recordings.service';
import { RecordingsController } from './recordings.controller';
import { CustomerAuthModule } from '../auth/auth.module';
import { BotModule } from '../../bot/bot.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Customer,
      CustomerBot,
      CustomerApiKey,
      ApiKey,
      CustomerPayment,
    ]),
    CustomerAuthModule,
    BotModule,
    BillingModule,
  ],
  providers: [RecordingsService],
  controllers: [RecordingsController],
  exports: [RecordingsService],
})
export class RecordingsModule {}
