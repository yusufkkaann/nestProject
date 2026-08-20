import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsJWT, IsOptional } from 'class-validator';

export class RefreshDto {
  @ApiPropertyOptional({
    description:
      'Refresh token. Gonderilmezse httpOnly cookie (refresh_token) kullanilir.',
  })
  @IsOptional()
  @IsJWT({ message: 'Gecersiz token formati' })
  refreshToken?: string;
}
