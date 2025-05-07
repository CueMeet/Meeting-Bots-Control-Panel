import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BotModule } from 'src/bot/bot.module';
import { ECS_TASK_QUEUE } from 'src/constants/bull-queue';
import { AwsService } from './aws.service';
import { ECSClientService } from './ecs.service';
@Module({
  imports: [
    ConfigModule,
    forwardRef(() => BotModule),
    BullModule.registerQueue({
      name: ECS_TASK_QUEUE,
    }),
  ],
  providers: [AwsService, ECSClientService],
  exports: [AwsService, ECSClientService],
})
export class AwsModule {}
