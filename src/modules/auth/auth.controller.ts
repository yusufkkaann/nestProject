import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService, IssuedTokens } from './auth.service';
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from './auth.cookies';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { TokensDto } from './dto/tokens.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedUser } from './types/jwt-payload.type';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Yeni kullanici olusturur (token dondurmez, ayrica login gerekir)' })
  @ApiCreatedResponse({ type: RegisterResponseDto })
  @ApiBadRequestResponse({ description: 'Dogrulama hatasi (gecersiz e-posta veya zayif parola)' })
  @ApiConflictResponse({ description: 'E-posta zaten kayitli' })
  @ApiTooManyRequestsResponse({ description: 'Cok fazla istek' })
  register(@Body() dto: RegisterDto): Promise<RegisterResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Kimlik dogrular; token cifti hem httpOnly cookie olarak hem govdede doner',
  })
  @ApiOkResponse({ type: TokensDto })
  @ApiBadRequestResponse({ description: 'Dogrulama hatasi' })
  @ApiUnauthorizedResponse({ description: 'E-posta veya parola hatali' })
  @ApiTooManyRequestsResponse({ description: 'Cok fazla istek' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokensDto> {
    const tokens = await this.authService.login(dto);
    return this.respondWithTokens(res, tokens);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh token ile yeni token cifti uretir (rotation)' })
  @ApiOkResponse({ type: TokensDto })
  @ApiBadRequestResponse({ description: 'Token formati gecersiz' })
  @ApiUnauthorizedResponse({ description: 'Gecersiz, suresi dolmus veya kullanilmis refresh token' })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokensDto> {
    // Once govde, sonra cookie: hem API istemcileri hem tarayici desteklenir
    const token = dto.refreshToken ?? (req.cookies?.[REFRESH_COOKIE] as string | undefined);
    if (!token) {
      throw new UnauthorizedException('Refresh token bulunamadi');
    }

    const tokens = await this.authService.refresh(token);
    return this.respondWithTokens(res, tokens);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Oturumu kapatir: refresh token gecersizlesir, cookieler silinir' })
  @ApiNoContentResponse({ description: 'Cikis yapildi' })
  @ApiUnauthorizedResponse({ description: 'Token eksik veya gecersiz' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(user.userId);
    clearAuthCookies(res, this.isProduction);
  }

  private respondWithTokens(res: Response, tokens: IssuedTokens): TokensDto {
    setAuthCookies(res, tokens, tokens, this.isProduction);
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  private get isProduction(): boolean {
    return this.config.get<string>('nodeEnv') === 'production';
  }
}
