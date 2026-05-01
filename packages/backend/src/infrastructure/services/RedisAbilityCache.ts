/**
 * 类名称：RedisAbilityCache
 *
 * 函数作用：
 *   Redis 实现的权限缓存——使能力规则缓存失效。
 * Purpose:
 *   Redis-based ability cache — invalidates cached ability rules.
 *
 * 中文关键词：
 *   Redis，权限缓存，失效
 * English keywords:
 *   Redis, ability cache, invalidation
 */
import { IAbilityCache } from '../../domain/identity/IAbilityCache';
import { redis } from '../../lib/redis';

export class RedisAbilityCache implements IAbilityCache {
  /**
   * 函数名称：invalidateUserRules
   *
   * 函数作用：
   *   使指定用户的权限规则缓存失效。
   * Purpose:
   *   Invalidates cached ability rules for a specific user.
   */
  public async invalidateUserRules(userId: string): Promise<void> {
    await redis.del(`ability_rules:user:${userId}`);
  }

  /**
   * 函数名称：invalidateUsersRules
   *
   * 函数作用：
   *   批量使多个用户的权限规则缓存失效。
   * Purpose:
   *   Invalidates cached ability rules for multiple users in batch.
   */
  public async invalidateUsersRules(userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    const pipeline = redis.pipeline();
    for (const userId of userIds) {
      pipeline.del(`ability_rules:user:${userId}`);
    }
    await pipeline.exec();
  }
}
