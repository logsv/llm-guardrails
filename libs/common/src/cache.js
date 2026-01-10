import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  retryStrategy: (times) => {
    if (process.env.NODE_ENV === 'test') return null; // Stop retrying in test
    return Math.min(times * 50, 2000);
  }
});

export class CacheService {
  async get(key) {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key, value, ttl = 3600) {
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
  }

  async del(key) {
    await redis.del(key);
  }
}

export const cacheService = new CacheService();
