import { CookieOptions, Response } from 'express';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

/**
 * httpOnly  : JavaScript okuyamaz -> XSS ile token calinamaz
 * sameSite  : tarayici cookie'yi capraz siteden gonderemez -> CSRF korumasi
 * secure    : sadece HTTPS uzerinden gonderilir (production)
 * path      : refresh token yalnizca /auth altina gonderilir, gereksiz yere agda dolasmaz
 */
function baseOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
  };
}

/** Token'in kendi son kullanma tarihinden cookie omru hesaplanir; ikisi ayni anda olur */
function maxAgeFromToken(expiresAtSeconds: number): number {
  return Math.max(expiresAtSeconds * 1000 - Date.now(), 0);
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  expiry: { accessExp: number; refreshExp: number },
  isProduction: boolean,
): void {
  const options = baseOptions(isProduction);

  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...options,
    path: '/',
    maxAge: maxAgeFromToken(expiry.accessExp),
  });

  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...options,
    path: '/auth',
    maxAge: maxAgeFromToken(expiry.refreshExp),
  });
}

export function clearAuthCookies(res: Response, isProduction: boolean): void {
  const options = baseOptions(isProduction);
  res.clearCookie(ACCESS_COOKIE, { ...options, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...options, path: '/auth' });
}
