import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { extname } from 'node:path';

import { UnsupportedMediaTypeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModuleOptions } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

const ALLOWED_MIME_TYPES = ['image/jpeg'];
// Ayni formatin iki uzantisi: JPEG standardi, .jpg 8.3 dosya adi sinirindan kalma kisaltma
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg'];

/** Dosya adi sunucuda uretilir: kullanici girdisi dosya sistemine hic gecmez (path traversal) */
const uniqueFileName: MulterCallback<string> = (_req, file, callback) => {
  callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
};

/** Ilk savunma: bildirilen tip ve uzanti. Icerigin gercekten JPEG oldugu MediaService'te dogrulanir */
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

/**
 * Yukleme politikasi tek noktada: hedef klasor, boyut siniri ve tip kontrolu.
 * Async cunku hedef klasor uygulama ayaga kalkarken olusturulur.
 */
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
