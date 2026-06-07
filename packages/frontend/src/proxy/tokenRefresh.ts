import type { NextRequest } from 'next/server';
import type { MiddlewareContext, MiddlewareResult } from './middlewareContext';

async function tryRefreshToken(request: NextRequest): Promise<string | null> {
  const refreshTokenValue = request.cookies.get('refreshToken')?.value;
  if (!refreshTokenValue) return null;

  try {
    const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';
    const res = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: `refreshToken=${refreshTokenValue}`,
      },
    });
    if (res.ok) {
      let newAccessToken: string | null = null;
      if (typeof res.headers.getSetCookie === 'function') {
        const cookies = res.headers.getSetCookie();
        for (const cookie of cookies) {
          const match = cookie.match(/accessToken=([^;]+)/);
          if (match) {
            newAccessToken = match[1];
            break;
          }
        }
      }
      if (!newAccessToken) {
        const sc = res.headers.get('set-cookie');
        if (sc) {
          const match = sc.match(/accessToken=([^;]+)/);
          if (match) {
            newAccessToken = match[1];
          }
        }
      }
      if (newAccessToken) {
        return newAccessToken;
      }
    }
  } catch {
    // refresh failed silently
  }
  return null;
}

function shouldUseSecureCookies(): boolean {
  return process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
}

export async function handleTokenRefresh(request: NextRequest, ctx: MiddlewareContext): Promise<MiddlewareResult> {
  if (!ctx.accessToken) {
    ctx.refreshedAccessToken = await tryRefreshToken(request);
  }

  if (ctx.refreshedAccessToken) {
    ctx.response.cookies.set('accessToken', ctx.refreshedAccessToken, {
      httpOnly: true,
      secure: shouldUseSecureCookies(),
      sameSite: 'lax',
      maxAge: 15 * 60,
      path: '/',
    });
    ctx.response.cookies.set('last_refresh', String(Date.now()), {
      httpOnly: true,
      secure: shouldUseSecureCookies(),
      sameSite: 'lax',
      maxAge: 60 * 60,
      path: '/',
    });
  }

  return null;
}
