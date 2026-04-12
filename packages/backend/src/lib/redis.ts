import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

// Mock Redis for environments without it
class MockRedis {
  private data = new Map<string, string>();
  private expirations = new Map<string, NodeJS.Timeout>();

  /**
     * Callers: []
     * Callees: [get]
     * Description: Handles the get logic for the application.
     * Keywords: get, auto-annotated
     */
    async get(key: string) {
    return this.data.get(key) || null;
  }
  
  /**
     * Callers: []
     * Callees: [set, get, clearTimeout, setTimeout, delete]
     * Description: Handles the set logic for the application.
     * Keywords: set, auto-annotated
     */
    async set(key: string, value: string, mode?: string, duration?: number) {
    this.data.set(key, value);
    if (mode === 'EX' && duration) {
      const existing = this.expirations.get(key);
      if (existing) clearTimeout(existing);
      
      /**
       * Callers: [setTimeout]
       * Callees: [delete]
       * Description: An anonymous timeout callback that deletes the key from the mock store upon expiration.
       * Keywords: redis, mock, timeout, expire, anonymous
       */
      this.expirations.set(key, setTimeout(() => {
        this.data.delete(key);
        this.expirations.delete(key);
      }, duration * 1000));
    }
    return 'OK';
  }

  /**
     * Callers: []
     * Callees: [delete, get, clearTimeout]
     * Description: Handles the del logic for the application.
     * Keywords: del, auto-annotated
     */
    async del(key: string) {
    this.data.delete(key);
    const existing = this.expirations.get(key);
    if (existing) {
      clearTimeout(existing);
      this.expirations.delete(key);
    }
    return 1;
  }

  /**
     * Callers: []
     * Callees: [push, del, set, op]
     * Description: Handles the pipeline logic for the application.
     * Keywords: pipeline, auto-annotated
     */
    pipeline() {
    const operations: (() => void)[] = [];
    return {
      /**
       * Callers: [revokeUserSessions]
       * Callees: [push, del]
       * Description: Mocks the pipeline del method by queuing a del operation.
       * Keywords: redis, mock, pipeline, delete, anonymous
       */
      del: (key: string) => {
        operations.push(() => this.del(key));
        return this;
      },
      /**
       * Callers: []
       * Callees: [push, set]
       * Description: Mocks the pipeline set method by queuing a set operation.
       * Keywords: redis, mock, pipeline, set, anonymous
       */
      set: (key: string, value: string, mode?: string, duration?: number) => {
        operations.push(() => this.set(key, value, mode, duration));
        return this;
      },
      /**
       * Callers: [revokeUserSessions]
       * Callees: [op]
       * Description: Mocks the pipeline exec method by executing all queued operations.
       * Keywords: redis, mock, pipeline, execute, anonymous
       */
      exec: async () => {
        for (const op of operations) {
          await op();
        }
        return [];
      }
    };
  }

  /**
     * Callers: []
     * Callees: [get, set]
     * Description: Handles the expire logic for the application.
     * Keywords: expire, auto-annotated
     */
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
  /**
   * Callers: []
   * Callees: [min]
   * Description: Strategy to compute the retry delay for Redis connections.
   * Keywords: redis, connection, retry, strategy, anonymous
   */
  retryStrategy: (times) => {
    // 限制重试间隔，最大延迟为 2 秒
    return Math.min(times * 50, 2000);
  },
}) : new MockRedis() as unknown as Redis;

if (redisUrl) {
  /**
   * Callers: []
   * Callees: [error]
   * Description: An anonymous error event listener callback for the Redis client.
   * Keywords: redis, error, listener, catch, anonymous
   */
  (redis as Redis).on('error', (err) => {
    console.error('[Redis Error]', err.message);
  });

  /**
   * Callers: []
   * Callees: [log]
   * Description: An anonymous connect event listener callback for the Redis client.
   * Keywords: redis, connect, listener, anonymous
   */
  (redis as Redis).on('connect', () => {
    console.log('[Redis] Connected successfully');
  });
}

export default redis;
