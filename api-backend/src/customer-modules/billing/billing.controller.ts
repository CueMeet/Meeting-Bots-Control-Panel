import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { LavaPaymentsService } from './lavapayments.service';
import { CustomerAuthGuard } from '../../guards/customer-auth.guard';
import { Customer } from '../../database/models/customer/customer.model';
import { GetCustomer } from '../../decorators/get-customer.decorator';
import { ConfigService } from '@nestjs/config';
import { MonthlySubscriptionService } from './monthly-subscription.service';

export interface CheckoutCompletionDto {
  connectionId: string;
  checkoutSessionId: string;
}

@Controller('billing')
@UseGuards(CustomerAuthGuard)
export class BillingController {
  constructor(
    private readonly lavaPaymentsService: LavaPaymentsService,
    private readonly configService: ConfigService,
    private readonly monthlySubscriptionService: MonthlySubscriptionService,
  ) {}

  @Post('checkout-session')
  async createCheckoutSession(@GetCustomer() customer: Customer) {
    const session = await this.lavaPaymentsService.createCheckoutSession({
      checkout_mode: 'onboarding',
      origin_url: `${this.configService.get('frontendUrl')}/usage`,
      reference_id: customer.id,
    });
    return { checkout_session_token: session.checkout_session_token };
  }

  /**
   * Create top-up checkout session for existing customers
   * This allows customers to add more funds to their wallet
   */
  @Post('topup-session')
  async createTopupSession(@GetCustomer() customer: Customer) {
    // Verify customer has active billing
    if (!customer.lavaConnectionId || customer.billingStatus !== 'active') {
      throw new BadRequestException(
        'Active billing subscription required for top-up. Please complete onboarding first.',
      );
    }

    const session = await this.lavaPaymentsService.createCheckoutSession({
      checkout_mode: 'topup',
      origin_url: `${this.configService.get('frontendUrl')}/usage`,
      reference_id: customer.id,
      connection_id: customer.lavaConnectionId,
    });

    return {
      checkout_session_token: session.checkout_session_token,
      checkout_session_id: session.checkout_session_id,
      checkout_mode: session.checkout_mode,
      connection_id: session.connection_id,
      reference_id: session.reference_id,
      created_at: session.created_at,
    };
  }

  @Post('checkout-completion')
  async handleCheckoutCompletion(
    @GetCustomer() customer: Customer,
    @Body() completionDto: CheckoutCompletionDto,
  ) {
    const { connectionId, checkoutSessionId } = completionDto;

    // No need to store connection secret here; handled by webhook
    return {
      success: true,
      message: 'Checkout completed successfully',
      data: {
        connectionId,
        checkoutSessionId,
        billingStatus: 'active',
      },
    };
  }

  @Get('usage-analytics')
  async getUsageAnalytics(@GetCustomer() customer: Customer) {
    const analytics = await this.lavaPaymentsService.getUsageAnalytics(
      customer.id,
    );
    return analytics;
  }

  /**
   * Delete/cancel LavaPayments connection
   * This will cancel the customer's billing subscription
   */
  @Delete('connection')
  async deleteConnection(@GetCustomer() customer: Customer) {
    const success = await this.lavaPaymentsService.deleteConnection(
      customer.id,
    );

    return {
      success,
      message: success
        ? 'Connection deleted successfully'
        : 'Failed to delete connection',
      data: {
        customerId: customer.id,
        deletedAt: new Date().toISOString(),
      },
    };
  }
}
