import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ECSClientService } from 'src/aws/ecs.service';
import { OvhService } from 'src/ovh/ovh.service';
import { ICloudService } from './cloud-service.interface';

enum CloudProvider {
  OVH = 'ovh',
  AWS = 'aws',
}

@Injectable()
export class CloudService {
  private readonly cloudService: ICloudService;
  private readonly cloudProvider: CloudProvider = CloudProvider.OVH;

  constructor(
    @Inject(forwardRef(() => OvhService))
    private readonly ovhService: OvhService,
    @Inject(forwardRef(() => ECSClientService))
    private readonly ecsService: ECSClientService,
    private readonly configService: ConfigService,
  ) {
    this.cloudProvider = this.configService.get('cloud.provider');
    this.cloudService =
      this.configService.get('cloud.provider') === CloudProvider.OVH
        ? this.ovhService
        : this.ecsService;
  }

  async runGoogleBotTask(command: string[]): Promise<string> {
    if (this.cloudProvider === CloudProvider.OVH) {
      const image = this.configService.get('ovh.imageGoogle');
      return this.ovhService.runTask({
        command,
        image,
      });
    }

    if (this.cloudProvider === CloudProvider.AWS) {
      const taskDefinition = this.configService.get(
        'aws.ecsTaskDefinitionGoogle',
      );
      const containerName = this.configService.get(
        'aws.ecsContainerNameGoogle',
      );
      return this.ecsService.runTask({
        command,
        taskDefinition,
        containerName,
      });
    }
  }

  async runTeemsBotTask(command: string[]): Promise<string> {
    if (this.cloudProvider === CloudProvider.OVH) {
      const image = this.configService.get('ovh.imageTeems');
      return this.ovhService.runTask({
        command,
        image,
      });
    }

    if (this.cloudProvider === CloudProvider.AWS) {
      const taskDefinition = this.configService.get(
        'aws.ecsTaskDefinitionTeams',
      );
      const containerName = this.configService.get('aws.ecsContainerNameTeams');
      return this.ecsService.runTask({
        command,
        taskDefinition,
        containerName,
      });
    }
  }

  async runZoomBotTask(command: string[]): Promise<string> {
    if (this.cloudProvider === CloudProvider.OVH) {
      const image = this.configService.get('ovh.imageZoom');
      return this.ovhService.runTask({
        command,
        image,
      });
    }

    if (this.cloudProvider === CloudProvider.AWS) {
      const taskDefinition = this.configService.get(
        'aws.ecsTaskDefinitionZoom',
      );
      const containerName = this.configService.get('aws.ecsContainerNameZoom');
      return this.ecsService.runTask({
        command,
        taskDefinition,
        containerName,
      });
    }
  }

  async stopTask(taskId: string): Promise<void> {
    return this.cloudService.stopTask(taskId);
  }

  async syncTaskStatus(): Promise<void> {
    return this.cloudService.syncTaskStatus();
  }
}
