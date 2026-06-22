import type { WhitelistRoute } from './types';
import { normalizePathname } from './types';
import { sortWhitelist } from '../lib/routingGuard';

let cachedWhitelist: WhitelistRoute[] | null = null;
let lastFetchTime = 0;

const FALLBACK_WHITELIST: WhitelistRoute[] = sortWhitelist([
  { path: '/api', isPrefix: true, minRole: null, description: 'Fallback API prefix' },
  { path: '/terms', isPrefix: false, minRole: null, description: 'Fallback terms page' },
  { path: '/privacy', isPrefix: false, minRole: null, description: 'Fallback privacy page' },
  { path: '/forgot-password', isPrefix: false, minRole: null, description: 'Fallback password reset request page' },
  { path: '/reset-password', isPrefix: false, minRole: null, description: 'Fallback password reset completion page' },
  { path: '/wikis', isPrefix: true, minRole: null, description: 'Fallback wiki routes' },
  { path: '/admin', isPrefix: true, minRole: 'MODERATOR', description: 'Fallback admin routes' },
]);

function mergeWithFallbackWhitelist(routes: WhitelistRoute[]): WhitelistRoute[] {
  const merged = new Map<string, WhitelistRoute>();

  for (const route of FALLBACK_WHITELIST) {
    merged.set(`${route.path}:${route.isPrefix ? 'prefix' : 'exact'}`, route);
  }

  for (const route of routes) {
    const normalizedRoute = {
      ...route,
      path: normalizePathname(route.path),
    };
    merged.set(
      `${normalizedRoute.path}:${normalizedRoute.isPrefix ? 'prefix' : 'exact'}`,
      normalizedRoute,
    );
  }

  // `/admin` is a built-in protected product area. Keep it available even when
  // the database whitelist was created before this route existed.
  merged.set('/admin:prefix', {
    path: '/admin',
    isPrefix: true,
    minRole: 'MODERATOR',
    description: 'Built-in admin routes',
  });

  return sortWhitelist([...merged.values()]);
}

export async function getWhitelist(): Promise<WhitelistRoute[]> {
  const now = Date.now();
  if (cachedWhitelist && now - lastFetchTime < 30000) {
    return cachedWhitelist;
  }
  try {
    const apiUrl = process.env.API_URL || 'http://127.0.0.1:3001';
    const res = await fetch(`${apiUrl}/api/public/routing-whitelist`, {
      next: { revalidate: 30 },
    });
    if (res.ok) {
      const data = (await res.json()) as WhitelistRoute[];
      cachedWhitelist = mergeWithFallbackWhitelist(data);
      lastFetchTime = now;
      return cachedWhitelist;
    }
  } catch {
    // fetch failed silently
  }
  return cachedWhitelist || FALLBACK_WHITELIST;
}
