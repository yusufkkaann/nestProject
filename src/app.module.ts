import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { configuration } from './config/configuration';
import { createMongooseOptions } from './config/database.config';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { MediaModule } from './modules/media/media.module';
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
      useFactory: createMongooseOptions,
    }),

    // Brute-force korumasi: IP basina 60 saniyede 100 istek
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    HealthModule, // health modulu eklendi
    AuthModule, // register / login / refresh
    UsersModule, // /users/me
    MediaModule, // yukleme, indirme, yetkilendirme
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
