import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'kaan@example.com' })
  @IsEmail({}, { message: 'Gecerli bir e-posta adresi giriniz' })
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Passw0rd!', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8, { message: 'Parola en az 8 karakter olmali' })
  @MaxLength(128, { message: 'Parola en fazla 128 karakter olabilir' })
  @Matches(/(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'Parola en az bir harf ve bir rakam icermeli',
  })
  password: string;
}
