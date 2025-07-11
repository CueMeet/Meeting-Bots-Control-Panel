import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { CustomerAuthGuard } from '../../guards/customer-auth.guard';
import { GetCustomer } from '../../decorators/get-customer.decorator';
import { Customer } from '../../database/models/customer/customer.model';

@Controller('customer/stats')
@UseGuards(CustomerAuthGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  /**
   * Get dashboard statistics
   */
  @Get('dashboard')
  async getDashboardStats(@GetCustomer() customer: Customer) {
    const stats = await this.statsService.getDashboardStats(customer.id);

    return {
      success: true,
      data: stats,
    };
  }

  /**
   * Get recent activity
   */
  @Get('recent-activity')
  async getRecentActivity(
    @GetCustomer() customer: Customer,
    @Query('limit') limit?: number,
  ) {
    const activities = await this.statsService.getRecentActivity(
      customer.id,
      limit ? parseInt(limit.toString()) : 10,
    );

    return {
      success: true,
      data: {
        activities,
        total: activities.length,
      },
    };
  }

  /**
   * Get usage analytics
   */
  @Get('usage-analytics')
  async getUsageAnalytics(
    @GetCustomer() customer: Customer,
    @Query('months') months?: number,
  ) {
    const analytics = await this.statsService.getUsageAnalytics(
      customer.id,
      months ? parseInt(months.toString()) : 6,
    );

    return {
      success: true,
      data: {
        analytics,
        total: analytics.length,
      },
    };
  }

  /**
   * Get quick actions for dashboard
   */
  @Get('quick-actions')
  async getQuickActions(@GetCustomer() customer: Customer) {
    const actions = await this.statsService.getQuickActions(customer.id);

    return {
      success: true,
      data: actions,
    };
  }
}
