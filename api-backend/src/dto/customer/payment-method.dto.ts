import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreatePaymentMethodDto {
  @IsString()
  type: string; // 'card', 'bank_account', etc.

  @IsObject()
  @IsOptional()
  card?: {
    number: string;
    exp_month: number;
    exp_year: number;
    cvc: string;
  };

  @IsObject()
  @IsOptional()
  bank_account?: {
    account_number: string;
    routing_number: string;
    account_holder_name: string;
    account_holder_type: 'individual' | 'company';
  };

  @IsString()
  @IsOptional()
  billing_details?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
  };
} 