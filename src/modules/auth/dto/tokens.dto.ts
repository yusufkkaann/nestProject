import { ApiProperty } from '@nestjs/swagger';

export class TokensDto {
  @ApiProperty({ description: 'Kisa omurlu erisim token (varsayilan 15dk)' })
  accessToken: string;

  @ApiProperty({ description: 'Uzun omurlu yenileme token (varsayilan 7g, her kullanimda degisir)' })
  refreshToken: string;
}
