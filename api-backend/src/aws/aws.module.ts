import { forwardRef, Module } from '@nestjs/common';
import { AwsService } from './aws.service';
import { ConfigModule } from '@nestjs/config';
import { ECSClientService } from './ecs.service';
import { BotModule } from 'src/bot/bot.module';
import { BullModule } from '@nestjs/bullmq';
import { ECS_TASK_QUEUE } from 'src/constants/bull-queue';

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
