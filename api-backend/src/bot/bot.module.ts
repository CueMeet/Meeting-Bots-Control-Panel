import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthModule } from 'src/auth/auth.module';
import { AwsModule } from 'src/aws/aws.module';
import { Bot } from 'src/database/models/bot.model';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';
@Module({
  imports: [
    SequelizeModule.forFeature([Bot]),
    forwardRef(() => AwsModule),
    AuthModule,
  ],
  providers: [BotService],
  controllers: [BotController],
  exports: [BotService, SequelizeModule],
})
export class BotModule {}
