import {
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  CustomerBotStatus,
  CustomerBotPlatform,
} from '../../database/models/customer/customer-bot.model';

export class RecordingsListDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(CustomerBotStatus)
  status?: CustomerBotStatus;

  @IsOptional()
  @IsEnum(CustomerBotPlatform)
  platform?: CustomerBotPlatform;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(20)
  limit?: number = 10;
}
