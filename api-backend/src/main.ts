import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { json, raw } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');

  // Enable cookie parser for refresh token handling
  app.use(cookieParser());

  // Configure body parsing for webhooks
  app.use('/api/v1/webhooks/lavapayments', raw({ type: 'application/json' }));
  app.use(json({ limit: '10mb' }));

  const configService = app.get(ConfigService);
  app.enableCors({
    origin: configService.get('cors.allowedOrigins'),
    credentials: true,
  });

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
