import { Module } from '@nestjs/common';
import { CronJobService } from './cron-job.service';
import { ScheduleModule } from '@nestjs/schedule';
import { AwsModule } from 'src/aws/aws.module';
import { BotModule } from 'src/bot/bot.module';
import { GrpcModule } from 'src/grpc/grpc.module';
import { CustomerModulesModule } from 'src/customer-modules/customer-modules.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AwsModule,
    BotModule,
    GrpcModule,
    CustomerModulesModule,
  ],
  providers: [CronJobService],
  exports: [CronJobService],
})
export class CronJobModule {}
