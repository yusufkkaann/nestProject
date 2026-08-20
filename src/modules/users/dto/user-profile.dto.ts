import { ApiProperty } from '@nestjs/swagger';

import { UserRole } from '../schemas/user.schema';

export class UserProfileDto {
  @ApiProperty({ example: '66c1f2a7b3d4e5f6a7b8c9d0' })
  id: string;

  @ApiProperty({ example: 'kaan@example.com' })
  email: string;

  @ApiProperty({ enum: UserRole, example: UserRole.User })
  role: UserRole;

  @ApiProperty()
  createdAt: Date;
}
