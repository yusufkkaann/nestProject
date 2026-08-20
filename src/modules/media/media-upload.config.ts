import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { extname } from 'node:path';

import { UnsupportedMediaTypeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModuleOptions } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

const ALLOWED_MIME_TYPES = ['image/jpeg'];
// Ayni formatin iki uzantisi, ikisinin de mime type'i image/jpeg
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg'];

/** Dosya adini sunucu uretiyor; kullanici girdisi dosya sistemine hic gecmiyor */
const uniqueFileName: MulterCallback<string> = (_req, file, callback) => {
  callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
};

/** Ilk eleme: bildirilen tip ve uzanti. Icerik kontrolu MediaService'te */
const jpegOnlyFilter: MulterCallback<boolean> = (_req, file, callback) => {
  const mimeOk = ALLOWED_MIME_TYPES.includes(file.mimetype);
  const extOk = ALLOWED_EXTENSIONS.includes(
    extname(file.originalname).toLowerCase(),
  );

  if (!mimeOk || !extOk) {
    return callback(
      new UnsupportedMediaTypeException('Yalnizca JPEG kabul edilir'),
      false,
    );
  }
  callback(null, true);
};

type MulterCallback<T> = (
  req: Express.Request,
  file: Express.Multer.File,
  callback: (error: Error | null, result: T) => void,
) => void;

/** Async cunku hedef klasor acilista olusturuluyor */
export async function createMulterOptions(
  config: ConfigService,
): Promise<MulterModuleOptions> {
  const uploadDir = config.getOrThrow<string>('storage.uploadDir');
  await mkdir(uploadDir, { recursive: true });

  return {
    storage: diskStorage({ destination: uploadDir, filename: uniqueFileName }),
    limits: {
      fileSize: config.getOrThrow<number>('storage.maxFileSize'),
      files: 1,
    },
    fileFilter: jpegOnlyFilter,
  };
}
