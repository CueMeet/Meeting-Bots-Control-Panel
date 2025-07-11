import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class StartRecordingDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  meetingUrl: string;

  @IsString()
  @IsOptional()
  recordingName?: string;
}
