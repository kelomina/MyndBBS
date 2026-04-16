import { IAbilityCache } from '../../domain/identity/IAbilityCache';
import { redis } from '../../lib/redis';

export class RedisAbilityCache implements IAbilityCache {
  public async invalidateUserRules(userId: string): Promise<void> {
    await redis.del(`ability_rules:user:${userId}`);
  }

  public async invalidateUsersRules(userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    const pipeline = redis.pipeline();
    for (const userId of userIds) {
      pipeline.del(`ability_rules:user:${userId}`);
    }
    await pipeline.exec();
  }
}
