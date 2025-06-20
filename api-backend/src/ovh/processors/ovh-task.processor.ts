import { Logger } from '@nestjs/common';

import { OvhService } from '../ovh.service';

import {
  OVH_TASK_INITIATE_FAILED_TASK,
  OVH_TASK_QUEUE,
} from 'src/constants/bull-queue';
import { Bot, ExecutionStatusLogEnum } from 'src/database/models/bot.model';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor(OVH_TASK_QUEUE)
export class OVHTaskProcessor extends WorkerHost {
  constructor(
    private readonly ovhService: OvhService,
    @InjectModel(Bot)
    private readonly botModel: typeof Bot,
    private readonly configService: ConfigService,
  ) {
    super();
  }
  public readonly logger = new Logger(OVHTaskProcessor.name);

  process(job: Job): Promise<any> {
    const { name, data } = job;

    switch (name) {
      case OVH_TASK_INITIATE_FAILED_TASK:
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
      const newTaskId = await this.ovhService.reInitiateTask(bot.taskId);

      await bot.update({
        taskId: newTaskId,
        status: ExecutionStatusLogEnum.STARTED,
        retryCount: bot.retryCount + 1,
      });
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.log(`OVH TASK QUEUE: Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `OVH TASK QUEUE: Job ${job.id} failed with error: ${error.message}`,
    );
  }
}
