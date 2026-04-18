import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

// Mock Redis for environments without it
class MockRedis {
  private data = new Map<string, string>();
  private expirations = new Map<string, NodeJS.Timeout>();

  async get(key: string) {
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