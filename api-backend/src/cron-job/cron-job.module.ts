import { Module } from '@nestjs/common';
import { CronJobService } from './cron-job.service';
import { ScheduleModule } from '@nestjs/schedule';
import { BotModule } from 'src/bot/bot.module';
import { GrpcModule } from 'src/grpc/grpc.module';
import { CloudModule } from 'src/cloud/cloud.module';

@Module({
  imports: [ScheduleModule.forRoot(), CloudModule, BotModule, GrpcModule],
  providers: [CronJobService],
  exports: [CronJobService],
})
export class CronJobModule {}
