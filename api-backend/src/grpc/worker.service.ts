import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { MICROSERVICES } from 'src/constants/grpc';
import {
  FileManagementController,
  HealthCheckController,
  FileManagementListController,
  TranscriptionLogListController,
  FileManagementRequest,
  FileManagementListResponse,
  TranscriptionLogListResponse,
} from 'src/interfaces/proto-generated/transcript_management';
import { Observable } from 'rxjs';
import * as moment from 'moment';
import { Metadata } from '@grpc/grpc-js';

@Injectable()
export class WorkerService {
  private deadlineInSeconds = 20;

  private fileManagementService;
  private fileManagementListService;
  private healthCheckService;
  private transcriptionLogListService;
  constructor(
    @Inject(MICROSERVICES.TRANSCRIPT_MANAGEMENT)
    private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.fileManagementService =
      this.client.getService<FileManagementController>(
        'FileManagementController',
      );
    this.healthCheckService = this.client.getService<HealthCheckController>(
      'HealthCheckController',
    );
    this.fileManagementListService =
      this.client.getService<FileManagementListController>(
        'FileManagementListController',
      );
    this.transcriptionLogListService =
      this.client.getService<TranscriptionLogListController>(
        'TranscriptionLogListController',
      );
  }

  healthCheck(): Observable<any> {
    const deadline = moment()
      .utc()
      .add(this.deadlineInSeconds, 'seconds')
      .toDate();

    return this.healthCheckService.healthCheck({}, { deadline });
  }

  createFileLog(payload: FileManagementRequest): Observable<any> {
    const deadline = moment()
      .utc()
      .add(this.deadlineInSeconds, 'seconds')
      .toDate();

    return this.fileManagementService.Create(payload, { deadline });
  }

  listFileLogs(payload: any): Observable<FileManagementListResponse> {
    const deadline = moment()
      .utc()
      .add(this.deadlineInSeconds, 'seconds')
      .toDate();

    const metadata = new Metadata();

    payload?.id && metadata.set('id', payload.id);
    payload?.botId && metadata.set('execution_id', payload.botId);
    payload?.userId && metadata.set('created_by_user_id', payload.userId);
    payload?.status && metadata.set('status', payload.status);
    payload?.processStartedAt &&
      metadata.set('process_started_at', payload.processStartedAt);

    return this.fileManagementListService.List(payload, metadata, {
      deadline,
    });
  }

  listTranscriptionLogs(
    payload: any,
  ): Observable<TranscriptionLogListResponse> {
    const deadline = moment()
      .utc()
      .add(this.deadlineInSeconds, 'seconds')
      .toDate();

    const metadata = new Metadata();

    payload?.id && metadata.set('file_log_id', payload.id);
    payload?.pagination &&
      metadata.set('pagination', JSON.stringify(payload.pagination));

    return this.transcriptionLogListService.List(payload, metadata, {
      deadline,
    });
  }
}
