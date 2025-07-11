import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateCustomerApiKeyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}
