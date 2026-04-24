export type RouteWhitelistSeedRecord = {
  id: string;
  path: string;
  isPrefix: boolean;
  minRole: string | null;
  description: string;
};

export type RouteWhitelistSeedPort = {
  routeWhitelist: {
    findUnique(args: { where: { path: string } }): Promise<unknown | null>;
    create(args: { data: RouteWhitelistSeedRecord }): Promise<unknown>;
  };
};

export const DEFAULT_ROUTE_WHITELIST_ROUTES: ReadonlyArray<RouteWhitelistSeedRecord> = [
  {
    id: '00000000-0000-0000-0000-000000000000',
    path: '/api',
    isPrefix: true,
    minRole: null,
    description: 'Global API prefix whitelist (managed internally)',
  },
  {
    id: '00000000-0000-0000-0000-000000000001',
    path: '/terms',
    isPrefix: false,
    minRole: null,
    description: 'Public terms of service page',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    path: '/privacy',
    isPrefix: false,
    minRole: null,
    description: 'Public privacy policy page',
  },
];

/**
 * Callers: [seed.ts main, seedRouteWhitelist.integration.test.ts]
 * Callees: [findUnique, create, log]
 * Description: Ensures the built-in public route whitelist entries exist so legal pages and internal API prefixes remain reachable after installation.
 * 描述：确保内置公共路由白名单存在，使法律页面和内部 API 前缀在安装完成后始终可达。
 * Variables: `prismaClient` 表示最小化的白名单持久化端口；`route` 表示当前检查的默认白名单记录；`existingRoute` 表示数据库中已存在的匹配项。
 * 变量：`prismaClient` 表示最小化的白名单持久化端口；`route` 表示当前检查的默认白名单记录；`existingRoute` 表示数据库中已存在的匹配项。
 * Integration: Reuse this helper in tests by passing a mocked `routeWhitelist` port, and in production seeding by passing the real Prisma client.
 * 接入方式：测试中传入模拟 `routeWhitelist` 端口复用本函数；生产种子流程中传入真实 Prisma 客户端。
 * Error Handling: Propagates repository errors to the caller so the overall seed process can fail loudly instead of silently skipping required routes.
 * 错误处理：把仓储异常继续抛给调用方，让整个种子流程显式失败，而不是静默跳过必需路由。
 * Keywords: route whitelist, seed defaults, public routes, legal pages, bootstrap, 路由白名单, 种子默认值, 公共路由, 法律页面, 引导
 */
export async function ensureDefaultRouteWhitelist(prismaClient: RouteWhitelistSeedPort): Promise<void> {
  for (const route of DEFAULT_ROUTE_WHITELIST_ROUTES) {
    const existingRoute = await prismaClient.routeWhitelist.findUnique({ where: { path: route.path } });
    if (!existingRoute) {
      await prismaClient.routeWhitelist.create({ data: route });
      console.log(`Added ${route.path} to route whitelist`);
    }
  }
}
