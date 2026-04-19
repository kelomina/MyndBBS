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

  public async getAuditLogs(params: {
    skip?: number;
    take?: number;
    operatorId?: string;
    operationType?: string;
  }): Promise<{ items: any[]; total: number }> {
    const { skip, take, operatorId, operationType } = params;
    const where: any = {};
    if (operatorId) where.operatorId = operatorId;
    if (operationType) where.operationType = operationType;

    const queryArgs: any = {
      where,
      orderBy: { createdAt: 'desc' },
    };
    if (skip !== undefined) queryArgs.skip = skip;
    if (take !== undefined) queryArgs.take = take;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany(queryArgs),
      prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  }
}

export const systemQueryService = new SystemQueryService();