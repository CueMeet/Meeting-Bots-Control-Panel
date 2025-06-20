import { forwardRef, Module } from '@nestjs/common';
import { OvhService } from './ovh.service';
import { BullModule } from '@nestjs/bullmq';
import { OVH_TASK_QUEUE } from 'src/constants/bull-queue';
import { BotModule } from 'src/bot/bot.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => BotModule),
    BullModule.registerQueue({
      name: OVH_TASK_QUEUE,
    }),
  ],
  providers: [OvhService],
  exports: [OvhService],
})
export class OvhModule {}
