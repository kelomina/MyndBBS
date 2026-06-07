/**
 * 类名称：RedisSessionCache
 *
 * 函数作用：
 *   基于 Redis 的会话缓存实现，支持会话有效性检查、强制刷新标记、TOTP secret 临时存储（加密）。
 * Purpose:
 *   Redis-based session cache implementation supporting session validity checks, forced refresh flags,
 *   and encrypted TOTP secret temporary storage.
 *
 * 调用方 / Called by:
 *   - AuthApplicationService
 *   - middleware/auth.ts requireAuth
 *   - registry.ts
 *
 * 中文关键词：
 *   Redis，会话缓存，TOTP，会话恢复
 * English keywords:
 *   Redis, session cache, TOTP, session validity
 */
import { redis } from '../../lib/redis';
import { ISessionCache } from '../../application/identity/ports/ISessionCache';
import { TotpEncryptionService } from './identity/TotpEncryptionService';

export class RedisSessionCache implements ISessionCache {
  constructor(private totpEncryptionService?: TotpEncryptionService) {}

  /**
   * 函数名称：revokeSession
   *
   * 函数作用：
   *   从 Redis 中删除会话记录，使其立即失效。
   * Purpose:
   *   Deletes a session record from Redis, making it immediately invalid.
   */
  public async revokeSession(sessionId: string): Promise<void> {
    await redis.del(`session:${sessionId}`);
  }

  /**
   * 函数名称：markSessionRequiresRefresh
   *
   * 函数作用：
   *   将会话标记为"需要刷新 access token"，下次请求时自动签发新令牌。
   * Purpose:
   *   Marks a session as "requiring refresh" — the next request will receive a new access token.
   */
  public async markSessionRequiresRefresh(sessionId: string, ttlSeconds: number): Promise<void> {
    await redis.set(`session:${sessionId}:requires_refresh`, 'true', 'EX', ttlSeconds);
  }

  /**
   * 函数名称：getSessionValidity
   *
   * 函数作用：
   *   从 Redis 获取会话的有效性状态（valid / invalid）。
   * Purpose:
   *   Gets the session validity status (valid/invalid) from Redis.
   */
  public async getSessionValidity(sessionId: string): Promise<'valid' | 'invalid' | null> {
    const val = await redis.get(`session:${sessionId}`);
    return val as 'valid' | 'invalid' | null;
  }

  /**
   * 函数名称：setSessionValidity
   *
   * 函数作用：
   *   将会话有效性状态写入 Redis，支持 TTL。
   * Purpose:
   *   Sets the session validity status in Redis with TTL.
   */
  public async setSessionValidity(sessionId: string, validity: 'valid' | 'invalid', ttlSeconds: number): Promise<void> {
    await redis.set(`session:${sessionId}`, validity, 'EX', ttlSeconds);
  }

  /**
   * 函数名称：checkRequiresRefresh
   *
   * 函数作用：
   *   检查会话是否需要刷新 access token。
   * Purpose:
   *   Checks whether the session requires an access token refresh.
   */
  public async checkRequiresRefresh(sessionId: string): Promise<boolean> {
    const val = await redis.get(`session:${sessionId}:requires_refresh`);
    return val === 'true';
  }

  /**
   * 函数名称：extendRefreshGracePeriod
   *
   * 函数作用：
   *   延长会话刷新标记的有效期，给并发请求留出缓冲时间。
   * Purpose:
   *   Extends the session refresh flag TTL to give concurrent requests a buffer window.
   */
  public async extendRefreshGracePeriod(sessionId: string, ttlSeconds: number): Promise<void> {
    await redis.expire(`session:${sessionId}:requires_refresh`, ttlSeconds);
  }

  /**
   * 函数名称：storeTotpSecret
   *
   * 函数作用：
   *   临时存储 TOTP 设置密钥（加密后），用于 2FA 注册流程。
   * Purpose:
   *   Temporarily stores (encrypted) TOTP setup secret for the 2FA registration flow.
   */
  public async storeTotpSecret(userId: string, secret: string, ttlSeconds: number): Promise<void> {
    const encrypted = this.totpEncryptionService
      ? this.totpEncryptionService.encrypt(secret)
      : secret;
    await redis.set(`totp_setup:${userId}`, encrypted, 'EX', ttlSeconds);
  }

  /**
   * 函数名称：getTotpSecret
   *
   * 函数作用：
   *   读取已加密存储的 TOTP 设置密钥（解密后返回）。
   * Purpose:
   *   Retrieves and decrypts the stored TOTP setup secret.
   */
  public async getTotpSecret(userId: string): Promise<string | null> {
    const raw = await redis.get(`totp_setup:${userId}`);
    if (!raw) return null;
    if (this.totpEncryptionService && this.totpEncryptionService.isEncrypted(raw)) {
      return this.totpEncryptionService.decrypt(raw);
    }
    return raw;
  }

  /**
   * 函数名称：removeTotpSecret
   *
   * 函数作用：
   *   删除 TOTP 设置密钥。
   * Purpose:
   *   Deletes the TOTP setup secret.
   */
  public async removeTotpSecret(userId: string): Promise<void> {
    await redis.del(`totp_setup:${userId}`);
  }
}
