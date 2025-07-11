import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import {
  CustomerBot,
  CustomerBotStatus,
  CustomerBotPlatform,
  CustomerBotRecordingMode,
} from '../../database/models/customer/customer-bot.model';
import {
  CustomerApiKey,
  CustomerApiKeyStatus,
} from '../../database/models/customer/customer-api-key.model';
import { BotService } from '../../bot/bot.service';
import { CreateBotDto } from '../../dto/bot/create-bot.dto';
import { StartRecordingDto } from '../../dto/customer/start-recording.dto';
import { RecordingsListDto } from '../../dto/customer/recordings-list.dto';
import { BotRecordingMode } from '../../database/models/bot.model';
import { ApiKey } from '../../database/models/api-key.model';

export interface CreateRecordingDto {
  name: string;
  meetingUrl: string;
  title?: string;
  description?: string;
  scheduledStartAt?: Date;
  scheduledEndAt?: Date;
  recordingMode?: string;
  webhookUrl?: string;
  tags?: string[];
}

export interface RecordingListFilters {
  search?: string;
  status?: CustomerBotStatus;
  platform?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

export interface UsageAnalytics {
  usage: {
    hoursThisMonth: number;
    totalHours: number;
    activeRecordings: number;
    storageUsed: number;
  };
  billing: {
    recordingHours: number;
    storage: number;
    apiCalls: number;
    total: number;
  };
}

@Injectable()
export class RecordingsService {
  constructor(
    @InjectModel(CustomerBot)
    private readonly customerBotModel: typeof CustomerBot,
    @InjectModel(CustomerApiKey)
    private readonly customerApiKeyModel: typeof CustomerApiKey,
    private readonly botService: BotService,
  ) {}

  /**
   * Start a new recording using BotService
   */
  async startNewRecording(customerId: string, startDto: StartRecordingDto) {
    try {
      // Get the customer's first active API key
      const customerApiKey = await this.customerApiKeyModel.findOne({
        where: { customerId, status: CustomerApiKeyStatus.ACTIVE },
      });

      if (!customerApiKey) {
        throw new BadRequestException('No active API key found for customer');
      }

      // Create a bot using the BotService
      const createBotDto = {
        name: startDto.recordingName || `Recording_${new Date().toISOString()}`,
        meetingUrl: startDto.meetingUrl,
        title:
          startDto.recordingName || `Recording_${new Date().toISOString()}`,
        recordingMode: BotRecordingMode.AUDIO_ONLY, // Default to audio only for customer recordings
      } as CreateBotDto;

      // Create a mock API key object that matches the structure expected by BotService
      const mockApiKey = {
        id: customerApiKey.apiKeyId,
        userId: customerId, // Use customerId as userId for the bot service
        key: customerApiKey.key,
        name: customerApiKey.name,
        isActive: customerApiKey.status === CustomerApiKeyStatus.ACTIVE,
        expiresAt: null,
        permissions: {},
        lastUsedAt: new Date(),
        user: null,
        createdAt: customerApiKey.createdAt,
        updatedAt: customerApiKey.updatedAt,
      } as ApiKey;

      // Use the BotService to create and initiate the bot
      const bot = await this.botService.createBot(createBotDto, mockApiKey);

      // Create a customer bot record to track this recording
      const customerBot = await this.customerBotModel.create({
        customerId,
        customerApiKeyId: customerApiKey.id,
        name: bot.name,
        title: bot.title,
        meetingUrl: bot.meetingUrl,
        platform: this.mapBotPlatformToCustomerPlatform(bot.platform),
        recordingMode: this.mapBotRecordingModeToCustomerMode(
          bot.recordingMode,
        ),
        status: this.mapBotStatusToCustomerStatus(bot.status),
        taskId: bot.taskId,
        tarFileKey: bot.tarFileKey,
        autoDeleteAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        isAutoDeleteEnabled: true,
        // Link to the original bot record
        customMetadata: {
          originalBotId: bot.id,
        },
      });

      // Update the customer API key last used timestamp
      await customerApiKey.update({
        lastUsedAt: new Date(),
      });

      return customerBot;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to start recording: ${error.message}`,
      );
    }
  }

  /**
   * Get recordings list with filters
   */
  async getRecordings(customerId: string, filters: RecordingsListDto = {}) {
    try {
      const {
        search,
        status,
        platform,
        dateFrom,
        dateTo,
        page = 1,
        limit = 10,
      } = filters;

      const whereClause: any = {
        customerId,
        isDeleted: false, // Exclude deleted recordings
      };

      if (search) {
        whereClause.name = { [Op.iLike]: `%${search}%` };
      }

      if (status) {
        whereClause.status = status;
      }

      if (platform) {
        whereClause.platform = platform;
      }

      if (dateFrom || dateTo) {
        whereClause.createdAt = {};
        if (dateFrom) whereClause.createdAt[Op.gte] = new Date(dateFrom);
        if (dateTo) whereClause.createdAt[Op.lte] = new Date(dateTo);
      }

      const offset = (page - 1) * limit;

      const { rows: recordings, count: total } =
        await this.customerBotModel.findAndCountAll({
          where: whereClause,
          order: [['createdAt', 'DESC']],
          limit,
          offset,
          attributes: [
            'id',
            'name',
            'title',
            'description',
            'meetingUrl',
            'platform',
            'recordingMode',
            'status',
            'scheduledStartAt',
            'scheduledEndAt',
            'actualStartedAt',
            'actualEndedAt',
            'durationSeconds',
            'participantCount',
            'fileSizeBytes',
            'transcriptionAccuracy',
            'createdAt',
            'updatedAt',
          ],
        });

      return {
        recordings,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to get recordings: ${error.message}`,
      );
    }
  }

