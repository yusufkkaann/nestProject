import { CookieOptions, Response } from 'express';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

/** httpOnly XSS'e, sameSite CSRF'e karsi. secure yalnizca production'da. */
function baseOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
  };
}

/** Cookie omru token'in exp degerinden gelir, ikisi ayni anda sona erer */
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
