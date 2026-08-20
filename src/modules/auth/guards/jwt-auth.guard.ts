import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** 'jwt' stratejisini calistirir; token yoksa/gecersizse 401 doner */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
