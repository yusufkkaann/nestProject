import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    UsersModule,
    // global: JwtAuthGuard baska modullerin controller'larinda da orneklenip JwtService istiyor.
    // Secret'lar imzalama/dogrulama aninda verildigi icin burada bos birakiliyor.
    JwtModule.register({ global: true }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
