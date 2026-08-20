import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { UserProfileDto } from './dto/user-profile.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Oturum acan kullanicinin profili' })
  @ApiOkResponse({ type: UserProfileDto })
  @ApiUnauthorizedResponse({ description: 'Token eksik veya gecersiz' })
  @ApiNotFoundResponse({ description: 'Kullanici bulunamadi' })
  async me(@CurrentUser() current: AuthenticatedUser): Promise<UserProfileDto> {
    const user = await this.usersService.findById(current.userId);
    if (!user) {
      throw new NotFoundException('Kullanici bulunamadi');
    }

    return {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}
