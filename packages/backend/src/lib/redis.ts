import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  retryStrategy: (times) => {
    // 限制重试间隔，最大延迟为 2 秒
    return Math.min(times * 50, 2000);
  },
});

redis.on('error', (err) => {
  console.error('[Redis Error]', err.message);
});

redis.on('connect', () => {
  console.log('[Redis] Connected successfully');
});

export default redis;
