import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Types } from 'mongoose';

import { AuthenticatedUser } from '../../auth/types/jwt-payload.type';
import { UserRole } from '../../users/schemas/user.schema';
import { MediaDocument } from '../schemas/media.schema';
import { MediaService } from '../media.service';
import { OWNER_ONLY_KEY } from './media-policy.decorator';

export interface MediaRequest extends Request {
  user: AuthenticatedUser;
  media: MediaDocument;
}

@Injectable()
export class MediaAccessGuard implements CanActivate {
  constructor(
    private readonly mediaService: MediaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<MediaRequest>();

    const id = request.params.id as string;

    // Guard, Pipe'lardan once calisir; format dogrulamasi burada yapilmali
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Gecersiz id formati');
    }

    // Kayit yoksa 404, varsa yetki kontrolu yapilir
    const media = await this.mediaService.findByIdOrFail(id);

    const ownerOnly = this.reflector.getAllAndOverride<boolean>(
      OWNER_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!this.isAllowed(ownerOnly, media, request.user)) {
      throw new ForbiddenException('Bu dosyaya erisim yetkiniz yok');
    }

    // Controller ayni kaydi tekrar sorgulamasin diye istege ilistirilir
    request.media = media;
    return true;
  }

  private isAllowed(
    ownerOnly: boolean | undefined,
    media: MediaDocument,
    user: AuthenticatedUser,
  ): boolean {
    // Admin tum medya uclarinda yetkilidir; kaynak sahipligi aranmaz
    if (user.role === UserRole.Admin) {
      return true;
    }

    return ownerOnly
      ? this.mediaService.isOwner(media, user.userId)
      : this.mediaService.canAccess(media, user.userId);
  }
}
