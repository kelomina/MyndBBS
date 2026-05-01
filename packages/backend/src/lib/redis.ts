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
    return this.data.get(key) || null;
  }
  
  async set(key: string, value: string, mode?: string, duration?: number) {
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

  async del(key: string) {
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
    return {
      del: (key: string) => {
        operations.push(() => this.del(key));
        return this;
      },
      exec: async () => {
        for (const op of operations) {
          await op();
        }
        return [];
      }
    };
  }

  async expire(key: string, seconds: number) {
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