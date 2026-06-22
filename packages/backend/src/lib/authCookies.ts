import { Response } from 'express'
import { getAuthCookieOptions, shouldUseSecureCookies } from './securityConfig'

export const AUTH_SESSION_COOKIE_NAME = 'sessionId'
export const AUTH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function setSessionCookie(res: Response, sessionId: string): void {
  res.cookie(AUTH_SESSION_COOKIE_NAME, sessionId, {
    ...getAuthCookieOptions(AUTH_SESSION_TTL_MS),
    path: '/',
  })
}

export function clearAuthCookies(res: Response): void {
  const clearOptions = {
    path: '/',
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: 'lax' as const,
  }

  for (const name of [AUTH_SESSION_COOKIE_NAME, 'accessToken', 'refreshToken', 'last_refresh']) {
    res.clearCookie(name, clearOptions)
    res.clearCookie(name)
  }
}
