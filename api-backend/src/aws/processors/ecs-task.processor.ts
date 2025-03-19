import { Logger } from '@nestjs/common';

import { ECSClientService } from '../ecs.service';

import {
  ECS_TASK_INITIATE_FAILED_TASK,
  ECS_TASK_QUEUE,
} from 'src/constants/bull-queue';
import { Bot, ExecutionStatusLogEnum } from 'src/database/models/bot.model';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor(ECS_TASK_QUEUE)
export class ECSTaskProcessor extends WorkerHost {
  constructor(
    private readonly ecsService: ECSClientService,
    @InjectModel(Bot)
    private readonly botModel: typeof Bot,
    private readonly configService: ConfigService,
  ) {
    super();
  }
  public readonly logger = new Logger(ECSTaskProcessor.name);

  process(job: Job): Promise<any> {
    const { name, data } = job;

    switch (name) {
      case ECS_TASK_INITIATE_FAILED_TASK:
        return this.reInitiateFailedTasks(data.botId);
    }
  }

  async reInitiateFailedTasks(botId: string): Promise<void> {
    if (!botId) return;

    const bot = await this.botModel.findByPk(botId);

    if (
      bot.taskId &&
      bot.status === ExecutionStatusLogEnum.FAILED &&
      bot.retryCount < this.configService.get('bot.meetingBotRetryCount')
    ) {
      const newTaskId = await this.ecsService.reInitiateTask(bot.taskId);

      await bot.update({
        taskId: newTaskId,
        status: ExecutionStatusLogEnum.STARTED,
        retryCount: bot.retryCount + 1,
      });
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.log(`ECS TASK QUEUE: Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `ECS TASK QUEUE: Job ${job.id} failed with error: ${error.message}`,
    );
  }
}
