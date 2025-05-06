import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import * as moment from 'moment-timezone';
import { lastValueFrom } from 'rxjs';
import { Op } from 'sequelize';
import { AwsService } from 'src/aws/aws.service';
import { ECSClientService } from 'src/aws/ecs.service';
import { ApiKey } from 'src/database/models/api-key.model';
import {
  Bot,
  BotPlatform,
  BotPlatformMappingType,
  ExecutionStatusLogEnum,
} from 'src/database/models/bot.model';
import { CreateBotDto } from 'src/dto/bot/create-bot.dto';
import { PaginationDto } from 'src/dto/common/pagination.dto';
import { WorkerService } from 'src/grpc/worker.service';
import {
  FileManagementResponse,
  TranscriptionLogResponse,
} from 'src/interfaces/proto-generated/transcript_management';
import { v4 as uuidv4 } from 'uuid';
import { TASK_STOPPED_ERROR_CODES } from 'src/constants/ecs';

@Injectable()
export class BotService {
  constructor(
    @InjectModel(Bot)
    private botModel: typeof Bot,
    private readonly awsService: AwsService,
    private readonly ecsService: ECSClientService,
    private readonly configService: ConfigService,
    private readonly workerService: WorkerService,
  ) {}

  async createBot(createBotDto: CreateBotDto, apiKey: ApiKey): Promise<Bot> {
    const meetingPlatform = this.identifyMeetingPlatform(
      createBotDto.meetingUrl,
    );
    if (!meetingPlatform) {
      throw new BadRequestException('Invalid meeting URL');
    }

    const bot = await this.botModel.create({
      name: createBotDto.name,
      meetingUrl: createBotDto.meetingUrl,
      platform: meetingPlatform,
      recordingMode: createBotDto.recordingMode,
      joinAt: createBotDto.joinAt
        ? moment(createBotDto.joinAt).toDate().toISOString()
        : moment().toDate().toISOString(),
      title: createBotDto.title,
      metaData: createBotDto.metaData,
      apiKeyId: apiKey.id,
    });

    if (bot.joinAt && moment(bot.joinAt).isAfter(moment())) {
      return bot;
    }

    return this.initiateBot(bot.id);
  }

  private mapPlatformToType(platform: BotPlatform): BotPlatformMappingType {
    switch (platform) {
      case BotPlatform.GOOGLE_MEET:
        return BotPlatformMappingType.GOOGLE;
      case BotPlatform.TEAMS:
        return BotPlatformMappingType.MS_TEAMS;
      case BotPlatform.ZOOM:
        return BotPlatformMappingType.ZOOM;
      default:
        throw new Error(`Unknown platform: ${platform}`);
    }
  }

  async initiateBot(bot: Bot | string): Promise<Bot> {
    let botInstance: Bot;
    if (typeof bot === 'string') {
      botInstance = await this.botModel.findByPk(bot, {
        include: [{ model: ApiKey, attributes: ['userId'] }],
      });
    } else {
      botInstance = bot;
    }

    if (!botInstance) throw new NotFoundException('Bot not found');

    const metaData = {
      id: botInstance.id,
      user_id: botInstance.apiKey.userId,
      bot_type: botInstance.platform,
      // bot_type: this.mapPlatformToType(botInstance.platform),
      ...(botInstance.title && { meeting_title: botInstance.title }),
    };

    console.log('initiateBot metaData:', metaData);

    const { audioUrl, tarUrl, tarObjectName } =
      await this.generatePresignedUrls({
        botId: botInstance.id,
        userId: botInstance.apiKey.userId,
        metadata: metaData,
        uuid: uuidv4(),
      });

    if (!audioUrl || !tarUrl)
      throw new InternalServerErrorException(
        'Failed to generate presigned url.',
      );

    let taskId;
    switch (botInstance.platform) {
      case BotPlatform.GOOGLE_MEET:
        taskId = await this.startMeetingBotForGoogle(
          botInstance.meetingUrl,
          {
            audioUrl,
            tarUrl,
          },
          botInstance.name,
        );
        break;
      case BotPlatform.ZOOM:
        taskId = await this.startMeetingBotForZoom(
          botInstance.meetingUrl,
          {
            audioUrl,
            tarUrl,
          },
          botInstance.name,
        );
        break;
      case BotPlatform.TEAMS:
        taskId = await this.startMeetingBotForTeems(
          botInstance.meetingUrl,
          {
            audioUrl,
            tarUrl,
          },
          botInstance.name,
        );
        break;
    }

    await botInstance.update({
      taskId,
      status: ExecutionStatusLogEnum.STARTED,
    });
    await botInstance.reload();
    return botInstance;
  }

