import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Customer } from '../../database/models/customer/customer.model';

@Injectable()
export class BillingCronService {
  private readonly logger = new Logger(BillingCronService.name);

  constructor(
    @InjectModel(Customer)
    private readonly customerModel: typeof Customer,
  ) {}

  /**
   * Process monthly billing for all customers with active subscriptions
   * Runs on the 1st of every month at 2 AM
   */
  @Cron('0 2 1 * *') // 1st of every month at 2 AM
  async processMonthlyBilling() {
    this.logger.log('Starting monthly billing processing');
    // Billing logic removed
    this.logger.log('Monthly billing processing completed');
  }

  /**
   * Clean up expired usage records
   * Runs weekly on Sunday at 3 AM
   */
  @Cron('0 3 * * 0') // Weekly on Sunday at 3 AM
  async cleanupExpiredUsageRecords() {
    this.logger.log('Starting usage records cleanup');
    // Cleanup logic removed
    this.logger.log('Usage records cleanup completed');
  }
}
