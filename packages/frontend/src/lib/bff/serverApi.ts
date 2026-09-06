import { cookies, headers } from 'next/headers';
import { buildBackendUrl } from './backend';
import { UNLOCK_COOKIE_NAME } from '../rate-limit/unlock-token';

const UNLOCK_HEADER_NAME = 'X-RateLimit-Unlock';

export function serverApiUrl(path: string): string {
  return buildBackendUrl(path);
}

/**
 * 取入站 X-Forwarded-For 首段（受信链首 IP，trim；空则 null）。
 * 只取首段，不信任多段中的其余部分；浏览器直写伪造 XFF 由后端 getClientIp 优先级 + OpenResty 追加链保证不可换桶（F3）。
 */
export function getIncomingForwardedForFirstIp(incomingXff: string | null | undefined): string | null {
  if (!incomingXff) return null;
  const first = incomingXff.split(',')[0]?.trim();
  return first ? first : null;
}

async function buildServerForwardHeaders(initHeaders?: HeadersInit): Promise<Headers> {
  const merged = new Headers(initHeaders);
  if (!merged.has('X-Forwarded-For')) {
    try {
      const headersList = await headers();
      const incomingXff = headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip');
      const firstIp = getIncomingForwardedForFirstIp(incomingXff);
      if (firstIp) merged.set('X-Forwarded-For', firstIp);
    } catch {
      // 非 RSC 上下文（如构建期）无 headers() 时静默跳过，不阻断渲染
    }
  }
  // B1 SSR 同状态：若调用方未显式附解锁头，则读同源 Cookie（unlock-token 双写）附 X-RateLimit-Unlock；
  // 无 Cookie/过期则不附（保持限流态，杜绝刷新绕过）；已显式附头时不覆盖。
  if (!merged.has(UNLOCK_HEADER_NAME)) {
    try {
      const token = await getServerUnlockToken();
      if (token) merged.set(UNLOCK_HEADER_NAME, token);
    } catch {
      // Cookie 不可读时保持不限头（限流态），不阻断渲染
    }
  }
  return merged;
}

/**
 * 服务端读解锁 Cookie（与 unlock-token.ts 同名同编码，双写兼容）。
 * 解析 JSON {token, expiresAt} 并校验过期；过期/缺失/非法一律返回 null（不附头，保持限流）。
 */
export async function getServerUnlockToken(): Promise<string | null> {
  let raw: string | undefined;
  try {
    const store = await cookies();
    raw = store.get(UNLOCK_COOKIE_NAME)?.value;
  } catch {
    raw = undefined;
  }
  // 回退：经 headers().get('cookie') 手工解析（cookies() 不可用时）
  if (!raw) {
    try {
      const headersList = await headers();
      const cookieHeader = headersList.get('cookie');
      if (cookieHeader) {
        const prefix = `${UNLOCK_COOKIE_NAME}=`;
        for (const part of cookieHeader.split(';')) {
          const trimmed = part.trim();
          if (trimmed.startsWith(prefix)) {
            raw = trimmed.slice(prefix.length);
            break;
          }
        }
      }
    } catch {
      return null;
    }
  }
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded) as { token?: unknown; expiresAt?: unknown };
    if (typeof parsed.token !== 'string' || typeof parsed.expiresAt !== 'string') return null;
    const exp = Date.parse(parsed.expiresAt);
    if (Number.isNaN(exp) || exp <= Date.now()) return null;
    return parsed.token;
  } catch {
    return null;
  }
}

/**
 * RSC 直调后端的统一入口（F3 + B1 SSR 同状态）。
 * 用法：`await serverFetch('/api/posts')` 等价于 `fetch(serverApiUrl(...), { cache:'no-store', headers:{X-Forwarded-For:<入站首IP>, X-RateLimit-Unlock:<Cookie有效token>} })`。
 * 覆盖所有 RSC 直调点（/、/recent、/popular、/c/*、/p/[id]、search/wiki/tags 相关 SSR），只取受信链首 IP；
 * B1：有豁免 Cookie 时 SSR 附头回 200 首屏即正常页（不闪），无 Cookie/过期时不附头仍 429（防刷新绕过）。
 */
export async function serverFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = serverApiUrl(path);
  const forwardHeaders = await buildServerForwardHeaders(init?.headers);
  return fetch(url, {
    cache: 'no-store',
    ...init,
    headers: forwardHeaders,
  });
}
