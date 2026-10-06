import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function databaseConfig(config: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    url: config.getOrThrow<string>('DATABASE_URL'),
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: false,
    logging: config.get<string>('NODE_ENV') === 'development' ? ['error', 'warn'] : ['error'],
    ssl: config.get<string>('NODE_ENV') === 'production' ? { rejectUnauthorized: true } : false,
  };
}
