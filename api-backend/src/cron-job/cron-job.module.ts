import { Module } from '@nestjs/common';
import { CronJobService } from './cron-job.service';
import { ScheduleModule } from '@nestjs/schedule';
import { AwsModule } from 'src/aws/aws.module';
import { BotModule } from 'src/bot/bot.module';

@Module({
  imports: [ScheduleModule.forRoot(), AwsModule, BotModule],
  providers: [CronJobService],
  exports: [CronJobService],
})
export class CronJobModule {}
