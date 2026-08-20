import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { ACCESS_COOKIE } from '../auth.cookies';
import { AuthenticatedUser, JwtPayload } from '../types/jwt-payload.type';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

/** Access token'i dogrular; gecerliyse kullaniciyi request'e yazar, degilse 401 doner */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly accessSecret: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.accessSecret = config.getOrThrow<string>('jwt.accessSecret');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Token bulunamadi');
    }

    const payload = await this.verify(token);
    request.user = {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    return true;
  }

  /** Once Authorization basligi, yoksa httpOnly cookie */
  private extractToken(request: Request): string | undefined {
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme === 'Bearer' && token) {
      return token;
    }
    return request.cookies?.[ACCESS_COOKIE] as string | undefined;
  }

  /** Suresi dolmus token ayri mesaj alir: istemci refresh mi yoksa login mi gerektigini bilir */
  private async verify(token: string): Promise<JwtPayload> {
    try {
      return await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.accessSecret,
      });
    } catch (error) {
      if ((error as Error).name === 'TokenExpiredError') {
        throw new UnauthorizedException(
          'Token suresi doldu, /auth/refresh ile yenileyin',
        );
      }
      throw new UnauthorizedException('Gecersiz token');
    }
  }
}
