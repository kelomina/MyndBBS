import { RateLimitError, parseRateLimitDetails, UNLOCK_ENDPOINT } from '../rate-limit/errors';
import { getValidUnlockToken, getUnlockHeaderName } from '../rate-limit/unlock-token';

export { RateLimitError, isRateLimitError } from '../rate-limit/errors';

function buildFullUrl(url: string): string {
  if (url.startsWith('/api') || url.startsWith('/uploads')) return url
  const baseUrl = process.env.API_URL || 'http://localhost:3001'
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`
}

function isUnlockEndpoint(url: string): boolean {
  return url === UNLOCK_ENDPOINT || url.endsWith('/captcha/unlock');
}

/** 读请求自动附带 X-RateLimit-Unlock（唯一冻结载体，不引入 Cookie）。 */
function withUnlockHeader(url: string, headers: Headers): void {
  if (isUnlockEndpoint(url)) return;
  if (headers.has(getUnlockHeaderName())) return;
  const token = getValidUnlockToken();
  if (token) headers.set(getUnlockHeaderName(), token);
}

export async function fetchWithAuth(url: string, options?: RequestInit): Promise<Response> {
  const headers = new Headers({ 'X-Requested-With': 'XMLHttpRequest' });
  if (options?.headers) {
    new Headers(options.headers).forEach((value, key) => {
      headers.set(key, value);
    });
  }
  withUnlockHeader(url, headers);
  const { headers: _ignored, ...rest } = options ?? {};
  void _ignored;
  return fetch(buildFullUrl(url), { ...rest, headers, credentials: 'include' });
}

export const fetcher = async (url: string, options?: RequestInit) => {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  });
  if (options?.headers) {
    new Headers(options.headers).forEach((value, key) => {
      headers.set(key, value);
    });
  }
  withUnlockHeader(url, headers);
  const res = await fetch(buildFullUrl(url), {
    ...options,
    headers,
    credentials: 'include',
  })

  if (!res.ok) {
    const fallbackEmptyObject = () => ({})
    const error = (await res.json().catch(fallbackEmptyObject)) as Record<string, unknown>
    const rateLimitDetails = parseRateLimitDetails(res, error);
    if (rateLimitDetails) {
      throw new RateLimitError(rateLimitDetails);
    }
    // 非解锁型 429（含 POST /unlock 自身超限 ERR_RATE_LIMITED，无 unlockRequired）走普通分支，不进解锁循环
    const code = typeof error.error === 'string' ? error.error : 'Request failed';
    const generic = new Error(code);
    (generic as Error & { status?: number; retryAfterSec?: number }).status = res.status;
    const retryAfter = res.headers.get('Retry-After');
    if (retryAfter !== null) {
      const n = Number(retryAfter);
      if (Number.isFinite(n)) {
        (generic as Error & { retryAfterSec?: number }).retryAfterSec = Math.floor(n);
      }
    }
    throw generic;
  }

  return res.json()
}
