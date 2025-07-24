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
import {
  BotRecordingMode,
  ExecutionStatusLogEnum,
} from '../../database/models/bot.model';
import { ApiKey } from '../../database/models/api-key.model';
import { LavaPaymentsService } from '../billing/lavapayments.service';
import {
  CustomerPayment,
  CustomerPaymentType,
  CustomerPaymentStatus,
} from '../../database/models/customer/customer-payment.model';
import { ConfigService } from '@nestjs/config';

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
    @InjectModel(CustomerPayment)
    private readonly customerPaymentModel: typeof CustomerPayment,
    private readonly botService: BotService,
    private readonly lavaPaymentsService: LavaPaymentsService,
    private readonly configService: ConfigService,
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

      // Check if the customer's billing status is active
      const customer = await customerApiKey.$get('customer');
      if (!customer || customer.billingStatus !== 'active') {
        throw new BadRequestException(
          'Billing is not active. Please check your subscription status.',
        );
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
        startTime: new Date(), // Set start time when recording is initiated
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

  /**
   * Internal method to charge usage fee for completed recordings
   * This is called internally when a recording session ends
   * Uses the usageProductSecret from configuration for $0.40/minute billing
   */
  async chargeUsageForRecording(recordingId: string): Promise<boolean> {
    try {
      const recording = await this.customerBotModel.findByPk(recordingId);

      if (!recording) {
        console.error(`Recording ${recordingId} not found for usage charging`);
        return false;
      }

      // Check if recording has start and end times
      if (!recording.startTime || !recording.endTime) {
        console.error(`Recording ${recordingId} missing start or end time`);
        return false;
      }

      // Calculate recording duration in minutes
      const durationMs =
        recording.endTime.getTime() - recording.startTime.getTime();
      const durationMinutes = Math.ceil(durationMs / (1000 * 60)); // Convert to minutes and round up

      if (durationMinutes <= 0) {
        console.log(
          `Recording ${recordingId} has no duration, skipping usage charge`,
        );
        return true; // Not an error, just no charge needed
      }

      // Get the customer for billing
      const customer = await recording.$get('customer');
      if (!customer) {
        console.error(`Customer not found for recording ${recordingId}`);
        return false;
      }

      // Check if customer has active billing
      if (
        !customer.lavaConnectionSecret ||
        customer.billingStatus !== 'active'
      ) {
        console.error(
          `Customer ${customer.id} not eligible for usage charge: no connection or inactive`,
        );
        return false;
      }

      // Generate unique request ID for idempotency
      const requestId = `${recordingId}_usage_${Date.now()}`;

      // Get usage product secret from configuration
      const usageProductSecret = this.lavaPaymentsService['configService'].get(
        'lavapayments.usageProductSecret',
      );

      // Get per-minute rate from config
      const ratePerMinute =
        this.lavaPaymentsService['configService'].get(
          'recording.costPerMinute',
        ) ?? 0.4;
      const totalCost = durationMinutes * ratePerMinute;

      // Create usage request using LavaPayments SDK
      const request = await this.lavaPaymentsService['lava'].requests.create({
        request_id: requestId,
        connection_secret: customer.lavaConnectionSecret,
        product_secret: usageProductSecret,
        metadata: {
          customer_id: customer.id,
          recording_id: recordingId,
          charge_type: 'recording_usage',
          recording_name: recording.name,
          duration_minutes: durationMinutes.toString(),
          platform: recording.platform,
        },
        // Use seconds as the usage metric (convert minutes to seconds)
        input_seconds: durationMinutes * 60,
        output_seconds: 0,
        input_tokens: 0,
        output_tokens: 0,
        input_characters: 0,
        output_characters: 0,
      });

      console.log(
        `Successfully charged usage fee for recording ${recordingId}: ${durationMinutes} minutes`,
        request,
      );

      // Update recording with billing information
      await recording.update({
        recordingCost: totalCost,
        totalCost,
        billingMonth: new Date().toISOString().substring(0, 7), // YYYY-MM format
        billingMetrics: {
          durationMinutes,
          ratePerMinute,
          totalCost,
          chargedAt: new Date().toISOString(),
          lavaRequestId: requestId,
        },
      });

      // Create a CustomerPayment record for this usage charge
      try {
        await this.customerPaymentModel.create({
          customerId: customer.id,
          type: CustomerPaymentType.USAGE,
          amount: totalCost,
          currency: 'USD',
          periodKey: new Date().toISOString().substring(0, 7),
          description: `Recording usage charge for recording ${recordingId}`,
          status: CustomerPaymentStatus.PAID,
          externalPaymentId: request?.request_id || null,
          metadata: {
            recordingId,
            durationMinutes,
            ratePerMinute,
            lavaRequestId: requestId,
          },
        });
      } catch (err) {
        console.error(
          'Failed to create CustomerPayment record for usage:',
          err,
        );
        // Immediately cancel the subscription if payment record creation fails
        try {
          await customer.update({ billingStatus: 'cancelled' });
          console.error(
            `Customer ${customer.id} subscription cancelled due to payment failure.`,
          );
        } catch (cancelErr) {
          console.error(
            'Failed to cancel customer subscription after payment failure:',
            cancelErr,
          );
        }
      }

      return true;
    } catch (error) {
      console.error(
        `Error charging usage fee for recording ${recordingId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Get all running customer bots that need status checking
   */
  async getRunningCustomerBots(): Promise<CustomerBot[]> {
    try {
      const runningBots = await this.customerBotModel.findAll({
        where: {
          status: [
            CustomerBotStatus.PENDING,
            CustomerBotStatus.STARTING,
            CustomerBotStatus.RECORDING,
          ],
          taskId: { [Op.ne]: null },
          isDeleted: false,
        },
        include: [
          {
            model: CustomerApiKey,
            as: 'customerApiKey',
            where: { status: CustomerApiKeyStatus.ACTIVE },
          },
        ],
      });

      return runningBots;
    } catch (error) {
      console.error('Error getting running customer bots:', error);
      return [];
    }
  }

  /**
   * Update customer bot status based on bot service status
   */
  async updateCustomerBotStatus(
    customerBotId: string,
    botStatus: string,
    endTime?: Date,
  ): Promise<boolean> {
    try {
      const customerBot = await this.customerBotModel.findByPk(customerBotId);
      if (!customerBot) {
        console.error(`Customer bot ${customerBotId} not found`);
        return false;
      }

      const updateData: any = {};

      // Map bot status to customer bot status
      switch (botStatus) {
        case 'COMPLETED':
          updateData.status = CustomerBotStatus.COMPLETED;
          updateData.actualEndedAt = endTime || new Date();
          updateData.endTime = endTime || new Date();
          break;
        case 'FAILED':
          updateData.status = CustomerBotStatus.FAILED;
          updateData.actualEndedAt = endTime || new Date();
          updateData.endTime = endTime || new Date();
          break;
        case 'STOPPED':
          updateData.status = CustomerBotStatus.STOPPED;
          updateData.actualEndedAt = endTime || new Date();
          updateData.endTime = endTime || new Date();
          break;
        case 'STARTED':
          updateData.status = CustomerBotStatus.RECORDING;
          if (!customerBot.actualStartedAt) {
            updateData.actualStartedAt = new Date();
          }
          break;
        default:
          // No update needed for other statuses
          return true;
      }

      await customerBot.update(updateData);

      // If bot is completed, charge usage
      if (botStatus === ExecutionStatusLogEnum.COMPLETED) {
        await this.chargeUsageForRecording(customerBotId);
      }

      console.log(
        `Updated customer bot ${customerBotId} status to ${botStatus}`,
      );
      return true;
    } catch (error) {
      console.error(
        `Error updating customer bot ${customerBotId} status:`,
        error,
      );
      return false;
    }
  }
}
