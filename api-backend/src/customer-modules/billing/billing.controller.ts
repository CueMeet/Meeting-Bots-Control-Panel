import { Controller, Get, Post, UseGuards, Body } from '@nestjs/common';
import { LavaPaymentsService } from './lavapayments.service';
import { CustomerAuthGuard } from '../../guards/customer-auth.guard';
import { Customer } from '../../database/models/customer/customer.model';
import { GetCustomer } from '../../decorators/get-customer.decorator';
import { ConfigService } from '@nestjs/config';

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
  ) {}

  @Post('checkout-session')
  async createCheckoutSession(@GetCustomer() customer: Customer) {
    console.log(this.configService.get('frontendUrl'));
    const session = await this.lavaPaymentsService.createCheckoutSession({
      checkout_mode: 'onboarding',
      origin_url: `${this.configService.get('frontendUrl')}/usage`,
      reference_id: customer.id,
    });
    return { checkout_session_token: session.checkout_session_token };
  }

  @Post('checkout-completion')
  async handleCheckoutCompletion(
    @GetCustomer() customer: Customer,
    @Body() completionDto: CheckoutCompletionDto,
  ) {
    const { connectionId, checkoutSessionId } = completionDto;

    await this.lavaPaymentsService.retrieveAndStoreConnectionSecret(
      customer.id,
      connectionId,
    );

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
}
