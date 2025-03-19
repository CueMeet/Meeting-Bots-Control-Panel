import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import configuration from './config/configuration';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ApiKeyThrottlerGuard } from './guards/api-key-throttler.guard';
import { BotModule } from './bot/bot.module';
import { AwsModule } from './aws/aws.module';
import { BullModule } from '@nestjs/bullmq';
import { CronJobModule } from './cron-job/cron-job.module';
import { GrpcModule } from './grpc/grpc.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    AuthModule,
    DatabaseModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 100,
      },
    ]),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
      },
    }),
    BotModule,
    AwsModule,
    CronJobModule,
    GrpcModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiKeyThrottlerGuard,
    },
    AppService,
  ],
})
export class AppModule {}
