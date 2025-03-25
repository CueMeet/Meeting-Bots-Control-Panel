import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');

  const configService = app.get(ConfigService);
  app.enableCors({
    origin: configService.get('cors.allowedOrigins'),
    credentials: true,
  });

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
