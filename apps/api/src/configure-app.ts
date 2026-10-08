import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

/** Shared by main.ts and the HTTP integration tests. */
export function configureApp(app: INestApplication, config: ConfigService) {
  app.setGlobalPrefix('api/v1');
  // The web app calls public endpoints server-side and forwards the visitor's
  // address in X-Forwarded-For; only trust it from private networks by default.
  const trust = config.get<string>('TRUST_PROXY') ?? 'loopback, uniquelocal';
  app.getHttpAdapter().getInstance().set('trust proxy', trust === 'true' ? true : trust === 'false' ? false : trust);
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const allowedOrigins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins.length ? allowedOrigins : false,
    credentials: true,
  });
}
