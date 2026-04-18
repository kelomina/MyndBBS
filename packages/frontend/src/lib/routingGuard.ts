export interface RouteWhitelistConfig {
  path: string;
  isPrefix: boolean;
  minRole?: string | null;
}

/**
 * Callers: [middleware]
 * Callees: []
 * Description: Sorts the whitelist routes. Exact matches first, then longest prefixes.
 * Keywords: sort, whitelist, routes, middleware
 */
export function sortWhitelist(routes: RouteWhitelistConfig[]): RouteWhitelistConfig[] {
  return [...routes].sort((a, b) => {
    if (a.isPrefix === b.isPrefix) {
      return b.path.length - a.path.length;
    }
    return a.isPrefix ? 1 : -1;
  });
}

/**
 * Callers: [middleware]
 * Callees: []
 * Description: Finds the best matching route for a given pathname from a sorted whitelist.
 * Keywords: match, route, whitelist, middleware
 */
export function matchRoute(pathname: string, whitelist: RouteWhitelistConfig[]): RouteWhitelistConfig | null {
  for (const route of whitelist) {
    if (route.isPrefix) {
      if (route.path === '/' || pathname === route.path || pathname.startsWith(`${route.path}/`)) {
        return route;
      }
    } else {
      if (pathname === route.path) {
        return route;
      }
    }
  }
  return null;
}

/**
 * Callers: [middleware]
 * Callees: []
 * Description: Determines if a redirect to /403 is necessary based on role levels.
 * Keywords: redirect, access, role, middleware
 */
export function getAccessRedirectPath(requiredRoleLevel: number, userRoleLevel: number): string | null {
  if (requiredRoleLevel > 0 && userRoleLevel < requiredRoleLevel) return '/403';
  return null;
}

