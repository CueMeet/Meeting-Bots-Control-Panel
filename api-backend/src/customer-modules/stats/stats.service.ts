import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Customer } from '../../database/models/customer/customer.model';
import { CustomerUsage } from '../../database/models/customer/customer-usage.model';
import { CustomerBot } from '../../database/models/customer/customer-bot.model';
import {
  CustomerApiKey,
  CustomerApiKeyStatus,
} from '../../database/models/customer/customer-api-key.model';
import { RecordingsService } from '../recordings/recordings.service';

export interface DashboardStats {
  hoursRecorded: number;
  activeRecordings: number;
  apiKeysCount: number;
  monthlyBilling: number;
  storageUsed: number;
  totalRecordings: number;
}

export interface RecentActivity {
  id: string;
  type: 'recording' | 'api_key' | 'billing';
  title: string;
  description: string;
  timestamp: Date;
  metadata?: any;
}

@Injectable()
export class StatsService {
  constructor(
    @InjectModel(Customer)
    private readonly customerModel: typeof Customer,
    @InjectModel(CustomerUsage)
    private readonly customerUsageModel: typeof CustomerUsage,
    @InjectModel(CustomerBot)
    private readonly customerBotModel: typeof CustomerBot,
    @InjectModel(CustomerApiKey)
    private readonly customerApiKeyModel: typeof CustomerApiKey,
    private readonly recordingsService: RecordingsService,
  ) {}

  /**
   * Get dashboard statistics for a customer
   */
  async getDashboardStats(customerId: string): Promise<any> {
    // Get current month usage
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const usage = await this.customerUsageModel.findOne({
      where: { customerId, periodKey: currentMonth },
    });

    // Get active recordings count
    const activeRecordings = await this.customerBotModel.count({
      where: {
        customerId,
        status: ['PENDING', 'SCHEDULED', 'STARTING', 'RECORDING'],
      },
    });

    // Get API keys count
    const apiKeysCount = await this.customerApiKeyModel.count({
      where: { customerId, status: CustomerApiKeyStatus.ACTIVE },
    });

    // Get last 2 recordings for today using RecordingsService
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const recordingsResult = await this.recordingsService.getRecordings(
      customerId,
      {
        dateFrom: today.toISOString(),
        dateTo: tomorrow.toISOString(),
        limit: 2,
        page: 1,
      },
    );
    const recentRecordings = recordingsResult.recordings || [];

    // Get total recordings count
    const totalRecordings = await this.customerBotModel.count({
      where: { customerId },
    });

    return {
      hoursRecorded: usage?.recordingHours || 0,
      activeRecordings,
      apiKeysCount,
      monthlyBilling: usage?.finalAmount || 0,
      storageUsed: usage?.storageUsedGB || 0,
      totalRecordings,
      recentRecordings,
    };
  }

  /**
   * Get recent activity for a customer
   */
  async getRecentActivity(
    customerId: string,
    limit = 10,
  ): Promise<RecentActivity[]> {
    const activities: RecentActivity[] = [];

    // Get recent recordings
    const recentRecordings = await this.customerBotModel.findAll({
      where: { customerId },
      order: [['createdAt', 'DESC']],
      limit: limit / 2,
    });

    for (const recording of recentRecordings) {
      activities.push({
        id: recording.id,
        type: 'recording',
        title: recording.name,
        description: `Recording ${recording.status.toLowerCase()}`,
        timestamp: recording.createdAt,
        metadata: {
          platform: recording.platform,
          duration: recording.durationSeconds,
          status: recording.status,
        },
      });
    }

    // Get recent API key activities
    const recentApiKeys = await this.customerApiKeyModel.findAll({
      where: { customerId },
      order: [['createdAt', 'DESC']],
      limit: limit / 2,
    });

    for (const apiKey of recentApiKeys) {
      activities.push({
        id: apiKey.id,
        type: 'api_key',
        title: `API Key: ${apiKey.name}`,
        description: 'API key created',
        timestamp: apiKey.createdAt,
        metadata: {
          name: apiKey.name,
          lastUsed: apiKey.lastUsedAt,
        },
      });
    }

    // Sort by timestamp and limit
    return activities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get usage analytics for a customer
   */
  async getUsageAnalytics(customerId: string, months = 6) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const usage = await this.customerUsageModel.findAll({
      where: {
        customerId,
        periodStartDate: {
          $gte: startDate,
          $lte: endDate,
        },
      },
      order: [['periodStartDate', 'ASC']],
    });

    return usage.map((u) => ({
      month: u.periodKey,
      hoursRecorded: u.recordingHours,
      storageUsed: u.storageUsedGB,
      apiCalls: u.apiCalls,
      cost: u.finalAmount,
    }));
  }

  /**
   * Get quick action items for dashboard
   */
  async getQuickActions(customerId: string) {
    const activeRecordings = await this.customerBotModel.findAll({
      where: {
        customerId,
        status: ['RECORDING', 'STARTING'],
      },
      limit: 5,
    });

    return {
      activeRecordings: activeRecordings.map((recording) => ({
        id: recording.id,
        name: recording.name,
        platform: recording.platform,
        status: recording.status,
        startedAt: recording.actualStartedAt,
        canStop: recording.status === 'RECORDING',
        canDownload: false,
      })),
      canCreateRecording: true,
      canCreateApiKey: true,
    };
  }
}
