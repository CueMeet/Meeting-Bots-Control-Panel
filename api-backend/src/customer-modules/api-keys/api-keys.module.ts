import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CustomerApiKey } from '../../database/models/customer/customer-api-key.model';
import { Customer } from '../../database/models/customer/customer.model';
import { CustomerApiKeysService } from './api-keys.service';
import { CustomerApiKeysController } from './api-keys.controller';
import { CustomerAuthModule } from '../auth/auth.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [
    SequelizeModule.forFeature([CustomerApiKey, Customer]),
    CustomerAuthModule,
    AuthModule,
  ],
  providers: [CustomerApiKeysService],
  controllers: [CustomerApiKeysController],
  exports: [CustomerApiKeysService],
})
export class CustomerApiKeysModule {}
