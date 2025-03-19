import {
  IsString,
  IsOptional,
  IsDateString,
  IsObject,
  MaxLength,
} from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  userId: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: Date;

  @IsOptional()
  @IsObject()
  permissions?: Record<string, string[]>;
}
