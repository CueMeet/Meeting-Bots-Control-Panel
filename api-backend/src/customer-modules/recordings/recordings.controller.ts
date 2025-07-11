import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RecordingsService } from './recordings.service';
import { CustomerAuthGuard } from '../../guards/customer-auth.guard';
import { GetCustomer } from '../../decorators/get-customer.decorator';
import { Customer } from '../../database/models/customer/customer.model';
import { StartRecordingDto } from '../../dto/customer/start-recording.dto';
import { RecordingsListDto } from '../../dto/customer/recordings-list.dto';

@Controller('customer/recordings')
@UseGuards(CustomerAuthGuard)
export class RecordingsController {
  constructor(private readonly recordingsService: RecordingsService) {}

  /**
   * Start new recording (simplified API for customer portal)
   */
  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  async startNewRecording(
    @GetCustomer() customer: Customer,
    @Body() startDto: StartRecordingDto,
  ) {
    const recording = await this.recordingsService.startNewRecording(
      customer.id,
      startDto,
    );

    return {
      success: true,
      message: 'Recording started successfully',
      data: {
        id: recording.id,
        name: recording.name,
        meetingUrl: recording.meetingUrl,
        platform: recording.platform,
        status: recording.status,
        taskId: recording.taskId,
        createdAt: recording.createdAt,
      },
    };
  }

  /**
   * Get recordings list
   */
  @Get()
  async getRecordings(
    @GetCustomer() customer: Customer,
    @Query() filters: RecordingsListDto,
  ) {
    const result = await this.recordingsService.getRecordings(
      customer.id,
      filters,
    );

    return {
      success: true,
      message: 'Recordings retrieved successfully',
      data: {
        recordings: result.recordings,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      },
    };
  }

  /**
   * Get single recording
   */
  @Get(':id')
  async getRecording(
    @GetCustomer() customer: Customer,
    @Param('id') recordingId: string,
  ) {
    const recording = await this.recordingsService.getRecording(
      customer.id,
      recordingId,
    );

    return {
      success: true,
      data: recording,
    };
  }

  /**
   * Stop recording
   */
  @Post(':id/stop')
  @HttpCode(HttpStatus.OK)
  async stopRecording(
    @GetCustomer() customer: Customer,
    @Param('id') recordingId: string,
  ) {
    const recording = await this.recordingsService.stopRecording(
      customer.id,
      recordingId,
    );

    return {
      success: true,
      message: 'Recording stopped successfully',
      data: recording,
    };
  }

  /**
   * Delete recording
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteRecording(
    @GetCustomer() customer: Customer,
    @Param('id') recordingId: string,
  ) {
    await this.recordingsService.deleteRecording(customer.id, recordingId);

    return {
      success: true,
      message: 'Recording deleted successfully',
    };
  }

  /**
   * Get recording transcript
   */
  @Get(':id/transcript')
  async getRecordingTranscript(
    @GetCustomer() customer: Customer,
    @Param('id') recordingId: string,
  ) {
    const transcript = await this.recordingsService.getRecordingTranscript(
      customer.id,
      recordingId,
    );

    return {
      success: true,
      data: transcript,
    };
  }

  /**
   * Download recording
   */
  @Get(':id/download')
  async downloadRecording(
    @GetCustomer() customer: Customer,
    @Param('id') recordingId: string,
    @Query('type') fileType?: string,
  ) {
    const downloadInfo = await this.recordingsService.downloadRecording(
      customer.id,
      recordingId,
      fileType,
    );

    return {
      success: true,
      data: downloadInfo,
    };
  }
}
