import { prisma } from '../../db';
import { RouteWhitelistDTO } from './dto';

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
  public async listRouteWhitelist(): Promise<RouteWhitelistDTO[]> {
    const list = await prisma.routeWhitelist.findMany({ orderBy: { createdAt: 'asc' } });
    return list.map(item => ({
      id: item.id,
      path: item.path,
      isPrefix: item.isPrefix,
      minRole: item.minRole,
      description: item.description,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }
}

export const systemQueryService = new SystemQueryService();