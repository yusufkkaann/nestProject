import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseFilePipe,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MediaParam } from './decorators/media-param.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { ListMediaQueryDto } from './dto/list-media-query.dto';
import { MediaListDto, MediaResponseDto } from './dto/media-response.dto';
import {
  PermissionActionDto,
  PermissionsResponseDto,
} from './dto/permission-action.dto';
import { MediaAccessGuard } from './guards/media-access.guard';
import { OwnerOnly } from './guards/media-policy.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { LeanMedia, MediaService } from './media.service';
import type { MediaDocument } from './schemas/media.schema';

@ApiTags('Media')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Token eksik veya gecersiz' })
@UseGuards(JwtAuthGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'JPEG gorsel yukler (maks. 5MB)' })
  @ApiCreatedResponse({ type: MediaResponseDto })
  @ApiBadRequestResponse({ description: 'Dosya gonderilmedi' })
  @ApiPayloadTooLargeResponse({ description: 'Dosya boyutu sinirini asiyor' })
  @ApiUnsupportedMediaTypeResponse({
    description: 'Yalnizca JPEG kabul edilir',
  })
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        exceptionFactory: () =>
          new BadRequestException('file alani zorunludur'),
      }),
    )
    file: Express.Multer.File,
  ): Promise<MediaResponseDto> {
    const media = await this.mediaService.create(user.userId, file);
    return this.toResponse(media, user);
  }

  @Get('my')
  @ApiOperation({
    summary: 'Kullanicinin yukledigi medyalari listeler',
    description:
      'Sayfalama opsiyoneldir: page ve limit verilmezse ilk sayfa (20 kayit) doner. ' +
      'Cevap her zaman ayni zarf yapisindadir; toplam kayit sayisi total alanindan okunur.',
  })
  @ApiOkResponse({ type: MediaListDto })
  async findMy(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMediaQueryDto,
  ): Promise<MediaListDto> {
    const { items, total } = await this.mediaService.findMyPaginated(
      user.userId,
      query.page,
      query.limit,
    );

    return {
      items: items.map((media) => this.toResponse(media, user)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  @Get(':id')
  @UseGuards(MediaAccessGuard)
  @ApiOperation({
    summary:
      'Medya bilgilerini doner (sahibi, yetkilendirilmis kullanici veya admin)',
  })
  @ApiOkResponse({ type: MediaResponseDto })
  @ApiForbiddenResponse({ description: 'Erisim yetkisi yok' })
  @ApiNotFoundResponse({ description: 'Medya bulunamadi' })
  findOne(
    @Param('id') _id: string,
    @MediaParam() media: MediaDocument,
    @CurrentUser() user: AuthenticatedUser,
  ): MediaResponseDto {
    return this.toResponse(media, user);
  }

  @Get(':id/download')
  @UseGuards(MediaAccessGuard)
  @ApiOperation({
    summary:
      'Dosyayi stream eder; statik servis yoktur, guard kontrolunden gecer',
  })
  @ApiOkResponse({
    description: 'Dosya icerigi',
    content: { 'image/jpeg': {} },
  })
  @ApiForbiddenResponse({ description: 'Erisim yetkisi yok' })
  @ApiNotFoundResponse({ description: 'Medya bulunamadi' })
  download(
    @Param('id') _id: string,
    @MediaParam() media: MediaDocument,
  ): StreamableFile {
    return new StreamableFile(this.mediaService.openStream(media), {
      type: media.mimeType,
      length: media.size,
      disposition: `attachment; filename="${encodeURIComponent(media.fileName)}"`,
    });
  }

  @Delete(':id')
  @OwnerOnly()
  @UseGuards(MediaAccessGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Medyayi siler (dosya sahibi veya admin)' })
  @ApiNoContentResponse({ description: 'Silindi' })
  @ApiForbiddenResponse({
    description: 'Yalnizca dosya sahibi veya admin silebilir',
  })
  @ApiNotFoundResponse({ description: 'Medya bulunamadi' })
  async remove(
    @Param('id') _id: string,
    @MediaParam() media: MediaDocument,
  ): Promise<void> {
    await this.mediaService.remove(media);
  }

  @Get(':id/permissions')
  @OwnerOnly()
  @UseGuards(MediaAccessGuard)
  @ApiOperation({
    summary:
      'Dosyaya erisebilen kullanicilari listeler (dosya sahibi veya admin)',
  })
  @ApiOkResponse({ type: PermissionsResponseDto })
  @ApiForbiddenResponse({
    description: 'Yalnizca dosya sahibi veya admin goruntuleyebilir',
  })
  @ApiNotFoundResponse({ description: 'Medya bulunamadi' })
  permissions(
    @Param('id') _id: string,
    @MediaParam() media: MediaDocument,
  ): PermissionsResponseDto {
    return this.toPermissions(media);
  }

  @Post(':id/permissions')
  @OwnerOnly()
  @UseGuards(MediaAccessGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Erisim yetkisi ekler veya kaldirir (dosya sahibi veya admin)',
  })
  @ApiOkResponse({ type: PermissionsResponseDto })
  @ApiBadRequestResponse({ description: 'Gecersiz kullanici id veya action' })
  @ApiForbiddenResponse({
    description: 'Yalnizca dosya sahibi veya admin yetki yonetebilir',
  })
  @ApiNotFoundResponse({ description: 'Medya veya kullanici bulunamadi' })
  async updatePermission(
    @Param('id') _id: string,
    @MediaParam() media: MediaDocument,
    @Body() dto: PermissionActionDto,
  ): Promise<PermissionsResponseDto> {
    const updated = await this.mediaService.updatePermission(
      media,
      dto.userId,
      dto.action,
    );
    return this.toPermissions(updated);
  }

  /**
   * Izin listesi yalnizca dosya sahibine ve admine gosterilir.
   * Aksi halde izinli bir kullanici dosyanin baska kimlerle paylasildigini gorurdu.
   */
  private toResponse(
    media: MediaDocument | LeanMedia,
    viewer: AuthenticatedUser,
  ): MediaResponseDto {
    const canSeePermissions =
      viewer.role === UserRole.Admin ||
      media.ownerId.toString() === viewer.userId;

    return {
      id: media._id.toString(),
      fileName: media.fileName,
      mimeType: media.mimeType,
      size: media.size,
      ownerId: media.ownerId.toString(),
      allowedUserIds: canSeePermissions
        ? media.allowedUserIds.map(String)
        : undefined,
      createdAt: media.createdAt,
    };
  }

  private toPermissions(media: MediaDocument): PermissionsResponseDto {
    return {
      ownerId: media.ownerId.toString(),
      allowedUserIds: media.allowedUserIds.map(String),
    };
  }
}
