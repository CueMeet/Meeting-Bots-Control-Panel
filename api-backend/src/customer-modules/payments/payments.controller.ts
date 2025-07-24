import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CustomerAuthGuard } from '../../guards/customer-auth.guard';
import { GetCustomer } from '../../decorators/get-customer.decorator';
import { Customer } from '../../database/models/customer/customer.model';

@Controller('customer/payments')
@UseGuards(CustomerAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Get payment history for the authenticated customer
   * Query params: page, limit
   */
  @Get()
  async getPaymentHistory(
    @GetCustomer() customer: Customer,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const result = await this.paymentsService.getPaymentHistory(
      customer.id,
      Number(page),
      Number(limit),
    );
    return {
      success: true,
      data: result,
    };
  }
}
