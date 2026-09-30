import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.enableShutdownHooks();

  const configuredOrigins = (configService.get<string>('CORS_ORIGIN', 'http://localhost:3000') ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: configuredOrigins,
    credentials: true,
  });

  const port = Number(configService.get<number>('PORT', 3001));
  await app.listen(port);
}

await bootstrap();
