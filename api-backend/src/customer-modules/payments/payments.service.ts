import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CustomerPayment } from '../../database/models/customer/customer-payment.model';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(CustomerPayment)
    private readonly customerPaymentModel: typeof CustomerPayment,
  ) {}

  async getPaymentHistory(customerId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const { rows, count } = await this.customerPaymentModel.findAndCountAll({
      where: { customerId },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
    return {
      payments: rows,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }
}
