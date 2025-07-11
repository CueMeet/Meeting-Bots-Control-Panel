import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Lava } from '@lavapayments/nodejs';
import { CustomerBotStatus } from '../../database/models/customer/customer-bot.model';
import { InjectModel } from '@nestjs/sequelize';
import { CustomerUsage } from '../../database/models/customer/customer-usage.model';
import { CustomerBot } from '../../database/models/customer/customer-bot.model';
import { Customer } from '../../database/models/customer/customer.model';

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
   * Get usage analytics for a customer
   */
  async getUsageAnalytics(customerId: string) {
    // Get current month (YYYY-MM)
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get current month usage
    const currentMonthUsage = await this.customerUsageModel.findOne({
      where: { customerId, periodKey: monthKey },
    });

    // Get all-time total hours
    const allUsage = await this.customerUsageModel.findAll({
      where: { customerId },
    });
    const totalHours = allUsage.reduce(
      (sum, u) => sum + Number(u.recordingHours || 0),
      0,
    );

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

    // Recording hours and cost for this month
    const hoursThisMonth = currentMonthUsage
      ? Number(currentMonthUsage.recordingHours || 0)
      : 0;
    const minutesThisMonth = hoursThisMonth * 60;
    const baseRate = 20; // $20/month
    const usageRate = 0.4; // $0.40 per minute
    const usageCost = +(minutesThisMonth * usageRate).toFixed(2);
    const recordingCost = usageCost;
    const storageCost = 0; // Placeholder
    const apiCallsCost = 0; // Placeholder
    const totalCost = +(
      baseRate +
      usageCost +
      storageCost +
      apiCallsCost
    ).toFixed(2);

    return {
      usage: {
        hoursThisMonth,
        minutesThisMonth: +minutesThisMonth.toFixed(2),
        totalHours: +totalHours.toFixed(2),
        activeRecordings,
        storageUsed,
      },
      billing: {
        baseRate,
        usageCost,
        recordingHours: recordingCost,
        storage: storageCost,
        apiCalls: apiCallsCost,
        total: totalCost,
      },
    };
  }
}
