import { IsOptional, IsString, IsEnum } from 'class-validator';

export enum SubscriptionPlan {
  BASIC = 'basic-plan',
  PRO = 'pro-plan',
  ENTERPRISE = 'enterprise-plan',
}

export class CreateSubscriptionDto {
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  planId?: SubscriptionPlan;
} 