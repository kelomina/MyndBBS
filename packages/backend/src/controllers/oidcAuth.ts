import { Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

import { authApplicationService, oidcLoginService } from '../registry';
import { getAuthCookieOptions, getTempTokenSecret, shouldUseSecureCookies } from '../lib/securityConfig';
import { clearAuthCookies, setSessionCookie } from '../lib/authCookies';

export const OIDC_STATE_COOKIE_NAME = 'myndbbs_oidc_state';
const OIDC_STATE_TTL_MS = 10 * 60 * 1000;

interface OidcStateCookiePayload extends JwtPayload {
  state: string;
  codeVerifier: string;
}

function getSingleQueryValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function getOidcCookieOptions() {
  return {
    ...getAuthCookieOptions(OIDC_STATE_TTL_MS),
    path: '/',
  };
}

function getOidcClearCookieOptions() {
  return {
    path: '/',
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: 'lax' as const,
  };
}

function signOidcStateCookie(payload: Omit<OidcStateCookiePayload, keyof JwtPayload>): string {
  return jwt.sign(payload, getTempTokenSecret(), {
    algorithm: 'HS256',
    expiresIn: Math.floor(OIDC_STATE_TTL_MS / 1000),
  });
}

function verifyOidcStateCookie(token: string | undefined): OidcStateCookiePayload | null {
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, getTempTokenSecret(), {
      algorithms: ['HS256'],
    });

    if (!payload || typeof payload === 'string') {
      return null;
    }

    if (typeof payload.state !== 'string' || typeof payload.codeVerifier !== 'string') {
      return null;
    }

    return payload as OidcStateCookiePayload;
  } catch {
    return null;
  }
}

function redirectToLoginFailure(res: Response): void {
  res.redirect('/login?oidc=failed');
}

/**
 * 渲染静默检查页面，用隐藏 iframe 加载 SSO 授权端点（prompt=none）。
 * 通过 postMessage 将结果（code 或 login_required）传回父页面。
 */
export async function renderSilentCheckPage(_req: Request, res: Response): Promise<void> {
  try {
    const authorizationRequest = oidcLoginService.createSilentAuthorizationRequest();

    // 把 state 和 codeVerifier 存到 cookie，供 callback 使用
    res.cookie(
      OIDC_STATE_COOKIE_NAME,
      signOidcStateCookie({
        state: authorizationRequest.state,
        codeVerifier: authorizationRequest.codeVerifier,
      }),
      getOidcCookieOptions(),
    );

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SSO Silent Check</title>
  <style>body{margin:0;padding:0;overflow:hidden;}</style>
</head>
<body>
  <iframe id="sso-frame" src="${authorizationRequest.authorizationUrl}" style="display:none;" sandbox="allow-scripts allow-same-origin allow-forms allow-top-navigation"></iframe>
  <script>
    (function() {
      var allowedOrigins = ['https://kolobbs.kolostudio.fun', 'http://localhost:3100'];
      var parentOrigin = allowedOrigins.find(function(o) {
        try { return window.parent.location.origin === o; } catch(e) { return false; }
      }) || allowedOrigins[0];

      window.addEventListener('message', function(e) {
        // 忽略非父页面的消息
        if (e.source !== window.parent) return;
      });

      // 监听 iframe 内部的 URL 变化（通过轮询检测重定向）
      var frame = document.getElementById('sso-frame');
      var checkCount = 0;
      var maxChecks = 60; // 最多等 6 秒
      var interval = setInterval(function() {
        checkCount++;
        try {
          var frameUrl = frame.contentWindow.location.href;
          // 如果 iframe 已经重定向回我们的 callback URL
          if (frameUrl.indexOf('/api/auth/oidc/callback') !== -1 || frameUrl.indexOf('/api/v1/auth/oidc/callback') !== -1) {
            clearInterval(interval);
            var url = new URL(frameUrl);
            var code = url.searchParams.get('code');
            var error = url.searchParams.get('error');
            if (code) {
              window.parent.postMessage({ type: 'oidc:silent:success', code: code }, parentOrigin);
            } else if (error) {
              window.parent.postMessage({ type: 'oidc:silent:error', error: error }, parentOrigin);
            } else {
              window.parent.postMessage({ type: 'oidc:silent:error', error: 'unknown' }, parentOrigin);
            }
          }
        } catch (e) {
          // 跨域访问 iframe 的 location 会抛异常，说明还在 SSO 域名下
          // 继续等待
        }
        if (checkCount >= maxChecks) {
          clearInterval(interval);
          window.parent.postMessage({ type: 'oidc:silent:error', error: 'timeout' }, parentOrigin);
        }
      }, 100);
    })();
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('[OIDC] Silent check page render failed:', error);
    res.status(500).send('Internal Server Error');
  }
}

export async function startOidcLogin(_req: Request, res: Response): Promise<void> {
  try {
    const authorizationRequest = oidcLoginService.createAuthorizationRequest();

    res.cookie(
      OIDC_STATE_COOKIE_NAME,
      signOidcStateCookie({
        state: authorizationRequest.state,
        codeVerifier: authorizationRequest.codeVerifier,
      }),
      getOidcCookieOptions(),
    );

    console.log('[OIDC] Redirecting to SSO authorization URL');
    console.log('[OIDC] State:', authorizationRequest.state.substring(0, 16) + '...');
    res.redirect(authorizationRequest.authorizationUrl);
  } catch (error) {
    console.error('[OIDC] Login failed:', error);
    redirectToLoginFailure(res);
  }
}

export async function handleOidcCallback(req: Request, res: Response): Promise<void> {
  const code = getSingleQueryValue(req.query.code);
  const state = getSingleQueryValue(req.query.state);
  const stateCookie = verifyOidcStateCookie(req.cookies?.[OIDC_STATE_COOKIE_NAME]);

  res.clearCookie(OIDC_STATE_COOKIE_NAME, getOidcClearCookieOptions());

  if (!code || !state || !stateCookie || state !== stateCookie.state) {
    redirectToLoginFailure(res);
    return;
  }

  try {
    console.log('[OIDC] Callback received: code=' + code.substring(0, 16) + '..., state=' + state.substring(0, 16) + '...');

    const user = await oidcLoginService.exchangeCodeForMyndBbsUser({
      code,
      codeVerifier: stateCookie.codeVerifier,
    });

    const { sessionId } = await authApplicationService.finalizeAuth(
      user,
      req.ip || null,
      req.headers['user-agent'] || null,
      { trustedExternalAuth: true },
    );

    clearAuthCookies(res);
    setSessionCookie(res, sessionId);
    console.log('[OIDC] Login success: user=' + user.email + ', redirect=' + oidcLoginService.getSuccessRedirectPath());
    res.redirect(oidcLoginService.getSuccessRedirectPath());
  } catch (error) {
    console.error('[OIDC] Login failed:', error);
    redirectToLoginFailure(res);
  }
}
