import { Injectable, Logger } from '@nestjs/common';
import {
  ContainerOverride,
  DescribeTasksCommand,
  DescribeTasksCommandInput,
  ECSClient,
  LaunchType,
  ListTasksCommand,
  ListTasksCommandInput,
  ListTasksCommandOutput,
  RunTaskCommand,
  RunTaskCommandInput,
  RunTaskCommandOutput,
  StopTaskCommand,
  StopTaskCommandInput,
  StopTaskCommandOutput,
  Task,
} from '@aws-sdk/client-ecs';

import * as moment from 'moment-timezone';
import { Op } from 'sequelize';

import { Queue } from 'bullmq';
import {
  ECS_TASK_INITIATE_FAILED_TASK,
  ECS_TASK_QUEUE,
} from 'src/constants/bull-queue';
import { ConfigService } from '@nestjs/config';
import { TASK_STOPPED_ERROR_CODES } from 'src/constants/ecs';
import { InjectQueue } from '@nestjs/bullmq';
import { Bot, ExecutionStatusLogEnum } from 'src/database/models/bot.model';
import { InjectModel } from '@nestjs/sequelize';
interface TaskInfo {
  taskId?: string;
  lastStatus?: string;
  desiredStatus?: string;
  healthStatus?: string;
  stopCode?: string;
  stoppedReason?: string;
  taskDefinitionArn?: string;
  containerOverrides?: ContainerOverride[];
}

@Injectable()
export class ECSClientService {
  private readonly ecsClient: ECSClient;
  private readonly clusterName: string;
  private readonly launchType: LaunchType = 'FARGATE';

  constructor(
    @InjectModel(Bot)
    private readonly botModel: typeof Bot,
    @InjectQueue(ECS_TASK_QUEUE)
    private readonly ecsTaskQueue: Queue,
    private readonly configService: ConfigService,
  ) {
    this.ecsClient = new ECSClient({
      credentials: {
        accessKeyId: this.configService.get('aws.accessKey'),
        secretAccessKey: this.configService.get('aws.secretKey'),
      },
      region: this.configService.get('aws.bucketRegion'),
    });
    this.clusterName = this.configService.get('aws.ecsClusterName');
  }

  async getTaskInfo(taskId: string): Promise<Task | null> {
    try {
      const input: DescribeTasksCommandInput = {
        cluster: this.clusterName,
        tasks: [taskId],
      };
      const command = new DescribeTasksCommand(input);
      const response = await this.ecsClient.send(command);

      if (response.tasks && response.tasks.length > 0) {
        return response.tasks[0];
      }

      return null;
    } catch (error) {
      Logger.error(`Failed to get task info: ${error}`);
      throw error;
    }
  }

  async runTask(
    taskDefinition: string,
    containerName: string,
    command: string[],
    taskCount = 1,
  ): Promise<RunTaskCommandOutput> {
    try {
      const input: RunTaskCommandInput = {
        cluster: this.clusterName,
        launchType: this.launchType,
        taskDefinition,
        count: taskCount,
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: [this.configService.get('aws.vpsSubnet')],
            assignPublicIp: 'ENABLED',
            securityGroups: [this.configService.get('aws.securityGroup')],
          },
        },
        overrides: {
          containerOverrides: [
            {
              name: containerName,
              command,
            },
          ],
        },
      };

      const commandInstance = new RunTaskCommand(input);

      return this.ecsClient.send(commandInstance);
    } catch (error) {
      Logger.error(`Failed to run task: ${error}`);
      throw error;
    }
  }

  async stopTask(taskId: string): Promise<StopTaskCommandOutput> {
    try {
      const input: StopTaskCommandInput = {
        cluster: this.clusterName,
        task: taskId,
      };
      const command = new StopTaskCommand(input);

      return this.ecsClient.send(command);
    } catch (error) {
      Logger.error(`Failed to stop task: ${error}`);
      throw error;
    }
  }

  async listTasks(): Promise<ListTasksCommandOutput> {
    try {
      const input: ListTasksCommandInput = {
        cluster: this.clusterName,
      };
      const command = new ListTasksCommand(input);

      return this.ecsClient.send(command);
    } catch (error) {
      Logger.error(`Failed to list tasks: ${error}`);
      throw error;
    }
  }

  async healthCheckTask(taskId: string): Promise<TaskInfo> {
    try {
      const input: DescribeTasksCommandInput = {
        cluster: this.clusterName,
        tasks: [taskId],
      };
      const command = new DescribeTasksCommand(input);
      const response = await this.ecsClient.send(command);

      if (response.tasks && response.tasks.length > 0) {
        const task = response.tasks[0];

        return {
          taskId: task.taskArn,
          lastStatus: task.lastStatus,
          desiredStatus: task.desiredStatus,
          healthStatus: task.healthStatus,
          stopCode: task.stopCode,
          stoppedReason: task.stoppedReason,
          taskDefinitionArn: task.taskDefinitionArn,
          containerOverrides: task?.overrides?.containerOverrides,
        };
      } else {
        throw new Error('Task not found');
      }
    } catch (error) {
      Logger.error(`Failed to perform health check on task: ${error}`);
      throw error;
    }
  }

  async syncTaskStatus(): Promise<void> {
    console.log('Starting ECS task status synchronization...');
    const bots = await this.botModel.findAll({
      where: {
        taskId: { [Op.not]: null as unknown },
        status: ExecutionStatusLogEnum.STARTED,
        createdAt: {
          [Op.between]: [
            moment().startOf('day').toISOString(),
            moment().endOf('day').toISOString(),
          ],
        },
      },
    });

    for (const bot of bots) {
      try {
        const taskInfo = await this.healthCheckTask(bot.taskId);

        if (
          taskInfo?.lastStatus === 'STOPPED' &&
          TASK_STOPPED_ERROR_CODES.includes(taskInfo?.stopCode)
        ) {
          await bot.update({
            status: ExecutionStatusLogEnum.FAILED,
          });
          if (this.configService.get('nodeEnv') === 'production') {
            await this.ecsTaskQueue.add(
              ECS_TASK_INITIATE_FAILED_TASK,
              { botId: bot.id },
              {
                removeOnComplete: true,
                removeOnFail: true,
              },
            );
          }
        } else if (taskInfo?.lastStatus === 'STOPPED') {
          await bot.update({
            status: ExecutionStatusLogEnum.COMPLETED,
          });
        }
      } catch (error) {
        await bot.update({
          status: ExecutionStatusLogEnum.FAILED,
        });
        console.error(`Failed to sync task(${bot.id}) status: ${error}`);
      }
    }
  }

  async reInitiateTask(taskId: string): Promise<string> {
    const taskInfo = await this.healthCheckTask(taskId);
    const taskDefinition = taskInfo.taskDefinitionArn?.split('/').pop();
    const containerName = taskInfo?.containerOverrides?.[0]?.name;
    const command = taskInfo.containerOverrides?.[0]?.command;

    const res = await this.runTask(taskDefinition, containerName, command);

    if (!(res.hasOwnProperty('tasks') && res['tasks'].length > 0))
      throw new Error('Failed to start ECS task.');

    const newTaskId = res['tasks'][0].taskArn.split('/').pop();

    return newTaskId;
  }

  getTaskIdByTaskArn(taskArn: string): string {
    return taskArn.split('/').pop() ?? '';
  }
}
