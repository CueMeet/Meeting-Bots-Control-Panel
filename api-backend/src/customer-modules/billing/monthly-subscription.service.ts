import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Customer } from '../../database/models/customer/customer.model';
import { LavaPaymentsService } from './lavapayments.service';
import { Op } from 'sequelize';
import {
  CustomerPayment,
  CustomerPaymentType,
  CustomerPaymentStatus,
} from '../../database/models/customer/customer-payment.model';

@Injectable()
export class MonthlySubscriptionService {
  private readonly logger = new Logger(MonthlySubscriptionService.name);

  constructor(
    @InjectModel(Customer)
    private readonly customerModel: typeof Customer,
    @InjectModel(CustomerPayment)
    private readonly customerPaymentModel: typeof CustomerPayment,
    private readonly lavaPaymentsService: LavaPaymentsService,
  ) {}

  /**
   * Process monthly base fee for all active customers
   * This method should be called by a cron job on the 1st of each month
   */
  async processMonthlyBaseFees(): Promise<void> {
    this.logger.log('Starting monthly base fee processing');

    try {
      // Get all active customers with Lava connection
      const activeCustomers = await this.customerModel.findAll({
        where: {
          billingStatus: 'active',
          lavaConnectionId: { [Op.ne]: null },
          lavaConnectionSecret: { [Op.ne]: null },
        },
      });

      this.logger.log(
        `Found ${activeCustomers.length} active customers for base fee processing`,
      );

      const results = {
        total: activeCustomers.length,
        successful: 0,
        failed: 0,
        errors: [] as string[],
      };

      // Process each customer
      for (const customer of activeCustomers) {
        try {
          const success = await this.lavaPaymentsService.chargeMonthlyBaseFee(
            customer.id,
          );

          if (success) {
            results.successful++;
            this.logger.log(
              `Successfully charged base fee for customer ${customer.id}`,
            );
            // Create a CustomerPayment record for this base fee
            try {
              // You may want to get the actual amount from config or LavaPayments response
              const baseFeeAmount =
                parseFloat(process.env.RECORDING_COST_PER_MINUTE || '0.4') *
                100; // Example: $40 base fee for 100 minutes
              await this.customerPaymentModel.create({
                customerId: customer.id,
                type: CustomerPaymentType.BASE_FEE,
                amount: baseFeeAmount,
                currency: 'USD',
                periodKey: new Date().toISOString().substring(0, 7),
                description: `Monthly base fee for ${new Date().toISOString().substring(0, 7)}`,
                status: CustomerPaymentStatus.PAID,
                externalPaymentId: null, // If you have a payment ID from LavaPayments, use it
                metadata: {
                  baseFee: true,
                  chargedAt: new Date().toISOString(),
                },
              });
            } catch (err) {
              this.logger.error(
                'Failed to create CustomerPayment record for base fee:',
                err,
              );
              // Immediately cancel the subscription if payment record creation fails
              try {
                await customer.update({ billingStatus: 'cancelled' });
                this.logger.error(
                  `Customer ${customer.id} subscription cancelled due to payment failure.`,
                );
              } catch (cancelErr) {
                this.logger.error(
                  'Failed to cancel customer subscription after payment failure:',
                  cancelErr,
                );
              }
            }
          } else {
            results.failed++;
            results.errors.push(
              `Failed to charge base fee for customer ${customer.id}`,
            );
            this.logger.warn(
              `Failed to charge base fee for customer ${customer.id}`,
            );
          }
        } catch (error) {
          results.failed++;
          const errorMsg = `Error charging base fee for customer ${customer.id}: ${error.message}`;
          results.errors.push(errorMsg);
          this.logger.error(errorMsg, error.stack);
        }
      }

      this.logger.log('Monthly base fee processing completed', results);
    } catch (error) {
      this.logger.error('Error in monthly base fee processing', error.stack);
      throw error;
    }
  }

  /**
   * Check if a customer has already been charged for the current month
   */
  async hasCustomerBeenChargedThisMonth(customerId: string): Promise<boolean> {
    const now = new Date();
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Check if there's a usage record for this month with base fee charged
    const usageRecord = await this.lavaPaymentsService[
      'customerUsageModel'
    ].findOne({
      where: {
        customerId,
        periodKey: monthYear,
        billingMetadata: {
          base_fee_charged: true,
        },
      },
    });

    return !!usageRecord;
  }

  /**
   * Get customers who haven't been charged this month
   */
  async getCustomersNotChargedThisMonth(): Promise<Customer[]> {
    // const now = new Date();
    // const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get all active customers
    const activeCustomers = await this.customerModel.findAll({
      where: {
        billingStatus: 'active',
        lavaConnectionId: { [Op.ne]: null },
        lavaConnectionSecret: { [Op.ne]: null },
      },
    });

    // Filter out customers who have already been charged this month
    const customersNotCharged = [];

    for (const customer of activeCustomers) {
      const alreadyCharged = await this.hasCustomerBeenChargedThisMonth(
        customer.id,
      );
      if (!alreadyCharged) {
        customersNotCharged.push(customer);
      }
    }

    return customersNotCharged;
  }
}
