/**
 * 类名称：RedisSudoStore
 *
 * 函数作用：
 *   Redis 实现的 Sudo 状态存储——授权和检查会话的二次认证状态。
 * Purpose:
 *   Redis-based sudo state store — grants and checks session re-authentication status.
 *
 * 中文关键词：
 *   Sudo，Redis，状态存储
 * English keywords:
 *   sudo, Redis, state store
 */
import { redis } from '../../lib/redis';
import { ISudoStore } from '../../application/identity/ports/ISudoStore';

export class RedisSudoStore implements ISudoStore {
  /**
   * 函数名称：grant
   *
   * 函数作用：
   *   为指定会话授权 sudo 模式（带 TTL 过期）。
   * Purpose:
   *   Grants sudo mode for a session (with TTL).
   */
  public async grant(sessionId: string, ttlSeconds: number): Promise<void> {
    await redis.set(`sudo:${sessionId}`, 'true', 'EX', ttlSeconds);
  }

  /**
   * 函数名称：check
   *
   * 函数作用：
   *   检查指定会话是否处于 sudo 模式。
   * Purpose:
   *   Checks if a session is in sudo mode.
   */
  public async check(sessionId: string): Promise<boolean> {
    return (await redis.get(`sudo:${sessionId}`)) === 'true';
  }
}
