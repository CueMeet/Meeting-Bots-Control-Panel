import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { SequelizeModule } from '@nestjs/sequelize';
import { Customer } from '../../database/models/customer/customer.model';
import { CustomerAuthService } from './customer-auth.service';
import { ZitadelService } from './zitadel.service';
import { CustomerAuthController } from './customer-auth.controller';
import { CustomerAuthGuard } from '../../guards/customer-auth.guard';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [
    ConfigModule,
    SequelizeModule.forFeature([Customer]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('customerJwt.secret'),
        signOptions: {
          expiresIn: configService.get('customerJwt.expiresIn'),
          issuer: configService.get('customerJwt.issuer'),
          audience: configService.get('customerJwt.audience'),
        },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
  ],
  providers: [CustomerAuthService, ZitadelService, CustomerAuthGuard],
  controllers: [CustomerAuthController],
  exports: [CustomerAuthService, ZitadelService, CustomerAuthGuard],
})
export class CustomerAuthModule {}
