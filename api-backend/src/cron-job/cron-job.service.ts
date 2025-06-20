import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { lastValueFrom } from 'rxjs';
import { BotService } from 'src/bot/bot.service';
import { CloudService } from 'src/cloud/cloud.service';
import { WorkerService } from 'src/grpc/worker.service';

@Injectable()
export class CronJobService {
  private readonly logger = new Logger(CronJobService.name);
  constructor(
    private readonly cloudService: CloudService,
    private readonly botService: BotService,
    private readonly workerService: WorkerService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async runEvery5Minutes(): Promise<void> {
    try {
      this.logger.log('Checking bot status and processing');
      // First check if the worker service is healthy
      const healthCheck = await lastValueFrom(this.workerService.healthCheck());

      if (healthCheck?.ServingStatus !== '200') {
        this.logger.log(
          'Worker service is not healthy, skipping bot status check',
        );
        return;
      }
      // Get bot status through ECS service
      await this.cloudService.syncTaskStatus();
    } catch (error) {
      this.logger.error('Error in bot status check cron job:', error);
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async runEvery10Minutes(): Promise<void> {
    await this.botService.initiateScheduledBot();
  }
}
