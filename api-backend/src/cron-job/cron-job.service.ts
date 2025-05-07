import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { lastValueFrom } from 'rxjs';
import { ECSClientService } from 'src/aws/ecs.service';
import { BotService } from 'src/bot/bot.service';
import { WorkerService } from 'src/grpc/worker.service';

@Injectable()
export class CronJobService {
  constructor(
    private readonly ecsService: ECSClientService,
    private readonly botService: BotService,
    private readonly workerService: WorkerService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async runEvery5Minutes(): Promise<void> {
    await this.ecsService.syncTaskStatus();
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async runEvery10Minutes(): Promise<void> {
    await this.botService.initiateScheduledBot();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkBotStatusAndProcess(): Promise<void> {
    try {
      console.log('Checking bot status and processing');
      // First check if the worker service is healthy
      const healthCheck = await lastValueFrom(this.workerService.healthCheck());

      if (healthCheck?.ServingStatus !== '200') {
        console.log('Worker service is not healthy, skipping bot status check');
        return;
      }
      // Get bot status through ECS service
      await this.ecsService.syncTaskStatus();
    } catch (error) {
      console.error('Error in bot status check cron job:', error);
    }
  }
}
