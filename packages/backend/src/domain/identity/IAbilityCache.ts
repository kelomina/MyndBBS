/**
 * 接口名称：IAbilityCache
 *
 * 函数作用：
 *   权限缓存接口——定义使权限规则缓存失效的契约。
 * Purpose:
 *   Ability cache interface — defines the contract for invalidating cached ability rules.
 *
 * 中文关键词：
 *   权限缓存，接口
 * English keywords:
 *   ability cache, interface
 */
export interface IAbilityCache {
  invalidateUserRules(userId: string): Promise<void>;
  invalidateUsersRules(userIds: string[]): Promise<void>;
}
