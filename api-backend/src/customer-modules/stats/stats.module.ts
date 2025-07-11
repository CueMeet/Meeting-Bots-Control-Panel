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

@Module({
  imports: [
    SequelizeModule.forFeature([
      Customer,
      CustomerUsage,
      CustomerBot,
      CustomerApiKey,
    ]),
    CustomerAuthModule,
    RecordingsModule,
  ],
  providers: [StatsService],
  controllers: [StatsController],
  exports: [StatsService],
})
export class StatsModule {}
