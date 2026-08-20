import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createReadStream, ReadStream } from 'node:fs';
import { open, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Model, Types } from 'mongoose';

import { UsersService } from '../users/users.service';
import { PermissionAction } from './dto/permission-action.dto';
import { Media, MediaDocument } from './schemas/media.schema';

/** lean() sonucu: metotsuz duz obje. Salt okunur listelemede daha ucuz. */
export type LeanMedia = Media & { _id: Types.ObjectId };

/** JPEG dosyalari her zaman FF D8 FF ile baslar (SOI marker) */
const JPEG_MAGIC_BYTES = Buffer.from([0xff, 0xd8, 0xff]);

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @InjectModel(Media.name) private readonly mediaModel: Model<MediaDocument>,
    private readonly users: UsersService,
  ) {}

  async create(
    ownerId: string,
    file: Express.Multer.File,
  ): Promise<MediaDocument> {
    // Uzanti ve mime type taklit edilebilir, icerige bakiyoruz
    if (!(await this.isJpeg(file.path))) {
      await this.deleteFile(file.path);
      throw new UnprocessableEntityException(
        'Dosya icerigi gecerli bir JPEG degil',
      );
    }

    try {
      return await this.mediaModel.create({
        ownerId: new Types.ObjectId(ownerId),
        fileName: file.originalname,
        filePath: file.path,
        mimeType: file.mimetype,
        size: file.size,
      });
    } catch (error) {
      // Kayit olusmadiysa diskte sahipsiz dosya kalmasin
      await this.deleteFile(file.path);
      throw error;
    }
  }

  async findMyPaginated(ownerId: string, page: number, limit: number) {
    const filter = { ownerId: new Types.ObjectId(ownerId) };

    // Iki sorgu paralel; sirayla calistirmanin anlami yok
    const [items, total] = await Promise.all([
      this.mediaModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<LeanMedia[]>()
        .exec(),
      this.mediaModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
  }

  async findByIdOrFail(id: string): Promise<MediaDocument> {
    const media = await this.mediaModel.findById(id).exec();
    if (!media) {
      throw new NotFoundException('Medya bulunamadi');
    }
    return media;
  }

  isOwner(media: MediaDocument, userId: string): boolean {
    return media.ownerId.toString() === userId;
  }

  canAccess(media: MediaDocument, userId: string): boolean {
    return (
      this.isOwner(media, userId) ||
      media.allowedUserIds.some((allowed) => allowed.toString() === userId)
    );
  }

  openStream(media: MediaDocument): ReadStream {
    return createReadStream(resolve(media.filePath));
  }

  async remove(media: MediaDocument): Promise<void> {
    await media.deleteOne();
    await this.deleteFile(media.filePath);
  }

  async updatePermission(
    media: MediaDocument,
    userId: string,
    action: PermissionAction,
  ): Promise<MediaDocument> {
    if (this.isOwner(media, userId)) {
      throw new BadRequestException('Dosya sahibi zaten tam erisime sahiptir');
    }

    if (!(await this.users.existsById(userId))) {
      throw new NotFoundException('Yetki verilecek kullanici bulunamadi');
    }

    const targetId = new Types.ObjectId(userId);

    // Atomik operatorler: oku-degistir-yaz yarisi olusmuyor
    const update =
      action === PermissionAction.Add
        ? { $addToSet: { allowedUserIds: targetId } }
        : { $pull: { allowedUserIds: targetId } };

    const updated = await this.mediaModel
      .findByIdAndUpdate(media._id, update, { returnDocument: 'after' })
      .exec();

    if (!updated) {
      throw new NotFoundException('Medya bulunamadi');
    }
    return updated;
  }

  /** JPEG dosyalari FF D8 FF ile baslar; sadece ilk uc bayt okunuyor */
  private async isJpeg(filePath: string): Promise<boolean> {
    const handle = await open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(JPEG_MAGIC_BYTES.length);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      return bytesRead === buffer.length && buffer.equals(JPEG_MAGIC_BYTES);
    } finally {
      await handle.close();
    }
  }

  private async deleteFile(filePath: string): Promise<void> {
    try {
      await unlink(resolve(filePath));
    } catch (error) {
      // Dosya zaten yoksa istek basarisiz sayilmasin
      this.logger.warn(
        `Dosya silinemedi: ${filePath} (${(error as Error).message})`,
      );
    }
  }
}
