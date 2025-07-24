import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Lava } from '@lavapayments/nodejs';
import { CustomerBotStatus } from '../../database/models/customer/customer-bot.model';
import { InjectModel } from '@nestjs/sequelize';
import {
  CustomerUsage,
  CustomerUsagePeriod,
  CustomerBillingStatus,
} from '../../database/models/customer/customer-usage.model';
import { CustomerBot } from '../../database/models/customer/customer-bot.model';
import { Customer } from '../../database/models/customer/customer.model';
import {
  CustomerPayment,
  CustomerPaymentType,
} from '../../database/models/customer/customer-payment.model';

/**
 * LavaPayments Service for handling billing operations
 *
 * This service provides two main billing approaches:
 * 1. Base Fee: $20/month fixed charge (automated via cron job)
 * 2. Usage Fee: $0.40/minute for actual recording time (charged per session)
 *
 * The service uses the @lavapayments/nodejs SDK for all API interactions.
 */
@Injectable()
export class LavaPaymentsService {
  private readonly lava: Lava;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(CustomerUsage)
    private readonly customerUsageModel: typeof CustomerUsage,
    @InjectModel(CustomerBot)
    private readonly customerBotModel: typeof CustomerBot,
    @InjectModel(Customer)
    private readonly customerModel: typeof Customer,
    @InjectModel(CustomerPayment)
    private readonly customerPaymentModel: typeof CustomerPayment,
  ) {
    this.lava = new Lava(this.configService.get('lavapayments.secretKey'), {
      apiVersion: '2025-04-28.v1',
    });
  }

  async createCheckoutSession(data: {
    checkout_mode: 'onboarding' | 'topup';
    origin_url: string;
    reference_id?: string;
    connection_id?: string;
  }) {
    try {
      const session = await this.lava.checkoutSessions.create(data);
      return session;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(
        'Failed to create checkout session',
      );
    }
  }

  /**
   * Retrieve and store the connection secret for a given connectionId
   */
  async retrieveAndStoreConnectionSecret(
    customerId: string,
    connectionId: string,
  ) {
    try {
      const connection = await this.lava.connections.retrieve(connectionId);
      const connectionSecret = connection.connection_secret;
      console.log('Connection secret', connectionSecret);

      if (connectionSecret) {
        // Store in customer model
        await this.customerModel.update(
          {
            lavaConnectionSecret: connectionSecret,
            lavaConnectionId: connectionId,
            billingStatus: 'active',
          },
          { where: { id: customerId } },
        );
      }
      return connectionSecret;
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to retrieve connection secret',
      );
    }
  }

  /**
   * Generate a forward token for Lava API requests
   * This is used for forwarding requests to AI services with usage tracking
   */
  generateForwardToken(connectionSecret: string, productSecret?: string) {
    const productSecretValue =
      productSecret || this.configService.get('lavapayments.productSecret');
    return this.lava.generateForwardToken({
      connection_secret: connectionSecret,
      product_secret: productSecretValue,
    });
  }

  /**
   * Create a usage-based request using LavaPayments SDK
   * This is used for tracking actual usage (tokens, characters, seconds, etc.)
   */
  async createUsageRequest(data: {
    requestId: string;
    connectionSecret: string;
    productSecret: string;
    metadata?: Record<string, string>;
    inputTokens?: number;
    outputTokens?: number;
    inputCharacters?: number;
    outputCharacters?: number;
    inputSeconds?: number;
    outputSeconds?: number;
  }) {
    try {
      const request = await this.lava.requests.create({
        request_id: data.requestId,
        connection_secret: data.connectionSecret,
        product_secret: data.productSecret,
        metadata: data.metadata || {},
        input_tokens: data.inputTokens || 0,
        output_tokens: data.outputTokens || 0,
        input_characters: data.inputCharacters || 0,
        output_characters: data.outputCharacters || 0,
        input_seconds: data.inputSeconds || 0,
        output_seconds: data.outputSeconds || 0,
      });

      return request;
    } catch (error) {
      console.error('Failed to create usage request:', error);
      throw new InternalServerErrorException('Failed to create usage request');
    }
  }

  /**
   * Get usage analytics for a customer
   */
  async getUsageAnalytics(customerId: string) {
    // Get current month (YYYY-MM)
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Calculate hours from completed CustomerBot records for this month
    const botsThisMonth = await this.customerBotModel.findAll({
      where: {
        customerId,
        status: CustomerBotStatus.COMPLETED,
        startTime: { $ne: null },
        endTime: { $ne: null },
      },
    });
    const hoursThisMonth = botsThisMonth
      .filter((bot) => {
        const end = bot.endTime;
        if (!end) return false;
        const endMonth = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`;
        return endMonth === monthKey;
      })
      .reduce((sum, bot) => {
        const start = bot.startTime;
        const end = bot.endTime;
        if (!start || !end) return sum;
        const durationHours =
          (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        return sum + (durationHours > 0 ? durationHours : 0);
      }, 0);

    // Calculate all-time hours from completed CustomerBot records
    const allCompletedBots = await this.customerBotModel.findAll({
      where: {
        customerId,
        status: CustomerBotStatus.COMPLETED,
        startTime: { $ne: null },
        endTime: { $ne: null },
      },
    });
    const totalHours = allCompletedBots.reduce((sum, bot) => {
      const start = bot.startTime;
      const end = bot.endTime;
      if (!start || !end) return sum;
      const durationHours =
        (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      return sum + (durationHours > 0 ? durationHours : 0);
    }, 0);

    // Get all payments for the customer
    const allPayments = await this.customerPaymentModel.findAll({
      where: { customerId },
    });
    // For current month
    const paymentsThisMonth = allPayments.filter(
      (p) => p.periodKey === monthKey,
    );
    const usagePaymentsThisMonth = paymentsThisMonth.filter(
      (p) => p.type === CustomerPaymentType.USAGE,
    );
    const costThisMonth = paymentsThisMonth.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    // For all time
    // (no longer needed: allUsagePayments, ratePerMinute for hours)

    // Get active recordings count
    const activeRecordings = await this.customerBotModel.count({
      where: {
        customerId,
        status: [
          CustomerBotStatus.PENDING,
          CustomerBotStatus.SCHEDULED,
          CustomerBotStatus.STARTING,
          CustomerBotStatus.RECORDING,
        ],
      },
    });

    // Storage and API Calls are 0 for now
    const storageUsed = 0;
    // const apiCalls = 0;

    // Recording cost and base fee for this month
    const usageCost = usagePaymentsThisMonth.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const baseFeePayments = paymentsThisMonth.filter(
      (p) => p.type === CustomerPaymentType.BASE_FEE,
    );
    const baseFee = baseFeePayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const storageCost = 0; // Placeholder
    const apiCallsCost = 0; // Placeholder
    const totalCost = costThisMonth;

    // Get customer billing information
    const customer = await this.customerModel.findByPk(customerId);
    let billingStatus = 'inactive';
    let walletBalance = null;
    let connectionInfo = null;

    if (
      customer &&
      customer.lavaConnectionId &&
      customer.lavaConnectionSecret
    ) {
      billingStatus = customer.billingStatus || 'active';

      try {
        // Retrieve connection information from LavaPayments
        const connection = await this.lava.connections.retrieve(
          customer.lavaConnectionId,
        );

        // Extract only public information, exclude sensitive data
        connectionInfo = {
          connection_id: connection.connection_id,
          wallet: connection.wallet
            ? {
                balance: connection.wallet.balance,
                phone: connection.wallet.phone,
                email: connection.wallet.email,
                first_name: connection.wallet.first_name,
                last_name: connection.wallet.last_name,
              }
            : null,
          next_usage_reset: connection.next_usage_reset,
          previous_usage_reset: connection.previous_usage_reset,
          created_at: connection.created_at,
        };

        walletBalance = connection.wallet?.balance || null;
      } catch (error) {
        console.error(
          `Failed to retrieve connection info for customer ${customerId}:`,
          error,
        );
        // Keep billing status as active even if connection retrieval fails
        billingStatus = customer.billingStatus || 'active';
      }
    }

    return {
      usage: {
        hoursThisMonth: +hoursThisMonth.toFixed(2),
        minutesThisMonth: +(hoursThisMonth * 60).toFixed(2),
        totalHours: +totalHours.toFixed(2),
        activeRecordings,
        storageUsed,
      },
      billing: {
        baseFee: +baseFee.toFixed(2),
        usageCost: +usageCost.toFixed(2),
        recordingHours: +usageCost.toFixed(2),
        storage: storageCost,
        apiCalls: apiCallsCost,
        total: +totalCost.toFixed(2),
      },
      billingStatus,
      walletBalance,
      connectionInfo,
    };
  }

  /**
   * Charge monthly base fee for a customer using LavaPayments SDK
   */
  async chargeMonthlyBaseFee(customerId: string): Promise<boolean> {
    try {
      const customer = await this.customerModel.findByPk(customerId);
      if (
        !customer ||
        !customer.lavaConnectionSecret ||
        customer.billingStatus !== 'active'
      ) {
        console.log(
          `Customer ${customerId} not eligible for base fee charge: no connection or inactive`,
        );
        return false;
      }

      // Generate unique request ID for idempotency
      const now = new Date();
      const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const requestId = `${customerId}_${monthYear}_base_fee`;

      // Get base fee product secret
      const baseFeeProductSecret = this.configService.get(
        'lavapayments.basePriceProductSecret',
      );

      // Create request using LavaPayments SDK
      // This will charge $20 per request as configured in the Lava dashboard
      const request = await this.lava.requests.create({
        request_id: requestId,
        connection_secret: customer.lavaConnectionSecret,
        product_secret: baseFeeProductSecret,
        metadata: {
          customer_id: customerId,
          charge_type: 'monthly_base_fee',
          month_year: monthYear,
        },
        // For base fee, we don't need actual usage metrics since it's a fixed charge
        // The product configuration in Lava dashboard determines the $20 charge
        input_tokens: 0,
        output_tokens: 0,
        input_characters: 0,
        output_characters: 0,
        input_seconds: 0,
        output_seconds: 0,
      });

      console.log(
        `Successfully charged base fee for customer ${customerId}:`,
        request,
      );

      // Update customer usage record for this month
      await this.updateCustomerUsageForBaseFee(customerId, monthYear);

      return true;
    } catch (error) {
      console.error(
        `Error charging base fee for customer ${customerId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Delete/cancel LavaPayments connection
   * This will cancel the customer's billing subscription and remove connection details
   *
   * Note: When a connection is deleted from LavaPayments dashboard, the webhook
   * will automatically handle the account cancellation via connection.deleted event
   */
  async deleteConnection(customerId: string): Promise<boolean> {
    try {
      const customer = await this.customerModel.findByPk(customerId);

      if (!customer || !customer.lavaConnectionId) {
        console.log(
          `Customer ${customerId} has no active connection to delete`,
        );
        return false;
      }

      // Delete the connection from LavaPayments
      await this.lava.connections.delete(customer.lavaConnectionId);

      console.log(
        `Successfully deleted LavaPayments connection for customer ${customerId}`,
      );

      // Update customer record to remove connection details - this is handled by the webhook
      // await customer.update({
      //   lavaConnectionId: null,
      //   lavaConnectionSecret: null,
      //   billingStatus: 'cancelled',
      // });

      console.log(`Updated customer ${customerId} billing status to cancelled`);

      return true;
    } catch (error) {
      console.error(
        `Error deleting connection for customer ${customerId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Update customer usage record to include base fee
   */
  private async updateCustomerUsageForBaseFee(
    customerId: string,
    monthYear: string,
  ): Promise<void> {
    try {
      const baseFee = 20.0; // $20 monthly base fee

      // Find or create usage record for this month
      let usageRecord = await this.customerUsageModel.findOne({
        where: { customerId, periodKey: monthYear },
      });

      if (!usageRecord) {
        // Create new usage record for this month
        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        usageRecord = await this.customerUsageModel.create({
          customerId,
          period: CustomerUsagePeriod.MONTHLY,
          periodKey: monthYear,
          periodStartDate: periodStart,
          periodEndDate: periodEnd,
          recordingHours: 0,
          recordingCount: 0,
          activeRecordings: 0,
          recordingCost: 0,
          storageUsedGB: 0,
          storageQuotaGB: 0,
          storageCost: 0,
          apiCalls: 0,
          apiCallsQuota: 0,
          apiCallsCost: 0,
          transcriptionMinutes: 0,
          transcriptionCost: 0,
          bandwidthUsedGB: 0,
          bandwidthCost: 0,
          totalCost: baseFee,
          discountAmount: 0,
          taxAmount: 0,
          finalAmount: baseFee,
          billingStatus: CustomerBillingStatus.PENDING,
          billingDate: now,
          dueDate: periodEnd,
          subscriptionTier: 'base_fee',
          billingMetadata: {
            base_fee_charged: true,
            base_fee_amount: baseFee,
            charge_date: now.toISOString(),
          },
        });
      } else {
        // Update existing usage record to include base fee
        const currentTotal = Number(usageRecord.totalCost || 0);
        const newTotal = currentTotal + baseFee;

        await usageRecord.update({
          totalCost: newTotal,
          finalAmount: newTotal,
          billingMetadata: {
            ...usageRecord.billingMetadata,
            base_fee_charged: true,
            base_fee_amount: baseFee,
            charge_date: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      console.error(
        `Error updating usage record for base fee - customer ${customerId}:`,
        error,
      );
    }
  }
}