  /**
   * Get single recording by ID
   */
  async getRecording(customerId: string, recordingId: string) {
    try {
      const recording = await this.customerBotModel.findOne({
        where: { id: recordingId, customerId },
      });

      if (!recording) {
        throw new NotFoundException('Recording not found');
      }

      return recording;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to get recording: ${error.message}`,
      );
    }
  }

  /**
   * Stop a recording
   */
  async stopRecording(customerId: string, recordingId: string) {
    try {
      const recording = await this.getRecording(customerId, recordingId);

      if (!recording.status) {
        throw new BadRequestException('Recording is not active');
      }

      await recording.update({
        status: CustomerBotStatus.STOPPED,
        actualEndedAt: new Date(),
      });

      // TODO: Implement actual bot stopping logic

      // Track usage for billing if recording has duration
      if (recording.durationSeconds && recording.durationSeconds > 0) {
        // const durationMinutes = Math.ceil(recording.durationSeconds / 60);
        // await this.billingService.trackRecordingUsage(
        //   customerId,
        //   recordingId,
        //   durationMinutes,
        // );
      }

      return recording;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to stop recording: ${error.message}`,
      );
    }
  }

  /**
   * Delete a recording
   */
  async deleteRecording(customerId: string, recordingId: string) {
    try {
      const recording = await this.getRecording(customerId, recordingId);

      await recording.update({
        isDeleted: true,
        deletedAt: new Date(),
      });

      // TODO: Implement actual file deletion from S3

      return { success: true };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to delete recording: ${error.message}`,
      );
    }
  }

  /**
   * Get recording transcript
   */
  async getRecordingTranscript(customerId: string, recordingId: string) {
    try {
      const recording = await this.getRecording(customerId, recordingId);

      if (!recording.transcriptFileKey) {
        throw new BadRequestException('Transcript not available');
      }

      // TODO: Implement transcript retrieval from worker service

      return {
        recordingId,
        transcript: [],
        totalSegments: 0,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to get recording transcript: ${error.message}`,
      );
    }
  }

  /**
   * Download recording files
   */
  async downloadRecording(
    customerId: string,
    recordingId: string,
    fileType = 'audio',
  ) {
    try {
      const recording = await this.getRecording(customerId, recordingId);

      if (!recording.status) {
        throw new BadRequestException('Recording is not completed');
      }

      let fileKey: string;
      switch (fileType) {
        case 'audio':
          fileKey = recording.audioFileKey;
          break;
        case 'video':
          fileKey = recording.videoFileKey;
          break;
        case 'transcript':
          fileKey = recording.transcriptFileKey;
          break;
        default:
          throw new BadRequestException('Invalid file type');
      }

      if (!fileKey) {
        throw new BadRequestException(`${fileType} file not available`);
      }

      // TODO: Generate presigned download URL

      return {
        downloadUrl: `https://example.com/download/${fileKey}`,
        expiresIn: 3600, // 1 hour
        fileType,
        fileName: `${recording.name}_${fileType}`,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to download recording: ${error.message}`,
      );
    }
  }

  /**
   * Map BotPlatform to CustomerBotPlatform
   */
  private mapBotPlatformToCustomerPlatform(
    botPlatform: string,
  ): CustomerBotPlatform {
    switch (botPlatform) {
      case 'GOOGLE_MEET':
        return CustomerBotPlatform.GOOGLE_MEET;
      case 'ZOOM':
        return CustomerBotPlatform.ZOOM;
      case 'TEAMS':
        return CustomerBotPlatform.TEAMS;
      default:
        return CustomerBotPlatform.GOOGLE_MEET;
    }
  }

  /**
   * Map BotRecordingMode to CustomerBotRecordingMode
   */
  private mapBotRecordingModeToCustomerMode(
    botMode: string,
  ): CustomerBotRecordingMode {
    switch (botMode) {
      case 'SPEAKER_VIEW':
        return CustomerBotRecordingMode.SPEAKER_VIEW;
      case 'GALLERY_VIEW':
        return CustomerBotRecordingMode.GALLERY_VIEW;
      case 'AUDIO_ONLY':
      default:
        return CustomerBotRecordingMode.AUDIO_ONLY;
    }
  }

  /**
   * Map Bot status to CustomerBotStatus
   */
  private mapBotStatusToCustomerStatus(botStatus: string): CustomerBotStatus {
    switch (botStatus) {
      case 'PENDING':
        return CustomerBotStatus.PENDING;
      case 'STARTED':
        return CustomerBotStatus.RECORDING;
      case 'COMPLETED':
        return CustomerBotStatus.COMPLETED;
      case 'FAILED':
        return CustomerBotStatus.FAILED;
      case 'STOPPED':
        return CustomerBotStatus.STOPPED;
      default:
        return CustomerBotStatus.PENDING;
    }
  }
}
