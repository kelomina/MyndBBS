import { redis } from '../../lib/redis';
import { ISessionCache } from '../../application/identity/ports/ISessionCache';

export class RedisSessionCache implements ISessionCache {
  public async revokeSession(sessionId: string): Promise<void> {
    await redis.del(`session:${sessionId}`);
  }

  public async markSessionRequiresRefresh(sessionId: string, ttlSeconds: number): Promise<void> {
    await redis.set(`session:${sessionId}:requires_refresh`, 'true', 'EX', ttlSeconds);
  }

  public async getSessionValidity(sessionId: string): Promise<'valid' | 'invalid' | null> {
    const val = await redis.get(`session:${sessionId}`);
    return val as 'valid' | 'invalid' | null;
  }

  public async setSessionValidity(sessionId: string, validity: 'valid' | 'invalid', ttlSeconds: number): Promise<void> {
    await redis.set(`session:${sessionId}`, validity, 'EX', ttlSeconds);
  }

  public async checkRequiresRefresh(sessionId: string): Promise<boolean> {
    const val = await redis.get(`session:${sessionId}:requires_refresh`);
    return val === 'true';
  }

  public async extendRefreshGracePeriod(sessionId: string, ttlSeconds: number): Promise<void> {
    await redis.expire(`session:${sessionId}:requires_refresh`, ttlSeconds);
  }

  public async storeTotpSecret(userId: string, secret: string, ttlSeconds: number): Promise<void> {
    await redis.set(`totp_setup:${userId}`, secret, 'EX', ttlSeconds);
  }

  public async getTotpSecret(userId: string): Promise<string | null> {
    return await redis.get(`totp_setup:${userId}`);
  }

  public async removeTotpSecret(userId: string): Promise<void> {
    await redis.del(`totp_setup:${userId}`);
  }
}
