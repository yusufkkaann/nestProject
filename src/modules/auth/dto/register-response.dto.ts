import { ApiProperty } from '@nestjs/swagger';

export class RegisteredUserDto {
  @ApiProperty({ example: '66c1f2a7b3d4e5f6a7b8c9d0' })
  id: string;

  @ApiProperty({ example: 'kaan@example.com' })
  email: string;
}

export class RegisterResponseDto {
  @ApiProperty({ example: 'Kayit basarili, giris yapabilirsiniz' })
  message: string;

  @ApiProperty({ type: RegisteredUserDto })
  user: RegisteredUserDto;
}
