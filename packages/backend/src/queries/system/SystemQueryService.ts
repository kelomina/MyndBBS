import { prisma } from '../../db';

/**
 * Callers: [adminController]
 * Callees: [prisma.routeWhitelist]
 * Description: Query service for system-level configuration data (e.g., route whitelists).
 * Keywords: query, service, system, configuration, whitelist
 */
export class SystemQueryService {
  /**
   * Callers: [adminController.getRouteWhitelist]
   * Callees: [prisma.routeWhitelist.findMany]
   * Description: Lists all entries in the route whitelist configuration.
   * Keywords: system, whitelist, routes, list
   */
  public async listRouteWhitelist() {
    return prisma.routeWhitelist.findMany({ orderBy: { createdAt: 'asc' } });
  }
}

export const systemQueryService = new SystemQueryService();