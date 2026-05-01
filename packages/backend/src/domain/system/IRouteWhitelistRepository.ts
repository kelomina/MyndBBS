import { RouteWhitelist } from './RouteWhitelist';

/**
 * 接口名称：IRouteWhitelistRepository
 *
 * 函数作用：
 *   路由白名单聚合的仓储接口。
 * Purpose:
 *   Repository interface for RouteWhitelist aggregates.
 *
 * 中文关键词：
 *   路由白名单，仓储接口
 * English keywords:
 *   route whitelist, repository interface
 */
export interface IRouteWhitelistRepository {
  findById(id: string): Promise<RouteWhitelist | null>;
  save(route: RouteWhitelist): Promise<void>;
  delete(id: string): Promise<void>;
}
