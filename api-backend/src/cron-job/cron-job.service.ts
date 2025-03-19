import { Injectable } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { Cron } from '@nestjs/schedule';
import { ECSClientService } from 'src/aws/ecs.service';
import { BotService } from 'src/bot/bot.service';
@Injectable()
export class CronJobService {
  constructor(
    private readonly ecsService: ECSClientService,
    private readonly botService: BotService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async runEvery5Minutes(): Promise<void> {
    await this.ecsService.syncTaskStatus();
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async runEvery10Minutes(): Promise<void> {
    await this.botService.initiateScheduledBot();
  }
}
