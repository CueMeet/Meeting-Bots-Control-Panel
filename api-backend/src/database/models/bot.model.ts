import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from 'sequelize-typescript';
import { ApiKey } from './api-key.model';

export enum BotPlatform {
  GOOGLE_MEET = 'GOOGLE_MEET',
  ZOOM = 'ZOOM',
  TEAMS = 'TEAMS',
}

export enum BotPlatformMappingType {
  GOOGLE = 0,
  MS_TEAMS = 1,
  ZOOM = 2,
}

export enum BotRecordingMode {
  SPEAKER_VIEW = 'SPEAKER_VIEW',
  GALLERY_VIEW = 'GALLERY_VIEW',
  AUDIO_ONLY = 'AUDIO_ONLY',
}

export enum ExecutionStatusLogEnum {
  PENDING = 'PENDING',
  STARTED = 'STARTED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  STOPPED = 'STOPPED',
}

@Table({
  tableName: 'bots',
  timestamps: true,
})
export class Bot extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id: string;

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
    type: DataType.DATE,
    allowNull: true,
  })
  joinAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  leaveAt: Date;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  meetingUrl: string;

  @Column({
    type: DataType.ENUM(...Object.values(BotRecordingMode)),
    allowNull: false,
    defaultValue: BotRecordingMode.AUDIO_ONLY,
  })
  recordingMode: BotRecordingMode;

  @Column({
    type: DataType.ENUM(...Object.values(BotPlatform)),
    allowNull: false,
  })
  platform: BotPlatform;

  @ForeignKey(() => ApiKey)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  apiKeyId: string;

  @BelongsTo(() => ApiKey)
  apiKey: ApiKey;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  taskId: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  retryCount: number;

  @Column({
    type: DataType.ENUM(...Object.values(ExecutionStatusLogEnum)),
    allowNull: false,
    defaultValue: ExecutionStatusLogEnum.PENDING,
  })
  status: ExecutionStatusLogEnum;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  tarFileKey: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  metaData: JSON;
}
