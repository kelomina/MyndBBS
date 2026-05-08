/**
 * 模块：Redis 客户端
 *
 * 函数作用：
 *   提供 Redis 客户端实例。当 REDIS_URL 环境变量未设置时，使用内存 MockRedis 作为降级方案。
 * Purpose:
 *   Provides a Redis client instance. Falls back to an in-memory MockRedis when REDIS_URL is not set.
 *
 * 中文关键词：
 *   Redis，ioredis，内存模拟，缓存
 * English keywords:
 *   Redis, ioredis, mock, cache
 */
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

/**
 * 类名称：MockRedis
 *
 * 函数作用：
 *   内存实现的简易 Redis 兼容类，支持 get/set(含 EX 过期)/del/pipeline/expire。
 *   用于无 Redis 环境的开发或测试场景。
 * Purpose:
 *   In-memory Redis-compatible class supporting get/set(with EX TTL)/del/pipeline/expire.
 *   Used for development or testing environments without Redis.
 *
 * 中文关键词：
 *   内存 Redis，模拟，Mock，开发环境
 * English keywords:
 *   in-memory Redis, mock, development
 */
class MockRedis {
  private data = new Map<string, string>();
  private expirations = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Function name:
   *   get
   *
   * Purpose:
   *   Reads an in-memory Redis value for development and test environments without REDIS_URL.
   *
   * Called by:
   *   RedisSessionCache, RedisSudoStore, RedisModeratedWordsCache, AccessControlQueryService,
   *   RedisEmailRegistrationTicketRepository, RedisPasswordResetTicketRepository.
   *
   * Calls:
   *   Map.get.
   *
   * Parameters:
   *   - key: string, Redis key, required.
   *
   * Returns:
   *   Promise<string | null>, cached value or null when the key is absent.
   *
   * Error handling:
   *   Does not throw for missing keys.
   *
   * Side effects:
   *   None.
   *
   * Transaction boundary:
   *   None.
   *
   * Concurrency and idempotency:
   *   Single-process in-memory store; repeat reads are idempotent until set/del/expire changes state.
   *
   * English keywords:
   *   redis, mock, memory, cache, get, fallback, development, test, key, value
   */
  async get(key: string): Promise<string | null> {
    return this.data.get(key) || null;
  }
  
  /**
   * Function name:
   *   set
   *
   * Purpose:
   *   Writes an in-memory Redis value and optionally applies EX-style TTL expiration.
   *
   * Called by:
   *   RedisSessionCache, RedisSudoStore, RedisModeratedWordsCache,
   *   RedisEmailRegistrationTicketRepository, RedisPasswordResetTicketRepository.
   *
   * Calls:
   *   Map.set, setTimeout, clearTimeout.
   *
   * Parameters:
   *   - key: string, Redis key, required.
   *   - value: string, value to store, required.
   *   - mode: string | undefined, supports EX for TTL mode.
   *   - duration: number | undefined, TTL seconds when mode is EX.
   *
   * Returns:
   *   Promise<'OK'>, Redis-compatible success marker.
   *
   * Error handling:
   *   Does not throw for unsupported mode; stores the value without TTL.
   *
   * Side effects:
   *   Writes in-memory data and may register a timer.
   *
   * Transaction boundary:
   *   None.
   *
   * Concurrency and idempotency:
   *   Single-process in-memory store; repeated set overwrites the prior value and timer.
   *
   * English keywords:
   *   redis, mock, memory, cache, set, ttl, expire, fallback, development, test
   */
  async set(key: string, value: string, mode?: string, duration?: number): Promise<'OK'> {
    this.data.set(key, value);
    if (mode === 'EX' && duration) {
      const existing = this.expirations.get(key);
      if (existing) clearTimeout(existing);
      
      const timeout = setTimeout(() => {
        this.data.delete(key);
        this.expirations.delete(key);
      }, duration * 1000);
      this.expirations.set(key, timeout);
    }
    return 'OK';
  }

  /**
   * Function name:
   *   del
   *
   * Purpose:
   *   Deletes an in-memory Redis value and clears any active TTL timer.
   *
   * Called by:
   *   RedisSessionCache, RedisSudoStore, RedisModeratedWordsCache, RedisAbilityCache,
   *   RedisEmailRegistrationTicketRepository, RedisPasswordResetTicketRepository.
   *
   * Calls:
   *   Map.delete, clearTimeout.
   *
   * Parameters:
   *   - key: string, Redis key, required.
   *
   * Returns:
   *   Promise<number>, Redis-compatible delete count.
   *
   * Error handling:
   *   Does not throw for missing keys.
   *
   * Side effects:
   *   Mutates in-memory data and timer maps.
   *
   * Transaction boundary:
   *   None.
   *
   * Concurrency and idempotency:
   *   Single-process in-memory store; repeated deletion is safe.
   *
   * English keywords:
   *   redis, mock, memory, cache, delete, ttl, clear, fallback, development, test
   */
  async del(key: string): Promise<number> {
    this.data.delete(key);
    const existing = this.expirations.get(key);
    if (existing) {
      clearTimeout(existing);
      this.expirations.delete(key);
    }
    return 1;
  }

  pipeline() {
    const operations: (() => void)[] = [];
    const pipeline = {
      del: (key: string) => {
        operations.push(() => this.del(key));
        return pipeline;
      },
      exec: async () => {
        for (const op of operations) {
          await op();
        }
        return [];
      }
    };
    return pipeline;
  }

  /**
   * Function name:
   *   expire
   *
   * Purpose:
   *   Applies a TTL to an existing in-memory Redis value.
   *
   * Called by:
   *   RedisSessionCache.extendRefreshGracePeriod.
   *
   * Calls:
   *   Map.get, MockRedis.set.
   *
   * Parameters:
   *   - key: string, Redis key, required.
   *   - seconds: number, TTL seconds.
   *
   * Returns:
   *   Promise<number>, 1 when the key exists and TTL is applied, otherwise 0.
   *
   * Error handling:
   *   Does not throw for missing keys.
   *
   * Side effects:
   *   Updates the active TTL timer for an existing key.
   *
   * Transaction boundary:
   *   None.
   *
   * Concurrency and idempotency:
   *   Single-process in-memory store; repeated calls replace the prior timer.
   *
   * English keywords:
   *   redis, mock, memory, cache, expire, ttl, timer, fallback, development, test
   */
  async expire(key: string, seconds: number): Promise<number> {
    const val = this.data.get(key);
    if (val !== undefined) {
      await this.set(key, val, 'EX', seconds);
      return 1;
    }
    return 0;
  }
}

export const redis = redisUrl ? new Redis(redisUrl, {
  retryStrategy: (times) => {
    // 限制重试间隔，最大延迟为 2 秒
    return Math.min(times * 50, 2000);
  },
}) : new MockRedis() as unknown as Redis;

if (redisUrl) {
  (redis as Redis).on('error', (err) => {
    console.error('[Redis Error]', err.message);
  });

  (redis as Redis).on('connect', () => {
    console.log('[Redis] Connected successfully');
  });
}

export default redis;
