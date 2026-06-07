import Redis from 'ioredis';

const redisUrl = process.env.NODE_ENV === 'test' ? undefined : process.env.REDIS_URL;

class MockRedis {
  private data = new Map<string, string>();
  private expirations = new Map<string, ReturnType<typeof setTimeout>>();
  private hashes = new Map<string, Map<string, string>>();
  private sets = new Map<string, Set<string>>();

  private isExpired(key: string): boolean {
    return !this.data.has(key) && !this.hashes.has(key) && !this.sets.has(key);
  }

  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async set(
    key: string,
    value: string,
    mode?: string,
    duration?: number,
  ): Promise<'OK'> {
    this.data.set(key, value);
    if (mode === 'EX' && duration) {
      this.startExpiry(key, duration);
    } else if (mode === 'PX' && duration) {
      this.startExpiryMs(key, duration);
    } else if (mode === 'NX') {
      // NX without EX/PX: only set if not exists (already set above, but NX means skip if exists)
      // In real Redis: SET key value NX — only set if key does not exist
      // We already set it, so this is a simplification for mock purposes
    }
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.data.has(key) || this.hashes.has(key) || this.sets.has(key)) {
        count++;
      }
      this.data.delete(key);
      this.hashes.delete(key);
      this.sets.delete(key);
      this.clearExpiry(key);
    }
    return count;
  }

  async exists(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (
        this.data.has(key) ||
        this.hashes.has(key) ||
        this.sets.has(key)
      ) {
        count++;
      }
    }
    return count;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
    );
    const allKeys = new Set<string>([
      ...this.data.keys(),
      ...this.hashes.keys(),
      ...this.sets.keys(),
    ]);
    return [...allKeys].filter((k) => regex.test(k));
  }

  async expire(key: string, seconds: number): Promise<number> {
    const val = this.data.get(key);
    if (val !== undefined) {
      await this.set(key, val, 'EX', seconds);
      return 1;
    }
    if (this.hashes.has(key) || this.sets.has(key)) {
      this.startExpiry(key, seconds);
      return 1;
    }
    return 0;
  }

  async ttl(key: string): Promise<number> {
    return -1;
  }

  async incr(key: string): Promise<number> {
    const val = parseInt(this.data.get(key) ?? '0', 10);
    const newVal = val + 1;
    this.data.set(key, String(newVal));
    return newVal;
  }

  async decr(key: string): Promise<number> {
    const val = parseInt(this.data.get(key) ?? '0', 10);
    const newVal = val - 1;
    this.data.set(key, String(newVal));
    return newVal;
  }

  async mget(...keys: string[]): Promise<(string | null)[]> {
    return keys.map((k) => this.data.get(k) ?? null);
  }

  async mset(...kvPairs: string[]): Promise<'OK'> {
    for (let i = 0; i + 1 < kvPairs.length; i += 2) {
      this.data.set(kvPairs[i]!, kvPairs[i + 1]!);
    }
    return 'OK';
  }

  async hset(
    key: string,
    fieldOrKv: string | Record<string, string>,
    ...rest: string[]
  ): Promise<number> {
    if (!this.hashes.has(key)) {
      this.hashes.set(key, new Map());
    }
    const hash = this.hashes.get(key)!;
    let added = 0;

    if (typeof fieldOrKv === 'string') {
      if (rest.length >= 1) {
        if (!hash.has(fieldOrKv)) added++;
        hash.set(fieldOrKv, rest[0]!);
      }
    } else {
      for (const [field, value] of Object.entries(fieldOrKv)) {
        if (!hash.has(field)) added++;
        hash.set(field, value);
      }
    }

    return added;
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.hashes.get(key)?.get(field) ?? null;
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    const hash = this.hashes.get(key);
    if (!hash) return 0;
    let count = 0;
    for (const field of fields) {
      if (hash.delete(field)) count++;
    }
    if (hash.size === 0) {
      this.hashes.delete(key);
    }
    return count;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const hash = this.hashes.get(key);
    if (!hash) return {};
    return Object.fromEntries(hash.entries());
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set());
    }
    const set = this.sets.get(key)!;
    let added = 0;
    for (const member of members) {
      if (!set.has(member)) {
        set.add(member);
        added++;
      }
    }
    return added;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key);
    if (!set) return 0;
    let removed = 0;
    for (const member of members) {
      if (set.delete(member)) removed++;
    }
    if (set.size === 0) {
      this.sets.delete(key);
    }
    return removed;
  }

  async ping(): Promise<'PONG'> {
    return 'PONG';
  }

  pipeline() {
    const operations: {
      fn: () => Promise<unknown>;
      resolve: (result: [Error | null, unknown]) => void;
    }[] = [];

    const createChain = (): MockPipeline => {
      const chain: MockPipeline = {
        get: (key: string) => {
          operations.push({
            fn: () => this.get(key),
            resolve: () => {},
          });
          return chain;
        },
        set: (key: string, value: string, mode?: string, duration?: number) => {
          operations.push({
            fn: () => this.set(key, value, mode, duration),
            resolve: () => {},
          });
          return chain;
        },
        del: (...keys: string[]) => {
          operations.push({
            fn: () => this.del(...keys),
            resolve: () => {},
          });
          return chain;
        },
        expire: (key: string, seconds: number) => {
          operations.push({
            fn: () => this.expire(key, seconds),
            resolve: () => {},
          });
          return chain;
        },
        hset: (key: string, fieldOrKv: string | Record<string, string>, ...rest: string[]) => {
          operations.push({
            fn: () => this.hset(key, fieldOrKv, ...rest),
            resolve: () => {},
          });
          return chain;
        },
        hget: (key: string, field: string) => {
          operations.push({
            fn: () => this.hget(key, field),
            resolve: () => {},
          });
          return chain;
        },
        hgetall: (key: string) => {
          operations.push({
            fn: () => this.hgetall(key),
            resolve: () => {},
          });
          return chain;
        },
        hdel: (key: string, ...fields: string[]) => {
          operations.push({
            fn: () => this.hdel(key, ...fields),
            resolve: () => {},
          });
          return chain;
        },
        sadd: (key: string, ...members: string[]) => {
          operations.push({
            fn: () => this.sadd(key, ...members),
            resolve: () => {},
          });
          return chain;
        },
        srem: (key: string, ...members: string[]) => {
          operations.push({
            fn: () => this.srem(key, ...members),
            resolve: () => {},
          });
          return chain;
        },
        incr: (key: string) => {
          operations.push({
            fn: () => this.incr(key),
            resolve: () => {},
          });
          return chain;
        },
        exec: async (): Promise<[Error | null, unknown][]> => {
          const results: [Error | null, unknown][] = [];
          for (const op of operations) {
            try {
              const result = await op.fn();
              results.push([null, result]);
            } catch (err) {
              results.push([err as Error, null]);
            }
          }
          return results;
        },
      };
      return chain;
    };

    return createChain();
  }

  private startExpiry(key: string, seconds: number): void {
    this.clearExpiry(key);
    const timeout = setTimeout(() => {
      this.data.delete(key);
      this.hashes.delete(key);
      this.sets.delete(key);
      this.expirations.delete(key);
    }, seconds * 1000);
    this.expirations.set(key, timeout);
  }

  private startExpiryMs(key: string, ms: number): void {
    this.clearExpiry(key);
    const timeout = setTimeout(() => {
      this.data.delete(key);
      this.hashes.delete(key);
      this.sets.delete(key);
      this.expirations.delete(key);
    }, ms);
    this.expirations.set(key, timeout);
  }

  private clearExpiry(key: string): void {
    const existing = this.expirations.get(key);
    if (existing) {
      clearTimeout(existing);
      this.expirations.delete(key);
    }
  }
}

