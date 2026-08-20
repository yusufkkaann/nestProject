import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { ACCESS_COOKIE } from '../auth.cookies';
import { AuthenticatedUser, JwtPayload } from '../types/jwt-payload.type';

/** Tarayici istemcileri icin: token httpOnly cookie'den okunur */
function fromCookie(req: Request): string | null {
  return (req?.cookies?.[ACCESS_COOKIE] as string | undefined) ?? null;
}

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      // Once Authorization basligi, yoksa cookie
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        fromCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  /** Donen deger request.user'a yazilir. Token kisa omurlu oldugu icin DB'ye gidilmiyor. */
  validate(payload: JwtPayload): AuthenticatedUser {
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