  async initiateScheduledBot(): Promise<void> {
    const currentTime = moment();
    const nextHalfHour = moment().add(10, 'minutes');

    const bots = await this.botModel.findAll({
      where: {
        status: ExecutionStatusLogEnum.PENDING,
        joinAt: {
          [Op.between]: [currentTime, nextHalfHour],
        },
      },
      order: [['createdAt', 'ASC']],
    });

    for (const bot of bots) {
      await this.initiateBot(bot.id);
    }
  }

  async getBotList(
    paginationDto: PaginationDto,
  ): Promise<{ bots: Bot[]; total: number; hasMore: boolean }> {
    const { page = 1, limit = 10 } = paginationDto;
    const offset = (page - 1) * limit;
    const bots = await this.botModel.findAll({
      offset,
      limit,
      order: [['createdAt', 'DESC']],
    });
    const total = await this.botModel.count();
    const hasMore = total > offset + limit;
    return { bots, total, hasMore };
  }

  async getBot(id: string): Promise<Bot> {
    return this.botModel.findByPk(id);
  }

  async leaveCall(botId: string): Promise<Bot> {
    const bot = await this.botModel.findByPk(botId);
    if (!bot) throw new NotFoundException('Bot not found');
    await this.ecsService.stopTask(bot.taskId);
    await bot.update({ status: ExecutionStatusLogEnum.STOPPED });
    await bot.reload();

    return bot;
  }

  identifyMeetingPlatform(meetingLink: string): BotPlatform | undefined {
    if (meetingLink.startsWith('https://meet.google.com/')) {
      return BotPlatform.GOOGLE_MEET;
    } else if (/https?:\/\/(.*?\.)?zoom\.us\/j\/\d+/.test(meetingLink)) {
      return BotPlatform.ZOOM;
    } else if (
      /https?:\/\/teams\.microsoft\.com\/l\/meetup-join\/\S+/.test(meetingLink)
    ) {
      return BotPlatform.TEAMS;
    } else {
      return undefined;
    }
  }

  async generatePresignedUrls({
    botId,
    userId,
    uuid,
    metadata,
  }: {
    botId: string;
    userId: string;
    uuid: string;
    metadata: any;
  }): Promise<{ audioUrl; tarUrl; audioObjectName; tarObjectName }> {
    const audioObjectName = `raw_recordings/${userId}/${botId}/${uuid}.opus`;
    const audioUrl = await this.awsService.generatePresignedUrlToUpload(
      audioObjectName,
      'audio/opus',
      metadata,
    );

    const tarObjectName = `raw_combined/${userId}/${botId}/${uuid}.tar`;
    const tarUrl = await this.awsService.generatePresignedUrlToUpload(
      tarObjectName,
      'application/x-tar',
      metadata,
    );

    console.log('Tar Url', tarUrl);

    return { audioUrl, tarUrl, audioObjectName, tarObjectName };
  }

  async startMeetingBotForGoogle(
    meetingLink: string,
    presignedUrls: { audioUrl: string; tarUrl: string },
    botName,
    waitingTime = 8100,
  ) {
    const taskDefinition = this.configService.get(
      'aws.ecsTaskDefinitionGoogle',
    );
    const containerName = this.configService.get('aws.ecsContainerNameGoogle');
    const command = [
      '/bin/bash',
      '-c',
      `pulseaudio --start && python app.py "${meetingLink}" --bot-name "${botName}" --presigned-url-combined "${presignedUrls.tarUrl}" --presigned-url-audio "${presignedUrls.audioUrl}"`,
      '--max-waiting-time',
      waitingTime.toString(),
    ];
    const res = await this.ecsService.runTask(
      taskDefinition,
      containerName,
      command,
    );

    if (!(res.hasOwnProperty('tasks') && res['tasks'].length > 0))
      throw new Error('Failed to start ECS task.');

    const taskArn = res['tasks'][0]['taskArn'];
    const splittedTaskArn = taskArn.split('/');
    const taskId = splittedTaskArn[splittedTaskArn.length - 1];

    return taskId;
  }

