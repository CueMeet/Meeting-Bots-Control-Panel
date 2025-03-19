import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ApiKey } from 'src/database/models/api-key.model';
import { User } from 'src/database/models/user.model';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyService } from './api-key.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [SequelizeModule.forFeature([User, ApiKey])],
  providers: [AuthService, ApiKeyService],
  controllers: [AuthController, ApiKeyController],
  exports: [AuthService, ApiKeyService],
})
export class AuthModule {}
