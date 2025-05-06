import { Injectable } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { Cron } from '@nestjs/schedule';
import { ECSClientService } from 'src/aws/ecs.service';
import { BotService } from 'src/bot/bot.service';
import { WorkerService } from 'src/grpc/worker.service';
import { v4 as uuidv4 } from 'uuid';
import { lastValueFrom } from 'rxjs';

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

  @Cron(CronExpression.EVERY_10_MINUTES)
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

      // Find bots that have failed due to non-error conditions
      const bots = await this.botService.findBotsWithNonErrorFailures();

      console.log('Bots with non-error failures: ', bots);

      // Process each bot that needs attention
      for (const bot of bots) {
        try {
          // Generate presigned URLs to get the raw_file_key (tarObjectName)
          const { tarObjectName } = await this.botService.generatePresignedUrls(
            {
              botId: bot.id,
              userId: bot.apiKey.userId,
              uuid: uuidv4(),
              metadata: {
                id: bot.id,
                user_id: bot.apiKey.userId,
                bot_type: bot.platform,
                ...(bot.title && { meeting_title: bot.title }),
              },
            },
          );

          if (tarObjectName) {
            // Make gRPC request to create file management entry using lastValueFrom
            console.log(
              'Making gRPC request to create file management entry to: ',
              bot,
            );
            const res = await lastValueFrom(
              this.workerService.createFileLog({
                id: bot.id,
                raw_file_key: tarObjectName,
                ...(bot.title && { meeting_title: bot.title }),
                ...(bot.apiKey.userId && {
                  created_by_user_id: bot.apiKey.userId,
                }),
              }),
            );
            console.log('Create FileLog Response', res);
          }
        } catch (error) {
          console.error(`Error processing bot ${bot.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in bot status check cron job:', error);
    }
  }
}