  async startMeetingBotForTeems(
    meetingLink: string,
    presignedUrls: { audioUrl: string; tarUrl: string },
    botName,
    waitingTime = 8100,
  ) {
    const taskDefinition = this.configService.get('aws.ecsTaskDefinitionTeams');
    const containerName = this.configService.get('aws.ecsContainerNameTeams');
    const command = [
      '/bin/bash',
      '-c',
      `pulseaudio --start && python app.py "${meetingLink}" --bot-name "${botName}" --presigned-url-combined "${presignedUrls.tarUrl}" --presigned-url-audio "${presignedUrls.audioUrl}"`,
      '--max-waiting-time',
      waitingTime.toString(),
    ];
    const res = await this.ecsService.runTask(
      taskDefinition,
      containerName,
      command,
    );

    if (!(res.hasOwnProperty('tasks') && res['tasks'].length > 0))
      throw new Error('Failed to start ECS task.');

    const taskArn = res['tasks'][0]['taskArn'];
    const splittedTaskArn = taskArn.split('/');
    const taskId = splittedTaskArn[splittedTaskArn.length - 1];

    return taskId;
  }

  async startMeetingBotForZoom(
    meetingLink: string,
    presignedUrls: { audioUrl: string; tarUrl: string },
    botName,
    waitingTime = 8100,
  ) {
    const taskDefinition = this.configService.get('aws.ecsTaskDefinitionZoom');
    const containerName = this.configService.get('aws.ecsContainerNameZoom');
    const command = [
      '/bin/bash',
      '-c',
      `pulseaudio --start && python app.py '${meetingLink}' --bot-name "${botName}" --presigned-url-combined "${
        presignedUrls.tarUrl
      }" --presigned-url-audio "${
        presignedUrls.audioUrl
      }" --max-waiting-time ${waitingTime.toString()}`,
    ];

    const res = await this.ecsService.runTask(
      taskDefinition,
      containerName,
      command,
    );

    if (!(res.hasOwnProperty('tasks') && res['tasks'].length > 0))
      throw new Error('Failed to start ECS task.');

    const taskArn = res['tasks'][0]['taskArn'];
    const splittedTaskArn = taskArn.split('/');
    const taskId = splittedTaskArn[splittedTaskArn.length - 1];

    return taskId;
  }

  async getTranscript(
    botId: string,
    pagination: {
      page_size: number;
      page: number;
    },
  ): Promise<
    | (FileManagementResponse & {
        transcript: TranscriptionLogResponse[];
        total: number;
        hasMore: boolean;
      })
    | object
  > {
    const bot = await this.botModel.findByPk(botId, {
      include: [{ model: ApiKey, attributes: ['userId'] }],
    });
    if (!bot) throw new NotFoundException('Bot not found');

    const fileLogs = await lastValueFrom(
      this.workerService.listFileLogs({
        botId: bot.id,
        userId: bot.apiKey.userId,
      }),
    );

    if (!(Array.isArray(fileLogs.results) && fileLogs.results.length > 0))
      return {};

    const fileLog = fileLogs.results[0];

    const transcript = await lastValueFrom(
      this.workerService.listTranscriptionLogs({
        id: fileLog.id,
        pagination,
      }),
    );

    return {
      ...fileLog,
      transcript: transcript.results,
      total: transcript.count,
      hasMore: transcript.count > pagination.page_size * pagination.page,
    };
  }

  async findBotsWithNonErrorFailures(): Promise<Bot[]> {
    const bots = await this.botModel.findAll({
      where: {
        status: { [Op.not]: ExecutionStatusLogEnum.FAILED },
        taskId: { [Op.not]: null },
        // Only get bots from the last 24 hours
        createdAt: {
          [Op.gte]: moment().subtract(24, 'hours').toDate()
        }
      },
      include: [{ model: ApiKey, attributes: ['userId'] }]
    });

    // Filter bots to only those that failed for non-error reasons
    const results = [];
    for (const bot of bots) {
      try {
        const taskInfo = await this.ecsService.healthCheckTask(bot.taskId);
        if (taskInfo?.lastStatus === 'STOPPED' && !TASK_STOPPED_ERROR_CODES.includes(taskInfo?.stopCode)) {
          results.push(bot);
        }
      } catch (error) {
        console.error(`Error checking task status for bot ${bot.id}:`, error);
      }
    }

    return results;
  }
}
