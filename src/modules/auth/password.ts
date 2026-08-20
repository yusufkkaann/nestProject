import * as argon2 from 'argon2';

/**
 * OWASP onerisi (Argon2id): m=19MiB, t=2, p=1.
 * Bellek maliyeti sayesinde GPU/ASIC ile paralel deneme ekonomik olmaktan cikar.
 */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} satisfies argon2.HashOptions;

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

/** Bozuk hash formatinda argon2 exception atar; bu durum da basarisiz dogrulama sayilir */
export async function verifyPassword(
  hash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
