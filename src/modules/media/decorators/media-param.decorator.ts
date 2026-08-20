import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { MediaRequest } from '../guards/media-access.guard';

/** MediaAccessGuard'in istege ilistirdigi medya kaydini parametre olarak verir */
export const MediaParam = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    return ctx.switchToHttp().getRequest<MediaRequest>().media;
  },
);
