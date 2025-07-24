import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from 'sequelize-typescript';
import { Customer } from './customer.model';
import { CustomerApiKey } from './customer-api-key.model';

export enum CustomerBotPlatform {
  GOOGLE_MEET = 'GOOGLE_MEET',
  ZOOM = 'ZOOM',
  TEAMS = 'TEAMS',
}

export enum CustomerBotRecordingMode {
  SPEAKER_VIEW = 'SPEAKER_VIEW',
  GALLERY_VIEW = 'GALLERY_VIEW',
  AUDIO_ONLY = 'AUDIO_ONLY',
}

export enum CustomerBotStatus {
  PENDING = 'PENDING',
  SCHEDULED = 'SCHEDULED',
  STARTING = 'STARTING',
  RECORDING = 'RECORDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  STOPPED = 'STOPPED',
  EXPIRED = 'EXPIRED',
}

export enum CustomerBotSharePermission {
  PRIVATE = 'PRIVATE',
  VIEW_ONLY = 'VIEW_ONLY',
  DOWNLOAD = 'DOWNLOAD',
  PUBLIC = 'PUBLIC',
}

@Table({
  tableName: 'customer_bots',
  timestamps: true,
})
export class CustomerBot extends Model<CustomerBot> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id: string;

  @ForeignKey(() => Customer)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  customerId: string;

  @BelongsTo(() => Customer)
  customer: Customer;

  @ForeignKey(() => CustomerApiKey)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  customerApiKeyId: string;

  @BelongsTo(() => CustomerApiKey)
  customerApiKey: CustomerApiKey;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  name: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  title: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  description: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  meetingUrl: string;

  @Column({
    type: DataType.ENUM(...Object.values(CustomerBotPlatform)),
    allowNull: false,
  })
  platform: CustomerBotPlatform;

  @Column({
    type: DataType.ENUM(...Object.values(CustomerBotRecordingMode)),
    allowNull: false,
    defaultValue: CustomerBotRecordingMode.AUDIO_ONLY,
  })
  recordingMode: CustomerBotRecordingMode;

  @Column({
    type: DataType.ENUM(...Object.values(CustomerBotStatus)),
    allowNull: false,
    defaultValue: CustomerBotStatus.PENDING,
  })
  status: CustomerBotStatus;

  // Scheduling
  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  scheduledStartAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  scheduledEndAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  actualStartedAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  actualEndedAt: Date;

  // Recording timing for billing
  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  startTime: Date; // When the bot actually started recording

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  endTime: Date; // When the bot finished recording

  // Recording Details
  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  durationSeconds: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  participantCount: number;

  @Column({
    type: DataType.ARRAY(DataType.STRING),
    defaultValue: [],
  })
  participantNames: string[];

  // File Management
  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  audioFileKey: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  videoFileKey: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  transcriptFileKey: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  tarFileKey: string;

  @Column({
    type: DataType.BIGINT,
    defaultValue: 0,
  })
  fileSizeBytes: number;

  // AWS/ECS Details
  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  taskId: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  taskArn: string;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  retryCount: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 3,
  })
  maxRetries: number;

  // Sharing & Access Control
  @Column({
    type: DataType.ENUM(...Object.values(CustomerBotSharePermission)),
    allowNull: false,
    defaultValue: CustomerBotSharePermission.PRIVATE,
  })
  sharePermission: CustomerBotSharePermission;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    unique: true,
  })
  shareToken: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  shareExpiresAt: Date;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  shareViewCount: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  downloadCount: number;

  // Auto-deletion (30-day expiration)
  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  autoDeleteAt: Date;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  isAutoDeleteEnabled: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  isDeleted: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  deletedAt: Date;

  // Billing & Usage
  @Column({
    type: DataType.DECIMAL(10, 4),
    defaultValue: 0,
  })
  recordingCost: number;

  @Column({
    type: DataType.DECIMAL(10, 4),
    defaultValue: 0,
  })
  storageCost: number;

  @Column({
    type: DataType.DECIMAL(10, 4),
    defaultValue: 0,
  })
  transcriptionCost: number;

  @Column({
    type: DataType.DECIMAL(10, 4),
    defaultValue: 0,
  })
  totalCost: number;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  billingMonth: string; // YYYY-MM format

  @Column({
    type: DataType.JSONB,
    defaultValue: {},
  })
  billingMetrics: object;

  // Quality & Performance
  @Column({
    type: DataType.DECIMAL(3, 2),
    allowNull: true,
  })
  audioQuality: number; // 0-1 scale

  @Column({
    type: DataType.DECIMAL(3, 2),
    allowNull: true,
  })
  videoQuality: number; // 0-1 scale

  @Column({
    type: DataType.DECIMAL(3, 2),
    allowNull: true,
  })
  transcriptionAccuracy: number; // 0-1 scale

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  errorCount: number;

  @Column({
    type: DataType.JSONB,
    defaultValue: [],
  })
  errorLogs: object[];

  // Metadata & Settings
  @Column({
    type: DataType.JSONB,
    defaultValue: {},
  })
  meetingMetadata: object;

  @Column({
    type: DataType.JSONB,
    defaultValue: {},
  })
  recordingSettings: object;

  @Column({
    type: DataType.JSONB,
    defaultValue: {},
  })
  customMetadata: object;

  @Column({
    type: DataType.ARRAY(DataType.STRING),
    defaultValue: [],
  })
  tags: string[];

  // Webhook & Notifications
  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  webhookUrl: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  webhookEnabled: boolean;

  @Column({
    type: DataType.JSONB,
    defaultValue: {},
  })
  webhookPayload: object;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  lastWebhookSentAt: Date;
}
