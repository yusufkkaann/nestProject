import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { configuration } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    // .env global olarak okunur ve ayaga kalkmadan once dogrulanir
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
    }),

    // Mongo baglantisi config uzerinden async kurulur
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('mongoUri'),
        // Atlas'a acilan havuz: cok fazla baglanti acmadan es zamanli istekleri karsilar
        maxPoolSize: 10,
        minPoolSize: 1,
        serverSelectionTimeoutMS: 5000,
        autoIndex: config.get<string>('nodeEnv') !== 'production',
      }),
    }),

    // Brute-force korumasi: IP basina 60 saniyede 100 istek
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    HealthModule, // health modulu eklendi
    AuthModule, // register / login / refresh
    UsersModule, // /users/me
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
