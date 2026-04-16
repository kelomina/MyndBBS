import { redis } from '../../lib/redis';
import { ISudoStore } from '../../application/identity/ports/ISudoStore';

export class RedisSudoStore implements ISudoStore {
  public async grant(sessionId: string, ttlSeconds: number): Promise<void> {
    await redis.set(`sudo:${sessionId}`, 'true', 'EX', ttlSeconds);
  }
  public async check(sessionId: string): Promise<boolean> {
    return (await redis.get(`sudo:${sessionId}`)) === 'true';
  }
}
