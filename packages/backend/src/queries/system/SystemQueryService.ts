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
   * 函数名称：listRouteWhitelist
   *
   * 函数作用：
   *   获取路由白名单中的所有条目。
   * Purpose:
   *   Lists all entries in the route whitelist.
   *
   * 调用方 / Called by:
   *   adminController.getRouteWhitelist → GET /api/admin/routing-whitelist
   *
   * 返回值说明 / Returns:
   *   RouteWhitelistDTO[] 白名单路由列表
   *
   * 副作用 / Side effects:
   *   无——只读查询
   *
   * 中文关键词：
   *   路由白名单，列表
   * English keywords:
   *   route whitelist, list
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

  /**
   * 函数名称：getAuditLogs
   *
   * 函数作用：
   *   获取审计日志列表，支持分页和按操作者/操作类型过滤。
   * Purpose:
   *   Retrieves audit logs with pagination and optional filtering by operator/operation type.
   *
   * 调用方 / Called by:
   *   adminController.getAuditLogs → GET /api/admin/audit-logs
   *
   * 参数说明 / Parameters:
   *   - params.skip: number | undefined, 跳过的记录数
   *   - params.take: number | undefined, 获取的记录数
   *   - params.operatorId: string | undefined, 按操作者 ID 过滤
   *   - params.operationType: string | undefined, 按操作类型过滤
   *
   * 返回值说明 / Returns:
   *   { items: AuditLog[], total: number }
   *
   * 副作用 / Side effects:
   *   无——只读查询
   *
   * 中文关键词：
   *   审计日志，分页，过滤
   * English keywords:
   *   audit log, pagination, filter
   */
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