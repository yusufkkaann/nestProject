import { SetMetadata } from '@nestjs/common';

export const OWNER_ONLY_KEY = 'mediaOwnerOnly';

/**
 * Isaretli uclara yalnizca dosya sahibi (ve admin) erisebilir;
 * izin verilmis kullanicilar erisemez.
 *
 * Isaretsiz uclarda varsayilan politika: sahip, izinli kullanici veya admin.
 */
export const OwnerOnly = () => SetMetadata(OWNER_ONLY_KEY, true);
