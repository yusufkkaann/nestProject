import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { User, UserSchema } from './schemas/user.schema';
import { UsersService } from './users.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ], //mongodb'ye baglanmak icin gerekli olan modul
  providers: [UsersService], //bu module'de kullanilacak servisler
  exports: [UsersService], //modul disinda kullanilacak servisler
})
export class UsersModule {}
