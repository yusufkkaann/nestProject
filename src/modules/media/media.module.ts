import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';

import { UsersModule } from '../users/users.module';
import { MediaController } from './media.controller';
import { createMulterOptions } from './media-upload.config';
import { MediaService } from './media.service';
import { Media, MediaSchema } from './schemas/media.schema';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([{ name: Media.name, schema: MediaSchema }]),

    // ConfigModule global oldugu icin ayrica import edilmesine gerek yok
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: createMulterOptions,
    }),
  ],
  controllers: [MediaController],
  providers: [MediaService],
})
export class MediaModule {}
