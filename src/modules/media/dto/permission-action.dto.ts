import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId } from 'class-validator';

export enum PermissionAction {
  Add = 'add',
  Remove = 'remove',
}

export class PermissionActionDto {
  @ApiProperty({
    example: '66c1f2a7b3d4e5f6a7b8c9d0',
    description: 'Yetki verilecek kullanici id',
  })
  @IsMongoId({ message: 'Gecersiz kullanici id' })
  userId: string;

  @ApiProperty({ enum: PermissionAction, example: PermissionAction.Add })
  @IsEnum(PermissionAction, {
    message: "action yalnizca 'add' veya 'remove' olabilir",
  })
  action: PermissionAction;
}

export class PermissionsResponseDto {
  @ApiProperty({ example: '66c1f2a7b3d4e5f6a7b8c9d0' })
  ownerId: string;

  @ApiProperty({ type: [String] })
  allowedUserIds: string[];
}
