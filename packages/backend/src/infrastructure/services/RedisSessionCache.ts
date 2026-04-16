import { redis } from '../../lib/redis';
import { ISessionCache } from '../../application/identity/ports/ISessionCache';

export class RedisSessionCache implements ISessionCache {
  public async revokeSession(sessionId: string): Promise<void> {
    await redis.del(`session:${sessionId}`);
  }

  public async markSessionRequiresRefresh(sessionId: string, ttlSeconds: number): Promise<void> {
    await redis.set(`session:${sessionId}:requires_refresh`, 'true', 'EX', ttlSeconds);
  }
}
