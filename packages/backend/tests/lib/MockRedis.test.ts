import { describe, it, expect, beforeEach } from '@jest/globals';

class MockRedis {
  private data = new Map<string, string>();
  private expirations = new Map<string, ReturnType<typeof setTimeout>>();
  private hashes = new Map<string, Map<string, string>>();
  private sets = new Map<string, Set<string>>();

  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<'OK'> {
    this.data.set(key, value);
    if (mode === 'EX' && duration) {
      this.startExpiry(key, duration);
    } else if (mode === 'PX' && duration) {
      this.startExpiryMs(key, duration);
    }
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.data.has(key) || this.hashes.has(key) || this.sets.has(key)) count++;
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
      if (this.data.has(key) || this.hashes.has(key) || this.sets.has(key)) count++;
    }
    return count;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    const allKeys = new Set<string>([...this.data.keys(), ...this.hashes.keys(), ...this.sets.keys()]);
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
    for (let i = 0; i < kvPairs.length; i += 2) {
      this.data.set(kvPairs[i], kvPairs[i + 1]);
    }
    return 'OK';
  }

  async hset(key: string, fieldOrKv: string | Record<string, string>, ...rest: string[]): Promise<number> {
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    const hash = this.hashes.get(key)!;
    let added = 0;
    if (typeof fieldOrKv === 'string') {
      if (rest.length >= 1) {
        if (!hash.has(fieldOrKv)) added++;
        hash.set(fieldOrKv, rest[0]);
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
    if (hash.size === 0) this.hashes.delete(key);
    return count;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const hash = this.hashes.get(key);
    if (!hash) return {};
    return Object.fromEntries(hash.entries());
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.sets.has(key)) this.sets.set(key, new Set());
    const set = this.sets.get(key)!;
    let added = 0;
    for (const member of members) {
      if (!set.has(member)) { set.add(member); added++; }
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
    if (set.size === 0) this.sets.delete(key);
    return removed;
  }

  async ping(): Promise<'PONG'> {
    return 'PONG';
  }

  pipeline() {
    const operations: { fn: () => Promise<unknown> }[] = [];
    const chain = {
      get: (key: string) => { operations.push({ fn: () => this.get(key) }); return chain; },
      set: (key: string, value: string, mode?: string, duration?: number) => { operations.push({ fn: () => this.set(key, value, mode, duration) }); return chain; },
      del: (...keys: string[]) => { operations.push({ fn: () => this.del(...keys) }); return chain; },
      expire: (key: string, seconds: number) => { operations.push({ fn: () => this.expire(key, seconds) }); return chain; },
      hset: (key: string, fieldOrKv: string | Record<string, string>, ...rest: string[]) => { operations.push({ fn: () => this.hset(key, fieldOrKv, ...rest) }); return chain; },
      hget: (key: string, field: string) => { operations.push({ fn: () => this.hget(key, field) }); return chain; },
      hgetall: (key: string) => { operations.push({ fn: () => this.hgetall(key) }); return chain; },
      hdel: (key: string, ...fields: string[]) => { operations.push({ fn: () => this.hdel(key, ...fields) }); return chain; },
      sadd: (key: string, ...members: string[]) => { operations.push({ fn: () => this.sadd(key, ...members) }); return chain; },
      srem: (key: string, ...members: string[]) => { operations.push({ fn: () => this.srem(key, ...members) }); return chain; },
      incr: (key: string) => { operations.push({ fn: () => this.incr(key) }); return chain; },
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
  }

  private startExpiry(key: string, seconds: number): void {
    this.clearExpiry(key);
    const timeout = setTimeout(() => {
      this.data.delete(key); this.hashes.delete(key); this.sets.delete(key); this.expirations.delete(key);
    }, seconds * 1000);
    this.expirations.set(key, timeout);
  }

  private startExpiryMs(key: string, ms: number): void {
    this.clearExpiry(key);
    const timeout = setTimeout(() => {
      this.data.delete(key); this.hashes.delete(key); this.sets.delete(key); this.expirations.delete(key);
    }, ms);
    this.expirations.set(key, timeout);
  }

  private clearExpiry(key: string): void {
    const existing = this.expirations.get(key);
    if (existing) { clearTimeout(existing); this.expirations.delete(key); }
  }
}

describe('MockRedis', () => {
  let redis: MockRedis;

  beforeEach(() => {
    jest.useFakeTimers();
    redis = new MockRedis();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('get/set/del', () => {
    it('should set and get a value', async () => {
      await redis.set('key1', 'value1');
      expect(await redis.get('key1')).toBe('value1');
    });

    it('should return null for missing key', async () => {
      expect(await redis.get('missing')).toBeNull();
    });

    it('should delete a key and return count', async () => {
      await redis.set('key1', 'value1');
      expect(await redis.del('key1')).toBe(1);
      expect(await redis.get('key1')).toBeNull();
    });

    it('should delete multiple keys', async () => {
      await redis.set('a', '1');
      await redis.set('b', '2');
      expect(await redis.del('a', 'b')).toBe(2);
    });

    it('should return 0 for deleting non-existent key', async () => {
      expect(await redis.del('nonexistent')).toBe(0);
    });
  });

  describe('set with EX', () => {
    it('should expire key after TTL', async () => {
      await redis.set('ttlkey', 'val', 'EX', 10);
      expect(await redis.get('ttlkey')).toBe('val');
      jest.advanceTimersByTime(10001);
      expect(await redis.get('ttlkey')).toBeNull();
    });

    it('should replace existing TTL on re-set', async () => {
      await redis.set('ttlkey', 'val', 'EX', 10);
      await redis.set('ttlkey', 'newval', 'EX', 20);
      jest.advanceTimersByTime(10001);
      expect(await redis.get('ttlkey')).toBe('newval');
    });
  });

  describe('set with PX', () => {
    it('should expire key after PX milliseconds', async () => {
      await redis.set('pxkey', 'val', 'PX', 5000);
      expect(await redis.get('pxkey')).toBe('val');
      jest.advanceTimersByTime(5001);
      expect(await redis.get('pxkey')).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return count of existing keys', async () => {
      await redis.set('a', '1');
      await redis.set('b', '2');
      expect(await redis.exists('a', 'b', 'c')).toBe(2);
    });

    it('should return 0 for no existing keys', async () => {
      expect(await redis.exists('x', 'y')).toBe(0);
    });
  });

  describe('keys', () => {
    it('should return keys matching pattern', async () => {
      await redis.set('user:1', 'a');
      await redis.set('user:2', 'b');
      await redis.set('post:1', 'c');
      const result = await redis.keys('user:*');
      expect(result.sort()).toEqual(['user:1', 'user:2']);
    });

    it('should return empty array for no matches', async () => {
      await redis.set('a', '1');
      expect(await redis.keys('z*')).toEqual([]);
    });
  });

  describe('expire', () => {
    it('should set TTL on existing key', async () => {
      await redis.set('key1', 'val');
      expect(await redis.expire('key1', 5)).toBe(1);
      jest.advanceTimersByTime(5001);
      expect(await redis.get('key1')).toBeNull();
    });

    it('should return 0 for non-existent key', async () => {
      expect(await redis.expire('missing', 5)).toBe(0);
    });
  });

  describe('ttl', () => {
    it('should return -1 (simplified)', async () => {
      await redis.set('key1', 'val');
      expect(await redis.ttl('key1')).toBe(-1);
    });
  });

  describe('incr/decr', () => {
    it('should increment a key', async () => {
      expect(await redis.incr('counter')).toBe(1);
      expect(await redis.incr('counter')).toBe(2);
    });

    it('should decrement a key', async () => {
      await redis.set('counter', '5');
      expect(await redis.decr('counter')).toBe(4);
    });

    it('should start from 0 for missing key on incr', async () => {
      expect(await redis.incr('newcounter')).toBe(1);
    });

    it('should start from 0 for missing key on decr', async () => {
      expect(await redis.decr('newcounter')).toBe(-1);
    });
  });

  describe('mget/mset', () => {
    it('should set and get multiple keys', async () => {
      await redis.mset('a', '1', 'b', '2', 'c', '3');
      expect(await redis.mget('a', 'b', 'c', 'd')).toEqual(['1', '2', '3', null]);
    });
  });

  describe('hset/hget/hdel/hgetall', () => {
    it('should set and get hash fields', async () => {
      await redis.hset('user:1', 'name', 'Alice');
      await redis.hset('user:1', 'email', 'alice@example.com');
      expect(await redis.hget('user:1', 'name')).toBe('Alice');
      expect(await redis.hget('user:1', 'email')).toBe('alice@example.com');
    });

    it('should return null for missing hash field', async () => {
      expect(await redis.hget('user:1', 'missing')).toBeNull();
    });

    it('should delete hash fields', async () => {
      await redis.hset('user:1', 'name', 'Alice');
      await redis.hset('user:1', 'email', 'alice@example.com');
      expect(await redis.hdel('user:1', 'name')).toBe(1);
      expect(await redis.hget('user:1', 'name')).toBeNull();
    });

    it('should get all hash fields', async () => {
      await redis.hset('user:1', 'name', 'Alice');
      await redis.hset('user:1', 'email', 'alice@example.com');
      const all = await redis.hgetall('user:1');
      expect(all).toEqual({ name: 'Alice', email: 'alice@example.com' });
    });

    it('should return empty object for missing hash', async () => {
      expect(await redis.hgetall('missing')).toEqual({});
    });

    it('should support object-style hset', async () => {
      await redis.hset('user:2', { name: 'Bob', email: 'bob@example.com' });
      const all = await redis.hgetall('user:2');
      expect(all).toEqual({ name: 'Bob', email: 'bob@example.com' });
    });
  });

  describe('sadd/srem', () => {
    it('should add members to a set', async () => {
      expect(await redis.sadd('tags', 'node', 'react')).toBe(2);
      expect(await redis.sadd('tags', 'node')).toBe(0);
    });

    it('should remove members from a set', async () => {
      await redis.sadd('tags', 'node', 'react', 'vue');
      expect(await redis.srem('tags', 'react')).toBe(1);
      expect(await redis.srem('tags', 'angular')).toBe(0);
    });

    it('should return 0 for removing from non-existent set', async () => {
      expect(await redis.srem('missing', 'a')).toBe(0);
    });
  });

  describe('ping', () => {
    it('should return PONG', async () => {
      expect(await redis.ping()).toBe('PONG');
    });
  });

  describe('pipeline', () => {
    it('should execute pipeline operations and return [null, result][] format', async () => {
      await redis.set('existing', 'value');
      const results = await redis
        .pipeline()
        .set('key1', 'val1')
        .get('key1')
        .get('existing')
        .del('key1')
        .exec();

      expect(results).toHaveLength(4);
      expect(results[0]).toEqual([null, 'OK']);
      expect(results[1]).toEqual([null, 'val1']);
      expect(results[2]).toEqual([null, 'value']);
      expect(results[3]).toEqual([null, 1]);
    });

    it('should support pipeline with hash operations', async () => {
      const results = await redis
        .pipeline()
        .hset('hash1', 'field1', 'value1')
        .hget('hash1', 'field1')
        .hdel('hash1', 'field1')
        .exec();

      expect(results).toHaveLength(3);
      expect(results[0][0]).toBeNull();
      expect(results[1]).toEqual([null, 'value1']);
      expect(results[2]).toEqual([null, 1]);
    });

    it('should support pipeline with set operations', async () => {
      const results = await redis
        .pipeline()
        .sadd('set1', 'member1', 'member2')
        .srem('set1', 'member1')
        .exec();

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual([null, 2]);
      expect(results[1]).toEqual([null, 1]);
    });

    it('should support pipeline with incr', async () => {
      const results = await redis
        .pipeline()
        .incr('counter')
        .incr('counter')
        .exec();

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual([null, 1]);
      expect(results[1]).toEqual([null, 2]);
    });
  });

  describe('del with hash and set keys', () => {
    it('should delete hash keys', async () => {
      await redis.hset('hash1', 'f1', 'v1');
      expect(await redis.del('hash1')).toBe(1);
      expect(await redis.hgetall('hash1')).toEqual({});
    });

    it('should delete set keys', async () => {
      await redis.sadd('set1', 'a');
      expect(await redis.del('set1')).toBe(1);
    });
  });

  describe('exists with hash and set keys', () => {
    it('should detect hash keys', async () => {
      await redis.hset('hash1', 'f1', 'v1');
      expect(await redis.exists('hash1')).toBe(1);
    });

    it('should detect set keys', async () => {
      await redis.sadd('set1', 'a');
      expect(await redis.exists('set1')).toBe(1);
    });
  });
});
