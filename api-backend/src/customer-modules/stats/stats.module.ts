import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Customer } from '../../database/models/customer/customer.model';
import { CustomerUsage } from '../../database/models/customer/customer-usage.model';
import { CustomerBot } from '../../database/models/customer/customer-bot.model';
import { CustomerApiKey } from '../../database/models/customer/customer-api-key.model';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';
import { CustomerAuthModule } from '../auth/auth.module';
import { RecordingsModule } from '../recordings/recordings.module';
import { CustomerPayment } from '../../database/models/customer/customer-payment.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Customer,
      CustomerUsage,
      CustomerBot,
      CustomerApiKey,
      CustomerPayment,
    ]),
    CustomerAuthModule,
    RecordingsModule,
  ],
  providers: [StatsService],
  controllers: [StatsController],
  exports: [StatsService],
})
export class StatsModule {}
