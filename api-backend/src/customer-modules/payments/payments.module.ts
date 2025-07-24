import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CustomerPayment } from '../../database/models/customer/customer-payment.model';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { CustomerAuthModule } from '../auth/auth.module';

@Module({
  imports: [SequelizeModule.forFeature([CustomerPayment]), CustomerAuthModule],
  providers: [PaymentsService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
