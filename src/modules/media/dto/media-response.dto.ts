import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MediaResponseDto {
  @ApiProperty({ example: '66c1f2a7b3d4e5f6a7b8c9d0' })
  id: string;

  @ApiProperty({ example: 'tatil.jpg' })
  fileName: string;

  @ApiProperty({ example: 'image/jpeg' })
  mimeType: string;

  @ApiProperty({ example: 248_312, description: 'Byte cinsinden boyut' })
  size: number;

  @ApiProperty({ example: '66c1f2a7b3d4e5f6a7b8c9d0' })
  ownerId: string;

  @ApiPropertyOptional({
    type: [String],
    example: [],
    description:
      'Erisim izni verilmis kullanicilar. Yalnizca dosya sahibi ve admin icin doner; ' +
      'izinli kullanicilar bu alani gormez.',
  })
  allowedUserIds?: string[];

  @ApiProperty()
  createdAt: Date;
}

export class MediaListDto {
  @ApiProperty({ type: [MediaResponseDto] })
  items: MediaResponseDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