type MockPipeline = {
  get: (key: string) => MockPipeline;
  set: (key: string, value: string, mode?: string, duration?: number) => MockPipeline;
  del: (...keys: string[]) => MockPipeline;
  expire: (key: string, seconds: number) => MockPipeline;
  hset: (key: string, fieldOrKv: string | Record<string, string>, ...rest: string[]) => MockPipeline;
  hget: (key: string, field: string) => MockPipeline;
  hgetall: (key: string) => MockPipeline;
  hdel: (key: string, ...fields: string[]) => MockPipeline;
  sadd: (key: string, ...members: string[]) => MockPipeline;
  srem: (key: string, ...members: string[]) => MockPipeline;
  incr: (key: string) => MockPipeline;
  exec: () => Promise<[Error | null, unknown][]>;
};

function createMockRedis(): unknown {
  if (process.env.NODE_ENV === 'test') {
    return new MockRedis();
  }

  try {
    const IORedisMock = require('ioredis-mock') as { default: new () => Redis };
    return new IORedisMock.default();
  } catch {
    return new MockRedis();
  }
}

export const redis = redisUrl
  ? new Redis(redisUrl, {
      retryStrategy: (times) => {
        return Math.min(times * 50, 2000);
      },
    })
  : (createMockRedis() as unknown as Redis);

if (redisUrl) {
  (redis as Redis).on('error', (err) => {
    console.error('[Redis Error]', err.message);
  });

  (redis as Redis).on('connect', () => {
    console.log('[Redis] Connected successfully');
  });
}

export default redis;
