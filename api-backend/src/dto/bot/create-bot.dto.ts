import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { BotRecordingMode } from 'src/database/models/bot.model';
export class CreateBotDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  meetingUrl: string;

  @IsString()
  @IsOptional()
  title: string;

  @IsString()
  @IsOptional()
  recordingMode: BotRecordingMode;

  @IsString()
  @IsOptional()
  joinAt: Date;

  @IsString()
  @IsOptional()
  leaveAt: Date;

  @IsString()
  @IsOptional()
  metaData: JSON;
}
