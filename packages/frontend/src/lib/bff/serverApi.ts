import { headers } from 'next/headers';
import { buildBackendUrl } from './backend';

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
  if (merged.has('X-Forwarded-For')) return merged;
  try {
    const headersList = await headers();
    const incomingXff = headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip');
    const firstIp = getIncomingForwardedForFirstIp(incomingXff);
    if (firstIp) merged.set('X-Forwarded-For', firstIp);
  } catch {
    // 非 RSC 上下文（如构建期）无 headers() 时静默跳过，不阻断渲染
  }
  return merged;
}

/**
 * RSC 直调后端的统一入口（F3）。
 * 用法：`await serverFetch('/api/posts')` 等价于 `fetch(serverApiUrl(...), { cache:'no-store', headers:{X-Forwarded-For:<入站首IP>} })`。
 * 覆盖所有 RSC 直调点（/、/recent、/popular、/c/*、/p/[id]、search/wiki/tags 相关 SSR），只取受信链首 IP。
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
