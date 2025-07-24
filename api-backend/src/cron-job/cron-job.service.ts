import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { lastValueFrom } from 'rxjs';
import { ECSClientService } from 'src/aws/ecs.service';
import { BotService } from 'src/bot/bot.service';
import { WorkerService } from 'src/grpc/worker.service';
import { MonthlySubscriptionService } from 'src/customer-modules/billing/monthly-subscription.service';
import { RecordingsService } from 'src/customer-modules/recordings/recordings.service';

@Injectable()
export class CronJobService {
  constructor(
    private readonly ecsService: ECSClientService,
    private readonly botService: BotService,
    private readonly workerService: WorkerService,
    private readonly monthlySubscriptionService: MonthlySubscriptionService,
    private readonly recordingsService: RecordingsService,
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
    } catch (error) {
      console.error('Error in bot status check cron job:', error);
    }
  }

  // Customer module Schedulers
  /**
   * Process monthly base fees for all active customers
   * Runs on the 1st of every month at 2 AM
   */
  @Cron('0 2 1 * *') // 1st of every month at 2 AM
  async processMonthlyBaseFees(): Promise<void> {
    try {
      console.log('Starting monthly base fee processing cron job');
      await this.monthlySubscriptionService.processMonthlyBaseFees();
      console.log('Monthly base fee processing cron job completed');
    } catch (error) {
      console.error('Error in monthly base fee processing cron job:', error);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkCustomerBotStatus(): Promise<void> {
    try {
      console.log('Checking customer bot status and processing');

      // Get all running customer bots
      const runningCustomerBots =
        await this.recordingsService.getRunningCustomerBots();

      if (runningCustomerBots.length === 0) {
        console.log('No running customer bots found');
        return;
      }

      console.log(
        `Found ${runningCustomerBots.length} running customer bots to check`,
      );

      let updatedCount = 0;
      let errorCount = 0;

      // Check each running customer bot
      for (const customerBot of runningCustomerBots) {
        try {
          // Get the original bot ID from customer bot metadata
          const originalBotId = (customerBot.customMetadata as any)
            ?.originalBotId;

          if (!originalBotId) {
            console.warn(
              `Customer bot ${customerBot.id} has no original bot ID`,
            );
            continue;
          }

          // Retrieve bot status from bot service
          const botStatus = await this.botService.getBot(originalBotId);

          if (!botStatus) {
            console.warn(`Could not retrieve status for bot ${originalBotId}`);
            continue;
          }

          // Check if bot status has changed to COMPLETED, FAILED, or STOPPED
          if (['COMPLETED', 'FAILED', 'STOPPED'].includes(botStatus.status)) {
            console.log(
              `Bot ${originalBotId} status: ${botStatus.status}, updating customer bot ${customerBot.id}`,
            );

            // Update customer bot status
            const success =
              await this.recordingsService.updateCustomerBotStatus(
                customerBot.id,
                botStatus.status,
                botStatus.leaveAt ? new Date(botStatus.leaveAt) : new Date(),
              );

            if (success) {
              updatedCount++;
              console.log(
                `Successfully updated customer bot ${customerBot.id} status to ${botStatus.status}`,
              );
            } else {
              errorCount++;
              console.error(
                `Failed to update customer bot ${customerBot.id} status`,
              );
            }
          } else if (
            botStatus.status === 'STARTED' &&
            customerBot.status !== 'RECORDING'
          ) {
            // Update status to RECORDING if bot has started
            const success =
              await this.recordingsService.updateCustomerBotStatus(
                customerBot.id,
                botStatus.status,
              );

            if (success) {
              updatedCount++;
              console.log(
                `Updated customer bot ${customerBot.id} status to RECORDING`,
              );
            }
          }
        } catch (error) {
          errorCount++;
          console.error(
            `Error checking customer bot ${customerBot.id}:`,
            error,
          );
        }
      }

      console.log(
        `Customer bot status check completed: ${updatedCount} updated, ${errorCount} errors`,
      );
    } catch (error) {
      console.error('Error in customer bot status check cron job:', error);
    }
  }
}
