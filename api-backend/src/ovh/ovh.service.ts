import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  ICloudService,
  IRunTaskInput,
} from 'src/cloud/cloud-service.interface';
import * as k8s from '@kubernetes/client-node';
import { Op } from 'sequelize';
import {
  ECS_TASK_INITIATE_FAILED_TASK,
  ECS_TASK_QUEUE,
} from 'src/constants/bull-queue';
import * as moment from 'moment';

import { InjectModel } from '@nestjs/sequelize';
import { Bot, ExecutionStatusLogEnum } from 'src/database/models/bot.model';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { v4 as uuidv4 } from 'uuid';
import { IJobInfo } from 'src/interfaces/ovh/job-Info';
import { BotService } from 'src/bot/bot.service';

@Injectable()
export class OvhService implements ICloudService {
  private readonly k8sApi: k8s.BatchV1Api;
  private readonly k8sCoreApi: k8s.CoreV1Api;
  private readonly namespace: string;
  private readonly kubeConfig: k8s.KubeConfig;

  constructor(
    @InjectModel(Bot)
    private readonly botModel: typeof Bot,
    @InjectQueue(ECS_TASK_QUEUE)
    private readonly ecsTaskQueue: Queue,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => BotService))
    private readonly botService: BotService,
  ) {
    this.kubeConfig = new k8s.KubeConfig();

    // Load configuration - can be from file, cluster, or OVH credentials
    if (this.configService.get('ovh.kubeConfigPath')) {
      this.kubeConfig.loadFromFile(
        this.configService.get('ovh.kubeConfigPath'),
      );
    } else {
      // Load from default locations or cluster service account
      this.kubeConfig.loadFromDefault();
    }

    this.k8sApi = this.kubeConfig.makeApiClient(k8s.BatchV1Api);
    this.k8sCoreApi = this.kubeConfig.makeApiClient(k8s.CoreV1Api);
    this.namespace =
      this.configService.get('ovh.clusterNamespace') || 'default';
  }

  async runTask({
    image,
    command,
    taskCount = 1,
    resourceRequests,
    resourceLimits,
  }: IRunTaskInput): Promise<string> {
    try {
      const jobName = uuidv4();
      const jobManifest: k8s.V1Job = {
        apiVersion: 'batch/v1',
        kind: 'Job',
        metadata: {
          name: jobName,
          namespace: this.namespace,
        },
        spec: {
          completions: taskCount,
          parallelism: taskCount,
          template: {
            spec: {
              restartPolicy: 'Never',
              // Add image pull secrets for OVH private registry
              imagePullSecrets: [
                {
                  name: this.configService.get('ovh.imagePullSecret'),
                },
              ],
              containers: [
                {
                  name: 'cuemeet-bot',
                  // Use OVH private registry format
                  image: image, // e.g., 'your-registry.gra.cloud.ovh.net/your-namespace/cuecard-google-bot-staging:latest'
                  command: command,
                  // Environment variables from ECS task definition
                  env: [
                    {
                      name: 'ENVIRONMENT_NAME',
                      value: this.configService.get(
                        'ovh.botEnv.ENVIRONMENT_NAME',
                      ),
                    },
                    {
                      name: 'DEBUG',
                      value: this.configService.get('ovh.botEnv.DEBUG'),
                    },
                    {
                      name: 'HIGHLIGHT_PROJECT_ID',
                      value: this.configService.get(
                        'ovh.botEnv.HIGHLIGHT_PROJECT_ID',
                      ),
                    },
                  ],
                  resources: {
                    // Convert ECS resources (1024 CPU units = 1 vCPU, 2048 MB = 2Gi)
                    requests: resourceRequests || {
                      cpu: '1000m', // 1 vCPU (ECS: 1024 CPU units)
                      memory: '2Gi', // 2GB (ECS: 2048 MB)
                    },
                    limits: resourceLimits || {
                      cpu: '1000m', // Match requests for guaranteed QoS
                      memory: '2Gi', // Match requests for guaranteed QoS
                    },
                  },
                },
              ],
            },
          },
          backoffLimit: 4,
          activeDeadlineSeconds: 3600,
        },
      };

      await this.k8sApi.createNamespacedJob({
        namespace: this.namespace,
        body: jobManifest,
      });

      return jobName;
    } catch (error) {
      console.error(`Failed to run job: ${error}`);
      throw error;
    }
  }
  async stopTask(taskId: string): Promise<void> {
    try {
      await this.k8sApi.deleteNamespacedJob({
        name: taskId,
        namespace: this.namespace,
        propagationPolicy: 'Background',
      });
    } catch (error) {
      console.error(`Failed to stop job: ${error}`);
      throw error;
    }
  }

  async getTaskInfo(taskId: string): Promise<k8s.V1Job | null> {
    try {
      const response = await this.k8sApi.readNamespacedJob({
        name: taskId,
        namespace: this.namespace,
      });
      return response;
    } catch (error) {
      console.error(`Failed to get job info: ${error}`);
      throw error;
    }
  }
  async healthCheckTask(taskId: string): Promise<IJobInfo> {
    try {
      const jobResponse = await this.k8sApi.readNamespacedJob({
        name: taskId,
        namespace: this.namespace,
      });
      const job = jobResponse;

      // Get pods associated with this job
      const podsResponse = await this.k8sCoreApi.listNamespacedPod({
        namespace: this.namespace,
        labelSelector: `job-name=${taskId}`,
      });

      const pods = podsResponse.items;
      const latestPod = pods.length > 0 ? pods[pods.length - 1] : null;

      let status = 'Unknown';
      let failureReason = '';

      if (job.status?.succeeded) {
        status = 'Succeeded';
      } else if (job.status?.failed) {
        status = 'Failed';
        failureReason =
          job.status.conditions?.[0]?.message || 'Unknown failure';
      } else if (job.status?.active) {
        status = 'Running';
      }

      return {
        jobName: job.metadata?.name,
        status,
        completionTime: job.status?.completionTime?.toISOString(),
        failureReason,
        podName: latestPod?.metadata?.name,
        containerOverrides: job.spec?.template?.spec?.containers,
      };
    } catch (error) {
      console.error(`Failed to perform health check on job: ${error}`);
      throw error;
    }
  }
  async syncTaskStatus(): Promise<void> {
    console.log('Starting Kubernetes job status synchronization...');
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
        const jobInfo = await this.healthCheckTask(bot.taskId);

        if (jobInfo?.status === 'Failed') {
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
        } else if (jobInfo?.status === 'Succeeded') {
          await bot.update({
            status: ExecutionStatusLogEnum.COMPLETED,
          });
          await this.botService.triggerTranscriptGeneration(bot.id);
        }
      } catch (error) {
        await bot.update({
          status: ExecutionStatusLogEnum.FAILED,
        });
        console.error(`Failed to sync job(${bot.id}) status: ${error}`);
      }
    }
  }
  async reInitiateTask(taskId: string): Promise<string> {
    // Get original job configuration to recreate
    const originalJob = await this.getTaskInfo(taskId);
    if (!originalJob?.spec?.template?.spec?.containers?.[0]) {
      throw new Error('Could not retrieve original job configuration');
    }

    const container = originalJob.spec.template.spec.containers[0];

    const newJobName = await this.runTask({
      containerName: container.image || '',
      command: container.command || [],
    });

    return newJobName;
  }
}
