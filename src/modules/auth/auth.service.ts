import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { createHash, timingSafeEqual } from 'node:crypto';

import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { LoginDto } from './dto/login.dto';
import { TokensDto } from './dto/tokens.dto';
import { hashPassword, verifyPassword } from './password';
import { JwtPayload } from './types/jwt-payload.type';

/** Kullanici yoksa da dogrulama calissin diye; cevap suresi e-postanin kayitli olup olmadigini ele vermesin */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$OTVbnICcN7cKKhoCH1nL2A$kk9GmopTXImUDE87X/eTIg2MBQPjsF3LKLMWtGLwW1g';

export interface IssuedTokens extends TokensDto {
  accessExp: number;
  refreshExp: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    const passwordHash = await hashPassword(dto.password);
    const user = await this.users.create(dto.email, passwordHash);

    return {
      message: 'Kayit basarili, giris yapabilirsiniz',
      user: { id: user._id.toString(), email: user.email },
    };
  }

  async logout(userId: string): Promise<void> {
    await this.users.setRefreshTokenHash(userId, null);
  }

  async login(dto: LoginDto): Promise<IssuedTokens> {
    const user = await this.users.findByEmailWithPassword(dto.email);

    // Kullanici yoksa bile dogrulama yapilir (timing attack)
    const passwordMatches = await verifyPassword(
      user?.passwordHash ?? DUMMY_HASH,
      dto.password,
    );

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('E-posta veya parola hatali');
    }

    return this.issueTokens(user);
  }

  /** Her cagri yeni bir cift uretir, eski token aninda gecersizlesir */
  async refresh(refreshToken: string): Promise<IssuedTokens> {
    const payload = await this.verifyRefreshToken(refreshToken);

    const user = await this.users.findByIdWithRefreshToken(payload.sub);
    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException('Oturum bulunamadi, tekrar giris yapin');
    }

    if (!this.hashMatches(refreshToken, user.refreshTokenHash)) {
      // Kullanilmis token geldi: calinmis olabilir, oturumu tamamen kapat
      await this.users.setRefreshTokenHash(user._id, null);
      throw new UnauthorizedException(
        'Refresh token gecersiz, oturum sonlandirildi',
      );
    }

    return this.issueTokens(user);
  }

  private async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      return await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException(
        'Gecersiz veya suresi dolmus refresh token',
      );
    }
  }

  private async issueTokens(user: UserDocument): Promise<IssuedTokens> {
    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
        expiresIn:
          this.config.getOrThrow<JwtSignOptions['expiresIn']>('jwt.accessTtl'),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn:
          this.config.getOrThrow<JwtSignOptions['expiresIn']>('jwt.refreshTtl'),
      }),
    ]);

    await this.users.setRefreshTokenHash(user._id, this.sha256(refreshToken));

    return {
      accessToken,
      refreshToken,
      accessExp: this.expiresAt(accessToken),
      refreshExp: this.expiresAt(refreshToken),
    };
  }

  /** Token'in kendi exp claim'i okunur -> cookie omru ile token omru asla ayrisamaz */
  private expiresAt(token: string): number {
    return this.jwt.decode<{ exp: number }>(token).exp;
  }

  /** Token zaten yuksek entropili, Argon2 gereksiz yavaslama olurdu */
  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private hashMatches(token: string, storedHash: string): boolean {
    const incoming = Buffer.from(this.sha256(token));
    const stored = Buffer.from(storedHash);
    return (
      incoming.length === stored.length && timingSafeEqual(incoming, stored)
    );
  }
}
