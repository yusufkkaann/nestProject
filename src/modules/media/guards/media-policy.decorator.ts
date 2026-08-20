import { SetMetadata } from '@nestjs/common';

export const OWNER_ONLY_KEY = 'mediaOwnerOnly';

/**
 * Isaretli uclara izin verilmis kullanicilar giremez, yalnizca sahip ve admin.
 * Isaretsiz uclarda sahip + izinli + admin gecebilir.
 */
export const OwnerOnly = () => SetMetadata(OWNER_ONLY_KEY, true);
