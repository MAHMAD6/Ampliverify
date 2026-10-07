import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  const config = app.get(ConfigService);
  configureApp(app, config);

  const port = Number(config.get<string>('PORT') ?? '4000');
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
